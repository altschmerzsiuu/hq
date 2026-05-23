"""
ai/memory.py — Long-term Memory Manager untuk Gendhis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sistem 2-layer memory:

  SHORT-TERM (6 pesan terakhir = 3 exchange)
  └── Dikirim langsung ke LLM setiap request
  └── Cukup untuk konteks percakapan aktif

  LONG-TERM (summary teks di kolom chat_sessions.summary)
  └── Di-generate otomatis setiap SUMMARY_THRESHOLD pesan
  └── Di-inject ke system prompt sebagai "memori masa lalu"
  └── Hemat token vs kirim semua history

Flow:
  load_memory()     → ambil short-term + summary dari DB
  maybe_summarize() → cek apakah perlu generate summary baru
  build_memory_context() → format untuk system prompt
"""
from __future__ import annotations

import json
from typing import Optional

import google.generativeai as genai

from .config import GEMINI_MODEL
from .db import db_query

# Trigger summarization setiap N pesan baru
SUMMARY_THRESHOLD = 10

# Berapa pesan terakhir yang dikirim sebagai short-term memory
SHORT_TERM_LIMIT = 6


# ─────────────────────────────────────────────────────────────────────────
# Load memory untuk satu session
# ─────────────────────────────────────────────────────────────────────────
async def load_memory(user_id: int, session_id: str) -> tuple[list[dict], str]:
    """
    Ambil short-term messages + long-term summary untuk session ini.

    Returns:
        short_term : list[dict] — 6 pesan terakhir dalam format Gemini
        summary    : str        — long-term summary (kosong kalau belum ada)
    """
    rows = await db_query(
        "SELECT messages, summary FROM chat_sessions "
        "WHERE user_id = $1 AND session_id = $2",
        user_id, session_id,
    )

    if not rows:
        return [], ""

    row      = rows[0]
    raw_msgs = row.get("messages") or []
    messages = json.loads(raw_msgs) if isinstance(raw_msgs, str) else list(raw_msgs)
    summary  = row.get("summary") or ""

    # Short-term: ambil N pesan terakhir saja
    recent   = messages[-SHORT_TERM_LIMIT:]
    short_term = [
        {
            "role"  : "model" if m.get("role") in ("assistant", "model") else "user",
            "parts" : [m["content"]],
        }
        for m in recent
        if m.get("content")
    ]

    return short_term, summary


# ─────────────────────────────────────────────────────────────────────────
# Format summary sebagai konteks untuk system prompt
# ─────────────────────────────────────────────────────────────────────────
def build_memory_context(summary: str) -> str:
    """
    Format long-term summary jadi string yang bisa di-inject
    ke system prompt Gendhis.
    """
    if not summary:
        return ""
    return (
        f"\n\n---\n"
        f"**MEMORI PERCAKAPAN SEBELUMNYA:**\n{summary}\n"
        f"(Gunakan konteks ini kalau relevan dengan pertanyaan user sekarang.)\n"
        f"---"
    )


# ─────────────────────────────────────────────────────────────────────────
# Cek & generate summary kalau sudah waktunya
# ─────────────────────────────────────────────────────────────────────────
async def maybe_summarize(
    user_id    : int,
    session_id : str,
    all_messages: list[dict],
    old_summary : str,
) -> Optional[str]:
    """
    Generate summary baru kalau jumlah pesan sudah kelipatan SUMMARY_THRESHOLD.
    Kalau belum waktunya, return None (tidak ada perubahan).

    Logic:
    - Hitung total pesan
    - Kalau total % SUMMARY_THRESHOLD == 0 → generate summary
    - Summary baru mencakup: old_summary + pesan-pesan sebelum SHORT_TERM_LIMIT terakhir
    """
    total = len(all_messages)
    if total == 0 or total % SUMMARY_THRESHOLD != 0:
        return None  # Belum waktunya

    # Pesan yang akan di-summarize: semua kecuali short-term terbaru
    to_summarize = all_messages[:-SHORT_TERM_LIMIT] if total > SHORT_TERM_LIMIT else all_messages
    if not to_summarize:
        return None

    print(f"🧠 [Memory] Generating summary untuk session {session_id} "
          f"({total} pesan, {len(to_summarize)} akan di-summarize)...")

    new_summary = await _generate_summary(to_summarize, old_summary)
    if new_summary:
        await _save_summary(user_id, session_id, new_summary)
        print(f"✅ [Memory] Summary tersimpan ({len(new_summary)} chars)")
        return new_summary

    return None


# ─────────────────────────────────────────────────────────────────────────
# Generate summary via Gemini
# ─────────────────────────────────────────────────────────────────────────
async def _generate_summary(messages: list[dict], old_summary: str) -> str:
    """
    Minta Gemini untuk meringkas percakapan.
    Kalau sudah ada summary sebelumnya, summary baru akan meng-update yang lama.
    """
    # Format percakapan sebagai teks
    convo_text = "\n".join(
        f"{'User' if m.get('role') == 'user' else 'Gendhis'}: {m.get('content', '')}"
        for m in messages
        if m.get("content")
    )

    # Prompt summarization
    if old_summary:
        prompt = (
            f"Berikut adalah ringkasan percakapan sebelumnya:\n{old_summary}\n\n"
            f"Dan ini adalah percakapan baru yang perlu ditambahkan ke ringkasan:\n"
            f"{convo_text}\n\n"
            "Tolong perbarui ringkasan tersebut dengan informasi dari percakapan baru. "
            "Fokus pada: sapi yang disebutkan, kondisi kesehatan, tindakan yang sudah dilakukan, "
            "dan pertanyaan/kekhawatiran user. "
            "Tulis ringkasan dalam 3-5 kalimat. Gunakan Bahasa Indonesia."
        )
    else:
        prompt = (
            f"Ringkas percakapan berikut antara peternak dan Gendhis (AI asisten peternakan):\n\n"
            f"{convo_text}\n\n"
            "Fokus pada: sapi yang disebutkan, kondisi kesehatan, tindakan yang sudah dilakukan, "
            "dan pertanyaan/kekhawatiran user. "
            "Tulis ringkasan dalam 3-5 kalimat. Gunakan Bahasa Indonesia."
        )

    try:
        model  = genai.GenerativeModel(model_name=GEMINI_MODEL)
        resp   = await model.generate_content_async(prompt)
        return (resp.text or "").strip()
    except Exception as e:
        print(f"❌ [Memory] Gagal generate summary: {e}")
        return ""


# ─────────────────────────────────────────────────────────────────────────
# Simpan summary ke DB
# ─────────────────────────────────────────────────────────────────────────
async def _save_summary(user_id: int, session_id: str, summary: str) -> None:
    await db_query(
        "UPDATE chat_sessions SET summary = $1 "
        "WHERE user_id = $2 AND session_id = $3",
        summary, user_id, session_id,
    )