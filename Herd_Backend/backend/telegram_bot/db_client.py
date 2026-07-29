"""
db_client.py
Semua akses data via Backend FastAPI — endpoint disesuaikan dengan
routers/scanner.py yang sudah ada di sistem.
"""

import re
import httpx
import os
from typing import Optional

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:5000")
DEVICE_API_KEY = os.getenv("DEVICE_API_KEY", "kunci-rahasia-peternakan-123")
TELEGRAM_CHAT_IDS = [x.strip() for x in os.getenv("TELEGRAM_CHAT_IDS", "").split(",") if x.strip()]
DEFAULT_CHAT_ID = TELEGRAM_CHAT_IDS[0] if TELEGRAM_CHAT_IDS else None


def get_headers(chat_id: Optional[str] = None) -> dict:
    """Membangun header otentikasi internal untuk memintas get_current_user"""
    cid = chat_id or DEFAULT_CHAT_ID
    headers = {"x-device-key": DEVICE_API_KEY}
    if cid:
        headers["x-telegram-chat-id"] = cid
    return headers


async def get_hewan_by_query(query: str, chat_id: Optional[str] = None) -> list[dict]:
    """
    Cari hewan by RFID (hex) atau nama (partial).
    Pakai: GET /api/scanner/search?q={query}
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BACKEND_URL}/api/scanner/search",
                params={"q": query},
                headers=get_headers(chat_id),
            )
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            data = resp.json()
            # Extract data array if backend wrapped it inside {"data": [...]}
            if isinstance(data, dict) and "data" in data and isinstance(data["data"], list):
                return data["data"]
            # Endpoint bisa return list atau single dict
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return [data]
            return []
    except Exception as e:
        print(f"❌ [DB] get_hewan_by_query error: {e}")
        return []


async def get_hewan_by_id(hewan_id: str, chat_id: Optional[str] = None) -> dict | None:
    """
    Ambil profil lengkap hewan + reproduksi terbaru.
    Pakai: GET /api/scanner/profil/{hewan_id}
    Return field gabungan: hewan + repro dalam satu dict.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BACKEND_URL}/api/scanner/profil/{hewan_id}",
                headers=get_headers(chat_id),
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and "hewan" in data:
                hewan_part = data.get("hewan") or {}
                repro_part = data.get("reproduksi_terbaru") or {}
                merged = {**hewan_part}
                for k, v in repro_part.items():
                    if k != "id":
                        merged[k] = v
                return merged
            return data
    except Exception as e:
        print(f"❌ [DB] get_hewan_by_id error: {e}")
        return None


async def get_repro_latest(rfid: str, chat_id: Optional[str] = None) -> dict | None:
    """
    Ambil data reproduksi terbaru untuk satu hewan.
    Pakai: GET /api/scanner/profil/{rfid}  (field repro sudah disertakan)
    Return hanya bagian reproduksi-nya saja.
    """
    try:
        data = await get_hewan_by_id(rfid, chat_id)
        if not data:
            return None
        # Endpoint profil/{rfid} sudah return data gabungan hewan + repro.
        # Ekstrak field-field reproduksi saja.
        repro_keys = {"tanggal_ib", "pemberi_ib", "jumlah_ib",
                      "bunting", "hpl", "sapih", "birahi", "catatan"}
        return {k: data.get(k) for k in repro_keys}
    except Exception as e:
        print(f"❌ [DB] get_repro_latest error: {e}")
        return None


async def get_riwayat_reproduksi(rfid: str, limit: int = 3, chat_id: Optional[str] = None) -> list[dict]:
    """
    Ambil riwayat reproduksi (beberapa row).
    Pakai: GET /api/scanner/reproduksi/{rfid}  (backend default limit 3)
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BACKEND_URL}/api/scanner/reproduksi/{rfid}",
                params={"limit": limit},
                headers=get_headers(chat_id),
            )
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data if isinstance(data, list) else []
    except Exception as e:
        print(f"❌ [DB] get_riwayat_reproduksi error: {e}")
        return []


async def get_riwayat_count(rfid: str, chat_id: Optional[str] = None) -> int:
    rows = await get_riwayat_reproduksi(rfid, limit=100, chat_id=chat_id)
    return len(rows)


async def check_hewan_exists(hewan_id: str, chat_id: Optional[str] = None) -> bool:
    data = await get_hewan_by_id(hewan_id, chat_id)
    return data is not None


async def get_available_collars(chat_id: Optional[str] = None) -> list[dict]:
    """
    Ambil daftar collar yang belum dipasangkan.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BACKEND_URL}/api/scanner/collars/available",
                headers=get_headers(chat_id),
            )
            if resp.status_code in (404, 405):
                return []
            resp.raise_for_status()
            return resp.json() or []
    except Exception:
        return []