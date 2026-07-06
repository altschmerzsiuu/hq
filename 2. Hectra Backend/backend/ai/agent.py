"""
ai/agent.py  —  Gendhis Agentic Workflow (LangGraph Multi-Node)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Graph Flow:
                        ┌─────────────┐
                        │   ROUTER    │  ← klasifikasi intent user
                        └──────┬──────┘
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
          "realtime"      "knowledge"     "chit_chat"
                │              │              │
                ▼              ▼              └──► RESPONDER ──► END
          ┌──────────┐  ┌──────────────┐
          │ PLANNER  │  │   EXECUTOR   │ ← langsung ke vector search
          └────┬─────┘  └──────┬───────┘
               │               │
               ▼               ▼
          ┌──────────┐  ┌──────────────┐
          │ EXECUTOR │  │ SELF_CORRECT │ ← cek apakah hasil relevan
          └────┬─────┘  └──────┬───────┘
               │        ┌──────┴──────┐
               ▼        ▼             ▼
          SELF_CORRECT  "ok"       "retry" ──► EXECUTOR (max 2x)
               │
               ▼
          RESPONDER ──► END

Nodes:
  router_node       — klasifikasi intent: realtime / knowledge / chit_chat
  planner_node      — cek sensor kritis 24 jam sebelum eksekusi (realtime only)
  executor_node     — jalankan tool calls (SQL atau VectorDB)
  self_correct_node — validasi hasil tool, retry kalau tidak relevan
  responder_node    — generate jawaban final

LangSmith:
  Set LANGCHAIN_API_KEY + LANGCHAIN_TRACING_V2=true → auto-traced.
  Setiap node muncul sebagai span terpisah di dashboard.
"""
from __future__ import annotations

import asyncio, os, json, re
import traceback
from groq import AsyncGroq
from typing import Any, AsyncIterator, Literal, TypedDict

from langgraph.graph import StateGraph, END
import google.generativeai as genai

from .config import GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY
from .tools import GENDHIS_TOOLS

# ─────────────────────────────────────────────────────────────────────────
# LangSmith — auto-aktif kalau LANGCHAIN_API_KEY di-set
# ─────────────────────────────────────────────────────────────────────────
_LANGSMITH_ENABLED = bool(os.getenv("LANGSMITH_API_KEY"))
if _LANGSMITH_ENABLED:
    os.environ.setdefault("LANGSMITH_TRACING",  "true")
    os.environ.setdefault("LANGSMITH_PROJECT",  os.getenv("LANGSMITH_PROJECT", "gendhis-chatbot-ai"))
    os.environ.setdefault("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
    print("✅ [LangSmith] Tracing aktif —", os.getenv("LANGSMITH_PROJECT"))
else:
    os.environ["LANGSMITH_TRACING"] = "false"
    print("ℹ️  [LangSmith] Tracing off (LANGSMITH_API_KEY tidak ditemukan)")

# ─────────────────────────────────────────────────────────────────────────
# Clients
# ─────────────────────────────────────────────────────────────────────────
genai.configure(api_key=GEMINI_API_KEY)
groq_client = AsyncGroq(api_key=GROQ_API_KEY)

def get_generative_model(model_name: str, system_instruction: str | None = None, tools: Any = None) -> tuple[genai.GenerativeModel, str | None]:
    try:
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_instruction,
            tools=tools,
        )
        return model, None
    except TypeError:
        model = genai.GenerativeModel(
            model_name=model_name,
            tools=tools,
        )
        return model, system_instruction

# ─────────────────────────────────────────────────────────────────────────
# Tool registry
# ─────────────────────────────────────────────────────────────────────────
_TOOL_MAP: dict[str, Any] = {fn.__name__: fn for fn in GENDHIS_TOOLS}

