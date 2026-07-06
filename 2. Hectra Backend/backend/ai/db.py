"""
ai/db.py
Shared database helpers for the AI module.
Provides:
  - get_pool()         : returns global asyncpg Pool
  - db_query()         : SELECT helper
  - db_execute()       : INSERT/UPDATE/DELETE helper
  - search_knowledge_base() : pgvector cosine similarity search
  - serialize()        : datetime-safe dict serialiser
"""
from __future__ import annotations

import json
import asyncpg
from datetime import datetime, date
from typing import Any

from .config import DB_CONFIG, EMBEDDING_MODEL, GEMINI_API_KEY

# ── Shared pool (delegates to app.py's centralised pool) ────────────────
async def get_pool() -> asyncpg.Pool:
    """
    Return the shared connection pool from app.py.
    Using a lazy import avoids circular import issues at module load time.
    """
    from app import get_db_pool  # app.py owns the single global pool
    return await get_db_pool()


async def db_query(query: str, *args: Any) -> list[asyncpg.Record]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)


async def db_execute(query: str, *args: Any) -> str:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)


# ── Serialiser ────────────────────────────────────────────────────────────
def serialize(data: Any) -> Any:
    """Convert asyncpg Records (with datetime fields) to JSON-safe dicts."""
    if data is None:
        return None
    if isinstance(data, (list, tuple)):
        return [serialize(item) for item in data]
    if isinstance(data, asyncpg.Record):
        data = dict(data)
    if isinstance(data, dict):
        return {k: (v.isoformat() if isinstance(v, (datetime, date)) else v)
                for k, v in data.items()}
    return data


# ── pgvector RAG ──────────────────────────────────────────────────────────
async def search_knowledge_base(question: str, top_k: int = 3) -> list[dict]:
    """
    Embed `question` with Gemini's embedding model, then perform a
    pgvector cosine-similarity search against the knowledge_base table.

    Returns a list of {title, content} dicts (most-relevant first).
    """
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)

        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=question,
            task_type="retrieval_query",
        )
        embedding: list[float] = result["embedding"]
        embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

        rows = await db_query(
            f"""
            SELECT title, content,
                   1 - (embedding <=> '{embedding_str}'::vector) AS similarity
            FROM knowledge_base
            ORDER BY embedding <=> '{embedding_str}'::vector
            LIMIT $1
            """,
            top_k,
        )
        return serialize(rows)
    except Exception as exc:
        print(f"[RAG] knowledge_base search failed: {exc}")
        return []


# ── Session helpers ──────────────────────────────────────────────────────
async def load_session(user_id: int, session_id: str) -> tuple[list[dict], str | None, bool]:
    """
    Load chat history from chat_sessions.
    Returns (messages, title, is_new_session).
    """
    rows = await db_query(
        "SELECT messages, title FROM chat_sessions WHERE user_id=$1 AND session_id=$2",
        user_id, session_id,
    )
    if rows:
        raw = rows[0]["messages"]
        messages = json.loads(raw) if isinstance(raw, str) else list(raw or [])
        return messages, rows[0]["title"], False
    return [], None, True


async def upsert_session(
    user_id: int,
    session_id: str,
    title: str,
    messages: list[dict],
    is_new: bool,
) -> None:
    messages_json = json.dumps(messages, ensure_ascii=False)
    if is_new:
        await db_execute(
            """
            INSERT INTO chat_sessions (user_id, session_id, title, messages, updated_at)
            VALUES ($1, $2, $3, $4::jsonb, NOW())
            """,
            user_id, session_id, title, messages_json,
        )
    else:
        await db_execute(
            """
            UPDATE chat_sessions
            SET messages=$1::jsonb, updated_at=NOW()
            WHERE user_id=$2 AND session_id=$3
            """,
            messages_json, user_id, session_id,
        )
