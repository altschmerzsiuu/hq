"""
chat_routes.py
FastAPI router for Gendhis AI chat — dengan Long-term Memory.

Endpoints:
  POST   /api/chat                  – SSE streaming chat
  GET    /api/chat/sessions         – list sessions
  GET    /api/chat/sessions/{id}    – load session messages
  DELETE /api/chat/sessions/{id}    – delete session

Memory System:
  SHORT-TERM : 6 pesan terakhir → dikirim ke LLM langsung
  LONG-TERM  : summary teks di chat_sessions.summary
               → di-inject ke system prompt Gendhis
               → di-generate ulang setiap 10 pesan
"""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from auth_routes import get_current_user
from ai.db import db_query, serialize, load_session, upsert_session
from ai.tools import get_farm_overview
from ai.agent import stream_agent
from ai.memory import load_memory, maybe_summarize, build_memory_context

router = APIRouter(prefix="/api/chat", tags=["Gendhis AI"])


# ─── helpers ────────────────────────────────────────────────────────────
def _make_title(msg: str) -> str:
    clean = msg.strip().replace("\n", " ")
    return clean[:40] + ("..." if len(clean) > 40 else "")


def _history_to_gemini(messages: list[dict]) -> list[dict]:
    """
    Convert stored JSONB messages → Gemini chat history format.
    Sekarang hanya ambil SHORT_TERM_LIMIT pesan — memory jangka panjang
    ditangani oleh summary yang di-inject ke system prompt.
    """
    result = []
    for m in messages[-6:]:   # short-term: 6 pesan = 3 exchange
        role = "model" if m.get("role") in ("assistant", "model") else "user"
        result.append({"role": role, "parts": [m["content"]]})
    return result


# ─── POST /api/chat ── SSE Streaming ────────────────────────────────────
@router.post("")
async def chat(
    data        : dict,
    current_user: dict = Depends(get_current_user),
):
    user_id    = current_user["id"]
    user_msg   = data.get("message", "").strip()
    session_id = data.get(
        "session_id",
        f"session_{int(datetime.now().timestamp() * 1000)}",
    )

    if not user_msg:
        raise HTTPException(status_code=400, detail="Pesan kosong")

    # Pre-fetch farm context
    farm_context = await get_farm_overview()

    # Load session + memory
    existing_msgs, session_title, is_new = await load_session(user_id, session_id)
    if is_new:
        session_title = _make_title(user_msg)

    # ── 2-layer memory ────────────────────────────────────────────────
    # short_term : list[dict] format Gemini — 6 pesan terakhir
    # old_summary: str — ringkasan semua percakapan sebelumnya
    short_term, old_summary = await load_memory(user_id, session_id)

    # Inject summary ke farm_context supaya agent bisa pakai
    # (dikirim sebagai field tambahan, agent akan inject ke system prompt)
    if old_summary:
        farm_context["_memory_summary"] = build_memory_context(old_summary)
        print(f"🧠 [Memory] Injecting summary ({len(old_summary)} chars) ke context")

    async def _event_generator():
        full_reply = []
        try:
            async for chunk in stream_agent(
                user_msg    = user_msg,
                user_info   = current_user,
                farm_context= farm_context,
                history     = short_term,   # ← short-term only
            ):
                full_reply.append(chunk)
                payload = json.dumps({"chunk": chunk}, ensure_ascii=False)
                yield f"data: {payload}\n\n"

        except Exception as exc:
            import traceback
            traceback.print_exc()
            friendly_err = "Maaf ya lyy, Gendhis sedang mengkalibrasi sistem sensor di kandang. Silakan tanyakan kembali beberapa saat lagi! 🐮✨"
            yield f"data: {json.dumps({'chunk': friendly_err}, ensure_ascii=False)}\n\n"
            return

        # ── Persist session ───────────────────────────────────────────
        reply_text = "".join(full_reply)
        now_ts     = datetime.now().isoformat()
        new_msgs   = existing_msgs + [
            {"role": "user",      "content": user_msg,   "ts": now_ts},
            {"role": "assistant", "content": reply_text, "ts": now_ts},
        ]
        await upsert_session(user_id, session_id, session_title, new_msgs, is_new)

        # ── Maybe generate long-term summary ─────────────────────────
        # Cek apakah sudah waktunya summarize (setiap 10 pesan)
        new_summary = await maybe_summarize(
            user_id     = user_id,
            session_id  = session_id,
            all_messages= new_msgs,
            old_summary = old_summary,
        )
        if new_summary:
            print(f"🧠 [Memory] New summary generated untuk session {session_id}")

        # ── Final SSE event ───────────────────────────────────────────
        done_payload = json.dumps({
            "done"      : True,
            "session_id": session_id,
            "title"     : session_title,
            "is_new"    : is_new,
        }, ensure_ascii=False)
        yield f"data: {done_payload}\n\n"

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control"              : "no-cache",
            "X-Accel-Buffering"          : "no",
        },
    )


# ─── GET /api/chat/sessions ─────────────────────────────────────────────
@router.get("/sessions")
async def list_sessions(current_user: dict = Depends(get_current_user)):
    rows = await db_query(
        """
        SELECT session_id, title, updated_at,
               jsonb_array_length(messages) AS msg_count,
               CASE WHEN summary IS NOT NULL THEN true ELSE false END AS has_summary
        FROM chat_sessions
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 30
        """,
        current_user["id"],
    )
    return serialize(rows)


# ─── GET /api/chat/sessions/{session_id} ────────────────────────────────
@router.get("/sessions/{session_id}")
async def get_session(
    session_id  : str,
    current_user: dict = Depends(get_current_user),
):
    rows = await db_query(
        "SELECT messages, summary FROM chat_sessions "
        "WHERE user_id=$1 AND session_id=$2",
        current_user["id"], session_id,
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Session tidak ditemukan")

    raw      = rows[0]["messages"]
    messages = json.loads(raw) if isinstance(raw, str) else list(raw or [])
    summary  = rows[0].get("summary") or None

    return {"messages": messages, "summary": summary}


# ─── DELETE /api/chat/sessions/{session_id} ─────────────────────────────
@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id  : str,
    current_user: dict = Depends(get_current_user),
):
    await db_query(
        "DELETE FROM chat_sessions WHERE user_id=$1 AND session_id=$2",
        current_user["id"], session_id,
    )
    return {"status": "deleted"}