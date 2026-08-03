import redis.asyncio as redis
import json
import os

redis_url    = os.getenv("REDIS_URL", "redis://redis:6379/0")
redis_client = redis.from_url(redis_url, decode_responses=True)


async def set_user_state(chat_id: str, state: dict, ttl: int = 3600):
    await redis_client.setex(f"tg_state:{chat_id}", ttl, json.dumps(state))


async def get_user_state(chat_id: str) -> dict | None:
    val = await redis_client.get(f"tg_state:{chat_id}")
    return json.loads(val) if val else None


async def clear_user_state(chat_id: str):
    await redis_client.delete(f"tg_state:{chat_id}")


async def update_user_state(chat_id: str, updates: dict, ttl: int = 3600):
    """Merge updates ke state yang sudah ada tanpa overwrite seluruhnya."""
    existing = await get_user_state(chat_id) or {}
    existing.update(updates)
    await set_user_state(chat_id, existing, ttl)