GROQ_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "analyze_barn_status",
            "description": "Aggregate status kesehatan dan estrus semua sapi di kandang tertentu",
            "parameters": {
                "type": "object",
                "properties": {"barn_id": {"type": "string"}},
                "required": ["barn_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_cattle_info",
            "description": "Cari profil sapi berdasarkan nama atau RFID",
            "parameters": {
                "type": "object",
                "properties": {"nama_sapi": {"type": "string"}},
                "required": ["nama_sapi"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_cattle_condition",
            "description": "Cek profil sapi + data sensor terbaru (suhu, aktivitas, estrus)",
            "parameters": {
                "type": "object",
                "properties": {"nama_sapi": {"type": "string"}},
                "required": ["nama_sapi"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_farm_overview",
            "description": "Ringkasan kondisi kandang: total sapi, sakit, estrus 24 jam",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_mantri_contact",
            "description": "Cari kontak mantri/dokter hewan, filter opsional by wilayah",
            "parameters": {
                "type": "object",
                "properties": {"wilayah": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_knowledge_base",
            "description": "Cari panduan peternakan, penyakit, atau info teknis dari knowledge base",
            "parameters": {
                "type": "object",
                "properties": {"question": {"type": "string"}},
                "required": ["question"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "notify_vet_whatsapp",
            "description": "Generate WhatsApp link untuk laporan ke mantri/dokter",
            "parameters": {
                "type": "object",
                "properties": {
                    "vet_id": {"type": "string"},
                    "report": {"type": "string"},
                },
                "required": ["vet_id", "report"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "google_calendar_sync",
            "description": "Buat event Google Calendar untuk jadwal IB",
            "parameters": {
                "type": "object",
                "properties": {
                    "title":      {"type": "string"},
                    "start_time": {"type": "string", "description": "ISO 8601"},
                },
                "required": ["title", "start_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_daily_report",
            "description": "Generate laporan harian kandang dalam format PDF dan .ics kalender untuk HP",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "integer", "description": "ID user peternak"}
                },
                "required": ["user_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_estrus_wa_alert",
            "description": "Generate WhatsApp alert link untuk notifikasi estrus ke mantri/dokter hewan",
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "description": "Nama mantri spesifik, atau 'all' untuk semua kontak",
                    }
                },
            },
        },
    },
]


# ─────────────────────────────────────────────────────────────────────────
# State — diperluas untuk multi-node workflow
# ─────────────────────────────────────────────────────────────────────────
class GendhisState(TypedDict):
    # Input
    messages     : list[dict]   # Gemini-format chat history
    user_info    : dict
    farm_context : dict
    user_msg     : str

    # Routing
    intent       : str          # "realtime" | "knowledge" | "chit_chat"

    # Planning
    plan_context : str          # alert sensor kritis dari planner

    # Execution
    tool_results : list[dict]   # hasil raw dari tool calls
    retry_count  : int          # counter self-correction retries

    # Output
    reply        : str


# ─────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────
def _build_system_instruction(user_info: dict, farm_context: dict) -> str:
    name          = user_info.get("full_name", "User")
    total         = farm_context.get("total_sapi", 0)
    sakit         = farm_context.get("sapi_sakit", 0)
    estrus_alerts = farm_context.get("peringatan_estrus", 0)
    memory_ctx = farm_context.get("_memory_summary", "")

    return (
        f"Kamu adalah Gendhis, Chief AI Officer di Estrus AI untuk {name}.\n"
        f"INFO KANDANG: {total} sapi total | {sakit} sakit | "
        f"{estrus_alerts} terdeteksi birahi (24 jam).\n\n"
        "Prinsip:\n"
        "- Data-Driven: gunakan tools, jangan asumsi.\n"
        "- Proactive Alert: suhu > 39.5°C atau estrus detected → WAJIB beri peringatan.\n"
        "- Tunjukkan thinking process singkat dalam tanda kurung siku: [Mengecek data...]\n"
        "- Gunakan Markdown yang rapi. Bold angka-angka penting.\n"
        "- Bahasa mengikuti user (Indonesia/English)."
        + (f"\n{memory_ctx}" if memory_ctx else "")
    )


async def _call_gemini_with_tools(
    user_msg       : str,
    history        : list[dict],
    sys_instruction: str,
    extra_context  : str = "",
) -> tuple[str, list[dict]]:
    """Panggil Gemini dengan tool-calling loop. Returns (reply, tool_results)."""
    full_msg = f"{extra_context}\n\n{user_msg}".strip() if extra_context else user_msg

    model, prepended = get_generative_model(
        model_name=GEMINI_MODEL,
        system_instruction=sys_instruction,
        tools=GENDHIS_TOOLS,
    )
    if prepended:
        full_msg = f"SISTEM/PRINSIP INTERNAL GENDHIS AI:\n{prepended}\n\nPESAN USER:\n{full_msg}"

    chat         = model.start_chat(history=history)
    response     = await chat.send_message_async(full_msg)
    tool_results : list[dict] = []

    for _ in range(6):
        try:
            part = response.candidates[0].content.parts[0]
            if not getattr(part, "function_call", None) or not part.function_call.name:
                break
        except (IndexError, AttributeError):
            break

        fn_name = part.function_call.name
        fn_args = dict(part.function_call.args)
        print(f"🔧 [Gemini tool] {fn_name}({fn_args})")

        tool_fn = _TOOL_MAP.get(fn_name)
        result  = await tool_fn(**fn_args) if tool_fn else {"error": "Tool not found"}
        tool_results.append({"tool": fn_name, "args": fn_args, "result": result})

        response = await chat.send_message_async({
            "role" : "function",
            "parts": [{"function_response": {"name": fn_name, "response": {"result": result}}}],
        })

    return (response.text or ""), tool_results


def _extract_cow_name(text: str) -> str | None:
    """Ekstrak nama sapi yang disebut user (heuristik regex)."""
    patterns = [
        r"sapi\s+([A-Za-z][A-Za-z0-9\s]{1,20}?)(?:\s+(?:gimana|kondisi|suhu|status|bagaimana|itu))",
        r"cek\s+(?:sapi\s+)?([A-Za-z][A-Za-z0-9\s]{1,20}?)(?:\s|$)",
        r"(?:kondisi|status)\s+([A-Za-z][A-Za-z0-9\s]{1,20}?)(?:\s|$)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


# ─────────────────────────────────────────────────────────────────────────
# NODE 1 — ROUTER
# Klasifikasi intent: realtime / knowledge / chit_chat
# ─────────────────────────────────────────────────────────────────────────
async def router_node(state: GendhisState) -> GendhisState:
    msg = state["user_msg"].lower()

    REALTIME_KW  = [
        "suhu","temperature","estrus","birahi","sensor","sapi","kondisi","status",
        "sakit","kandang","aktivitas","collar","overview","ringkasan","mantri",
        "dokter","ib","inseminasi","calendar","jadwal","whatsapp","laporan",
    ]
    KNOWLEDGE_KW = [
        "cara","bagaimana","apa itu","panduan","tips","penyakit","gejala",
        "penanganan","kenapa","mengapa","jelaskan","info","artikel",
        "rekomendasi","saran","how to","what is","guide",
    ]

    rt_score = sum(1 for kw in REALTIME_KW  if kw in msg)
    kn_score = sum(1 for kw in KNOWLEDGE_KW if kw in msg)

    if rt_score > kn_score and rt_score > 0:
        intent = "realtime"
    elif kn_score > 0:
        intent = "knowledge"
    else:
        # Ambiguous — tanya LLM
        model  = genai.GenerativeModel(model_name=GEMINI_MODEL)
        prompt = (
            "Klasifikasikan pesan ini:\n"
            "- realtime: data sensor, kondisi sapi, status kandang, kontak mantri, jadwal IB\n"
            "- knowledge: panduan peternakan, penyakit, tips umum\n"
            "- chit_chat: salam, basa-basi, tidak terkait peternakan\n\n"
            f"Pesan: \"{state['user_msg']}\"\n\n"
            "Jawab HANYA satu kata: realtime / knowledge / chit_chat"
        )
        resp   = await model.generate_content_async(prompt)
        raw    = (resp.text or "chit_chat").strip().lower()
        intent = raw if raw in ("realtime", "knowledge", "chit_chat") else "chit_chat"

    print(f"🧭 [Router] intent='{intent}' | '{state['user_msg'][:60]}'")
    return {**state, "intent": intent}


# ─────────────────────────────────────────────────────────────────────────
# NODE 2 — PLANNER  (realtime only)
# Cek sensor kritis 24 jam — hasilnya jadi prefix di jawaban Gendhis
# ─────────────────────────────────────────────────────────────────────────
async def planner_node(state: GendhisState) -> GendhisState:
    print("📋 [Planner] Mengecek kondisi sensor kritis...")
    alerts : list[str] = []
    farm   = state["farm_context"]

    if farm.get("peringatan_estrus", 0) > 0:
        alerts.append(
            f"⚠️ **{farm['peringatan_estrus']} sapi** terdeteksi birahi dalam 24 jam terakhir."
        )
    if farm.get("sapi_sakit", 0) > 0:
        alerts.append(
            f"🚨 **{farm['sapi_sakit']} sapi** dalam kondisi sakit."
        )

    # Cek sapi spesifik yang disebut di pesan
    cow_name = _extract_cow_name(state["user_msg"])
    if cow_name:
        try:
            check_fn = _TOOL_MAP.get("check_cattle_condition")
            if check_fn:
                data = await check_fn(nama_sapi=cow_name)
                if data:
                    temp = data.get("temperature")
                    if temp and float(temp) > 39.5:
                        alerts.append(
                            f"🌡️ Sapi **{cow_name}** suhu **{temp}°C** — di atas normal (>39.5°C)!"
                        )
                    if data.get("estrus_detected") == 1:
                        alerts.append(
                            f"💉 Sapi **{cow_name}** terdeteksi birahi — "
                            "pertimbangkan jadwal IB segera."
                        )
        except Exception as exc:
            print(f"⚠️ [Planner] Gagal cek '{cow_name}': {exc}")

    plan_context = (
        "**🔔 ALERT KANDANG:**\n" + "\n".join(f"- {a}" for a in alerts)
        if alerts else ""
    )
    print(f"📋 [Planner] {plan_context or '(tidak ada alert kritis)'}")
    return {**state, "plan_context": plan_context}


# ─────────────────────────────────────────────────────────────────────────
# NODE 3 — EXECUTOR
# Jalankan tools: SQL tools (realtime) atau vector search (knowledge)
# ─────────────────────────────────────────────────────────────────────────
async def executor_node(state: GendhisState) -> GendhisState:
    print(f"⚙️  [Executor] intent='{state['intent']}'")
    sys_instruction = _build_system_instruction(
        state["user_info"], state["farm_context"]
    )

    if state["intent"] == "knowledge":
        # Vector search path
        try:
            kb_fn   = _TOOL_MAP["query_knowledge_base"]
            results = await kb_fn(question=state["user_msg"])
            tool_results = [{"tool": "query_knowledge_base",
                             "args": {"question": state["user_msg"]},
                             "result": results}]
        except Exception as exc:
            print(f"❌ [Executor/KB] {exc}")
            tool_results = [{"tool": "query_knowledge_base",
                             "args": {}, "result": {"error": str(exc)}}]
        return {**state, "tool_results": tool_results, "reply": ""}

    # Realtime path: Gemini dengan SQL tools + plan_context sebagai prefix
    reply, tool_results = await _call_gemini_with_tools(
        user_msg        = state["user_msg"],
        history         = state["messages"],
        sys_instruction = sys_instruction,
        extra_context   = state.get("plan_context", ""),
    )
    return {**state, "tool_results": tool_results, "reply": reply}


# ─────────────────────────────────────────────────────────────────────────
# NODE 4 — SELF_CORRECT
# Validasi hasil tool. Kalau kosong/error, retry dengan expanded query.
# ─────────────────────────────────────────────────────────────────────────
async def self_correct_node(state: GendhisState) -> GendhisState:
    tool_results = state.get("tool_results", [])
    retry_count  = state.get("retry_count", 0)

    has_error = any(
        isinstance(r.get("result"), dict) and "error" in r.get("result", {})
        for r in tool_results
    )
    kb_empty = (
        state["intent"] == "knowledge"
        and tool_results
        and not tool_results[0].get("result")
    )
    needs_retry = (not tool_results or has_error or kb_empty) and retry_count < 2

    if needs_retry:
        print(f"🔄 [SelfCorrect] Retry #{retry_count + 1} — hasil tidak relevan")

        if state["intent"] == "knowledge":
            expanded = await _expand_query(state["user_msg"])
            try:
                kb_fn   = _TOOL_MAP["query_knowledge_base"]
                results = await kb_fn(question=expanded)
                tool_results = [{"tool": "query_knowledge_base",
                                 "args": {"question": expanded},
                                 "result": results}]
            except Exception as exc:
                tool_results = [{"tool": "query_knowledge_base",
                                 "args": {}, "result": {"error": str(exc)}}]
        else:
            # Realtime fallback: ambil overview dulu
            try:
                fn      = _TOOL_MAP["get_farm_overview"]
                overview = await fn()
                tool_results = [{"tool": "get_farm_overview",
                                 "args": {}, "result": overview}]
            except Exception:
                tool_results = []

        return {**state, "tool_results": tool_results, "retry_count": retry_count + 1}

    print(f"✅ [SelfCorrect] OK (retry_count={retry_count})")
    return {**state, "retry_count": retry_count}


async def _expand_query(original: str) -> str:
    """Expand query yang tidak menghasilkan hasil relevan."""
    model  = genai.GenerativeModel(model_name=GEMINI_MODEL)
    prompt = (
        f"Query ini tidak menghasilkan hasil relevan: \"{original}\"\n"
        "Tulis ulang dengan kata kunci lebih luas terkait manajemen peternakan sapi.\n"
        "Jawab HANYA query baru, tanpa penjelasan."
    )
    resp     = await model.generate_content_async(prompt)
    expanded = (resp.text or original).strip()
    print(f"🔍 [SelfCorrect] Expanded: '{expanded}'")
    return expanded


def _should_retry(state: GendhisState) -> Literal["executor", "responder"]:
    """Edge condition: balik ke executor kalau retry diperlukan."""
    retry = state.get("retry_count", 0)
    if retry > 0:
        tool_results = state.get("tool_results", [])
        has_error = any(
            isinstance(r.get("result"), dict) and "error" in r.get("result", {})
            for r in tool_results
        )
        if has_error or not tool_results:
            return "executor"
    return "responder"


# ─────────────────────────────────────────────────────────────────────────
# NODE 5 — RESPONDER
# Generate jawaban final dari semua konteks yang sudah dikumpulkan
# ─────────────────────────────────────────────────────────────────────────
async def responder_node(state: GendhisState) -> GendhisState:
    sys_instruction = _build_system_instruction(
        state["user_info"], state["farm_context"]
    )

    # ── chit_chat ─────────────────────────────────────────────────────
    if state["intent"] == "chit_chat":
        model, prepended = get_generative_model(
            model_name=GEMINI_MODEL,
            system_instruction=sys_instruction,
        )
        user_msg = state["user_msg"]
        if prepended:
            user_msg = f"SISTEM/PRINSIP INTERNAL GENDHIS AI:\n{prepended}\n\nPESAN USER:\n{user_msg}"
        chat = model.start_chat(history=state["messages"])
        resp = await chat.send_message_async(user_msg)
        return {**state, "reply": resp.text or "Halo! Ada yang bisa Gendhis bantu?"}

    # ── realtime: reply sudah di-set executor, inject plan_context ────
    if state["intent"] == "realtime" and state.get("reply"):
        plan  = state.get("plan_context", "")
        reply = state["reply"]
        if plan and plan not in reply:
            reply = f"{plan}\n\n---\n\n{reply}"
        return {**state, "reply": reply}

    # ── knowledge: rangkum hasil vector search ────────────────────────
    tool_results = state.get("tool_results", [])
    kb_result    = tool_results[0].get("result", []) if tool_results else []

    if not kb_result:
        return {**state, "reply": (
            "Maaf, Gendhis tidak menemukan info relevan di knowledge base. "
            "Coba tanyakan dengan kata kunci berbeda ya!"
        )}

    context_text = "\n\n".join(
        f"[{i+1}] {item.get('content', str(item))}"
        for i, item in enumerate(kb_result[:3])
    ) if isinstance(kb_result, list) else str(kb_result)

    model, prepended = get_generative_model(
        model_name=GEMINI_MODEL,
        system_instruction=sys_instruction,
    )
    prompt = (
        f"Berdasarkan konteks dari knowledge base:\n\n{context_text}\n\n"
        f"Jawab pertanyaan: \"{state['user_msg']}\"\n\n"
        "Gunakan Markdown. Jika konteks tidak cukup, katakan jujur."
    )
    if prepended:
        prompt = f"SISTEM/PRINSIP INTERNAL GENDHIS AI:\n{prepended}\n\n{prompt}"
    chat = model.start_chat(history=state["messages"])
    resp = await chat.send_message_async(prompt)
    return {**state, "reply": resp.text or "Tidak ada informasi yang ditemukan."}


# ─────────────────────────────────────────────────────────────────────────
# Routing functions (conditional edges)
# ─────────────────────────────────────────────────────────────────────────
def _route_by_intent(
    state: GendhisState,
) -> Literal["planner", "executor", "responder"]:
    intent = state.get("intent", "chit_chat")
    if intent == "realtime":
        return "planner"
    if intent == "knowledge":
        return "executor"
    return "responder"


# ─────────────────────────────────────────────────────────────────────────
# Build graph
# ─────────────────────────────────────────────────────────────────────────
def _build_graph() -> Any:
    g = StateGraph(GendhisState)

    g.add_node("router",       router_node)
    g.add_node("planner",      planner_node)
    g.add_node("executor",     executor_node)
    g.add_node("self_correct", self_correct_node)
    g.add_node("responder",    responder_node)

    g.set_entry_point("router")

    g.add_conditional_edges(
        "router",
        _route_by_intent,
        {"planner": "planner", "executor": "executor", "responder": "responder"},
    )

    g.add_edge("planner",  "executor")
    g.add_edge("executor", "self_correct")

    g.add_conditional_edges(
        "self_correct",
        _should_retry,
        {"executor": "executor", "responder": "responder"},
    )

    g.add_edge("responder", END)

    compiled = g.compile()
    if _LANGSMITH_ENABLED:
        print("✅ [LangSmith] Multi-node graph compiled dengan tracing aktif")
    return compiled


_graph = _build_graph()

# ─────────────────────────────────────────────────────────────────────────
# Initial state helper
# ─────────────────────────────────────────────────────────────────────────
def _init_state(
    user_msg    : str,
    user_info   : dict,
    farm_context: dict,
    history     : list[dict],
) -> GendhisState:
    return {
        "messages"    : history,
        "user_info"   : user_info,
        "farm_context": farm_context,
        "user_msg"    : user_msg,
        "intent"      : "",
        "plan_context": "",
        "tool_results": [],
        "retry_count" : 0,
        "reply"       : "",
    }


# ─────────────────────────────────────────────────────────────────────────
# Public API — run_agent (non-streaming)
# ─────────────────────────────────────────────────────────────────────────
async def run_agent(
    user_msg    : str,
    user_info   : dict,
    farm_context: dict,
    history     : list[dict],
) -> str:
    try:
        result = await _graph.ainvoke(
            _init_state(user_msg, user_info, farm_context, history),
            config={"run_name": f"gendhis | {user_info.get('full_name', 'user')}"},
        )
        return result["reply"]
    except Exception as e:
        print(f"❌ [run_agent] {e}")
        traceback.print_exc()
        return f"Error: {str(e)}"


# ─────────────────────────────────────────────────────────────────────────
# Groq fallback streaming
# ─────────────────────────────────────────────────────────────────────────
async def stream_from_groq(
    user_msg    : str,
    user_info   : dict,
    farm_context: dict,
    history     : list[dict],
) -> AsyncIterator[str]:
    """
    Async fallback via Groq/Llama kalau Gemini quota habis.
    SENGAJA tidak pakai tool_calling — Llama tidak reliable untuk tool use
    dan sering throw BadRequestError. Farm context di-inject langsung ke
    system prompt supaya Gendhis tetap bisa jawab dengan data yang ada.
    """
    sys_instruction = _build_system_instruction(user_info, farm_context)

    # Inject data farm langsung sebagai konteks tambahan
    farm_ctx_str    = json.dumps(farm_context, ensure_ascii=False, default=str)
    enhanced_system = (
        f"{sys_instruction}\n\n"
        f"DATA KANDANG TERKINI (gunakan ini untuk menjawab):\n{farm_ctx_str}\n\n"
        "Catatan: Jawab berdasarkan data di atas. "
        "Jika user tanya detail sapi spesifik yang tidak ada, "
        "sampaikan bahwa sistem sedang dalam mode terbatas."
    )

    messages = [{"role": "system", "content": enhanced_system}]
    for h in history:
        role    = "assistant" if h["role"] == "model" else "user"
        content = h["parts"][0] if isinstance(h["parts"], list) else h["parts"]
        messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_msg})

    print("🤖 [Groq Fallback] Streaming tanpa tool calling (mode aman)")

    # Langsung stream — tidak ada tool calling untuk hindari BadRequestError
    stream = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


# ─────────────────────────────────────────────────────────────────────────
# Public API — stream_agent (dipanggil dari chat_routes.py via SSE)
# ─────────────────────────────────────────────────────────────────────────
async def stream_agent(
    user_msg    : str,
    user_info   : dict,
    farm_context: dict,
    history     : list[dict],
) -> AsyncIterator[str]:
    """
    Primary streaming entry point.
    Jalankan full multi-node graph → stream reply word-by-word ke frontend.
    Fallback ke Groq kalau Gemini quota habis.
    """
    try:
        result = await _graph.ainvoke(
            _init_state(user_msg, user_info, farm_context, history),
            config={"run_name": f"gendhis-stream | {user_info.get('full_name', 'user')}"},
        )

        reply = result.get("reply", "")
        if not reply:
            yield "Gendhis tidak bisa memproses permintaan ini saat ini."
            return

        # Stream word-by-word — frontend tetap dapat feel streaming
        words = reply.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")
            await asyncio.sleep(0.01)

    except Exception as e:
        error_msg = str(e).lower()
        if any(x in error_msg for x in ["429", "quota", "limit", "resource_exhausted"]):
            print("⚠️ [Fallback] Gemini limit! Switching to Groq...")
            async for chunk in stream_from_groq(user_msg, user_info, farm_context, history):
                yield chunk
        else:
            print(f"❌ [stream_agent] {e}")
            traceback.print_exc()
            yield "Maaf ya lyy, Gendhis sedang mengkalibrasi sistem sensor di kandang. Silakan tanyakan kembali beberapa saat lagi! 🐮✨"