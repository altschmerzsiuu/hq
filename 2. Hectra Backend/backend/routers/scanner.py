from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
import os
import logging
from auth_routes import get_current_user
from prediction_engine import update_siklus_setelah_event

logger = logging.getLogger(__name__)

def get_effective_owner_id(current_user: dict) -> int:
    return current_user.get("parent_id") or current_user["id"]

def safe_error(e: Exception, context: str = "operasi") -> HTTPException:
    logger.error(f"[Hectra Error] {context}: {type(e).__name__}: {str(e)}")
    err_str = str(e).lower()
    if "unique" in err_str or "duplicate key" in err_str:
        return HTTPException(status_code=400, detail="Data dengan ID tersebut sudah ada.")
    if "foreign key" in err_str or "violates foreign key" in err_str:
        return HTTPException(status_code=400, detail="Data referensi tidak ditemukan.")
    if "not null" in err_str or "null value" in err_str:
        return HTTPException(status_code=400, detail="Ada field wajib yang belum diisi.")
    if "connection" in err_str or "timeout" in err_str:
        return HTTPException(status_code=503, detail="Koneksi database sedang bermasalah. Coba lagi.")
    if "permission denied" in err_str:
        return HTTPException(status_code=403, detail="Akses ditolak.")
    return HTTPException(status_code=500, detail="Terjadi kesalahan internal. Tim teknis telah diberitahu.")

router = APIRouter(prefix="/api/scanner", tags=["Scanner API"])

# Fetch device key from env
DEVICE_API_KEY = os.getenv("DEVICE_API_KEY", "your-device-key-here")

# === DB Dependency =============================
async def get_db_pool(request: Request):
    return request.app.state.db_pool

def verify_device(x_device_key: str = Header(...)):
    if x_device_key != DEVICE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid Device Key")

# === Business Logic ============================
def hitung_bunting_hpl(birahi: date):
    if not birahi: return None, None
    bunting = birahi + relativedelta(months=3)
    hpl = bunting + relativedelta(months=9) + timedelta(days=10)
    return bunting, hpl

def hitung_usia(bulan_tahun_lahir) -> Optional[dict]:
    if not bulan_tahun_lahir: return None
    
    # Ensure it is a date object (could be string or datetime from DB)
    if isinstance(bulan_tahun_lahir, str):
        try:
            from datetime import datetime
            if '-' in bulan_tahun_lahir:
                bulan_tahun_lahir = datetime.strptime(bulan_tahun_lahir, '%Y-%m-%d').date()
            elif '/' in bulan_tahun_lahir:
                bulan_tahun_lahir = datetime.strptime(bulan_tahun_lahir, '%d/%m/%Y').date()
            else:
                return None
        except:
            return None
    elif hasattr(bulan_tahun_lahir, 'date'): # if it is a datetime
        bulan_tahun_lahir = bulan_tahun_lahir.date()
        
    today = date.today()
    delta = relativedelta(today, bulan_tahun_lahir)
    return {
        "tahun": delta.years,
        "bulan": delta.months,
        "total_bulan": delta.years * 12 + delta.months,
        "display": f"{delta.years} tahun {delta.months} bulan" if delta.years > 0 else f"{delta.months} bulan"
    }

# === Pydantic Models ===========================
class ProfilCreate(BaseModel):
    id: str  # RFID
    nama: str
    jenis: str
    bulan_tahun_lahir: date
    status_kesehatan: str

class ReproduksiCreate(BaseModel):
    rfid: str
    tanggal_ib: Optional[date] = None
    pemberi_ib: Optional[str] = None
    jumlah_ib: Optional[int] = None
    birahi: Optional[date] = None
    bunting: Optional[date] = None
    hpl: Optional[date] = None
    sapih: Optional[date] = None
    catatan: Optional[str] = None

class EditHewanRequest(BaseModel):
    nama: Optional[str] = None
    jenis: Optional[str] = None
    bulan_tahun_lahir: Optional[date] = None
    kesehatan: Optional[str] = None
    # Repro fields
    tanggal_ib: Optional[date] = None
    pemberi_ib: Optional[str] = None
    jumlah_ib: Optional[int] = None
    birahi: Optional[date] = None
    bunting: Optional[date] = None
    hpl: Optional[date] = None
    sapih: Optional[date] = None
    catatan: Optional[str] = None

class ScanRFIDRequest(BaseModel):
    uid: str
    source: Optional[str] = "esp32-scanner"

class PairCollarRequest(BaseModel):
    rfid: str
    collar_id: str

# === Endpoints: Profil Hewan ===================

@router.get("/profil")
async def get_all_profil(request: Request, skip: int = 0, limit: int = 50, current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    db = request.app.state.db_pool
    try:
        async with db.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT h.*,
                  EXTRACT(YEAR FROM AGE(NOW(), 
                    CASE 
                      WHEN h.bulan_tahun_lahir LIKE '%-%' THEN TO_DATE(h.bulan_tahun_lahir, 'YYYY-MM-DD')
                      WHEN h.bulan_tahun_lahir LIKE '%/%' THEN TO_DATE(h.bulan_tahun_lahir, 'DD/MM/YYYY')
                      ELSE NULL
                    END
                  )) * 12 +
                  EXTRACT(MONTH FROM AGE(NOW(), 
                    CASE 
                      WHEN h.bulan_tahun_lahir LIKE '%-%' THEN TO_DATE(h.bulan_tahun_lahir, 'YYYY-MM-DD')
                      WHEN h.bulan_tahun_lahir LIKE '%/%' THEN TO_DATE(h.bulan_tahun_lahir, 'DD/MM/YYYY')
                      ELSE NULL
                    END
                  )) AS usia_bulan
                FROM hewan h
                WHERE h.owner_id = $1
                ORDER BY h.nama ASC
                LIMIT $2 OFFSET $3
                """,
                owner_id, limit, skip
            )
            data = [dict(r) for r in rows]
            from datetime import date, datetime
            for item in data:
                item['usia'] = hitung_usia(item.get('bulan_tahun_lahir'))
                for k, v in item.items():
                    if isinstance(v, (date, datetime)):
                        item[k] = v.isoformat()
            return {"data": data, "skip": skip, "limit": limit}
    except Exception as e:
        raise safe_error(e, "fetch semua profil")

@router.get("/profil/{rfid}")
async def get_profil_by_rfid(rfid: str, request: Request, current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    db = request.app.state.db_pool
    try:
        async with db.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM hewan WHERE UPPER(id) = UPPER($1) AND owner_id = $2", rfid, owner_id)
            if not row:
                raise HTTPException(status_code=404, detail="Sapi tidak ditemukan.")
            
            repro = await conn.fetchrow("SELECT * FROM reproduksi_ternak WHERE UPPER(rfid) = UPPER($1) ORDER BY tanggal_ib DESC LIMIT 1", rfid)
            
            hewan_dict = dict(row)
            hewan_dict['usia'] = hitung_usia(hewan_dict.get('bulan_tahun_lahir'))
            repro_dict = dict(repro) if repro else {}
            
            from datetime import date, datetime
            for d in [hewan_dict, repro_dict]:
                for k, v in d.items():
                    if isinstance(v, (date, datetime)):
                        d[k] = v.isoformat()
            
            return {"hewan": hewan_dict, "reproduksi_terbaru": repro_dict}
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error(e, f"fetch profil {rfid}")

@router.post("/profil", status_code=201)
async def tambah_profil(data: ProfilCreate, request: Request, current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    db = request.app.state.db_pool
    try:
        async with db.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO hewan (id, nama, jenis, bulan_tahun_lahir, status_kesehatan, owner_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                data.id.upper(), data.nama, data.jenis,
                data.bulan_tahun_lahir.isoformat() if data.bulan_tahun_lahir else None, data.status_kesehatan, owner_id
            )
        return {"success": True, "message": "Sapi berhasil didaftarkan.", "rfid": data.id.upper()}
    except Exception as e:
        raise safe_error(e, f"tambah profil {data.id}")

@router.put("/hewan/{rfid}/edit-full")
async def edit_hewan_full(rfid: str, data: EditHewanRequest, request: Request, current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    db = request.app.state.db_pool
    try:
        async with db.acquire() as conn:
            existing = await conn.fetchrow("SELECT id FROM hewan WHERE UPPER(id) = UPPER($1) AND owner_id = $2", rfid, owner_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Sapi tidak ditemukan atau bukan milik farm Anda.")
            
            if any([data.nama, data.jenis, data.bulan_tahun_lahir, data.kesehatan]):
                await conn.execute(
                    """
                    UPDATE hewan SET
                        nama = COALESCE($1, nama),
                        jenis = COALESCE($2, jenis),
                        bulan_tahun_lahir = COALESCE($3, bulan_tahun_lahir),
                        status_kesehatan = COALESCE($4, status_kesehatan)
                    WHERE UPPER(id) = UPPER($5)
                    """,
                    data.nama, data.jenis,
                    data.bulan_tahun_lahir.isoformat() if data.bulan_tahun_lahir else None,
                    data.kesehatan, rfid
                )
            
            repro_fields = [data.tanggal_ib, data.pemberi_ib, data.jumlah_ib, data.birahi, data.bunting, data.hpl, data.sapih, data.catatan]
            
            if any(f is not None for f in repro_fields):
                existing_repro = await conn.fetchrow("SELECT id FROM reproduksi_ternak WHERE UPPER(rfid) = UPPER($1) ORDER BY tanggal_ib DESC LIMIT 1", rfid)
                
                # Handle Repro Logic & Feed AI logic
                if data.birahi and not data.bunting and not data.hpl:
                    bunting, hpl = hitung_bunting_hpl(data.birahi)
                    data.bunting = bunting
                    data.hpl = hpl
                    
                if existing_repro:
                    await conn.execute(
                        """
                        UPDATE reproduksi_ternak SET
                            tanggal_ib = COALESCE($1, tanggal_ib), pemberi_ib = COALESCE($2, pemberi_ib),
                            jumlah_ib  = COALESCE($3, jumlah_ib), birahi = COALESCE($4, birahi),
                            bunting = COALESCE($5, bunting), hpl = COALESCE($6, hpl),
                            sapih = COALESCE($7, sapih), catatan = COALESCE($8, catatan)
                        WHERE rfid = $9 AND id = $10
                        """,
                        data.tanggal_ib, data.pemberi_ib, data.jumlah_ib, data.birahi, data.bunting, data.hpl, data.sapih, data.catatan, rfid.upper(), existing_repro["id"]
                    )
                else:
                    await conn.execute(
                        """
                        INSERT INTO reproduksi_ternak (rfid, tanggal_ib, pemberi_ib, jumlah_ib, birahi, bunting, hpl, sapih, catatan)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                        """,
                        rfid.upper(), data.tanggal_ib, data.pemberi_ib, data.jumlah_ib, data.birahi, data.bunting, data.hpl, data.sapih, data.catatan
                    )
                

        return {"success": True, "message": "Data sapi berhasil diperbarui."}
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error(e, f"edit hewan {rfid}")

@router.delete("/hewan/{rfid}")
async def hapus_hewan(rfid: str, request: Request, current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    db = request.app.state.db_pool
    try:
        async with db.acquire() as conn:
            existing = await conn.fetchrow("SELECT id FROM hewan WHERE UPPER(id) = UPPER($1) AND owner_id = $2", rfid, owner_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Sapi tidak ditemukan atau bukan milik farm Anda.")
            # Manually delete orphans in tables without cascade
            await conn.execute("DELETE FROM siklus_individu WHERE UPPER(rfid) = UPPER($1)", rfid)
            await conn.execute("DELETE FROM prediksi_birahi WHERE UPPER(rfid) = UPPER($1)", rfid)
            await conn.execute("DELETE FROM notifications WHERE UPPER(cow_id) = UPPER($1)", rfid)
            # Delete from master table
            await conn.execute("DELETE FROM hewan WHERE UPPER(id) = UPPER($1)", rfid)
        return {"success": True, "message": "Data sapi berhasil dihapus."}
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error(e, f"hapus hewan {rfid}")


# === Endpoints: Reproduksi Ternak =================

@router.post("/reproduksi", status_code=201)
async def tambah_reproduksi(data: ReproduksiCreate, request: Request, current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    db = request.app.state.db_pool
    try:
        async with db.acquire() as conn:
            owner_check = await conn.fetchrow("SELECT id FROM hewan WHERE UPPER(id) = UPPER($1) AND owner_id = $2", data.rfid, owner_id)
            if not owner_check:
                raise HTTPException(status_code=404, detail="Sapi tidak ditemukan atau bukan milik farm Anda.")
            
            if data.birahi and not data.bunting and not data.hpl:
                bunting, hpl = hitung_bunting_hpl(data.birahi)
                data.bunting = bunting
                data.hpl = hpl
                
            await conn.execute(
                """
                INSERT INTO reproduksi_ternak (rfid, tanggal_ib, pemberi_ib, jumlah_ib, birahi, bunting, hpl, sapih, catatan)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                """,
                data.rfid.upper(), data.tanggal_ib, data.pemberi_ib, data.jumlah_ib, data.birahi, data.bunting, data.hpl, data.sapih, data.catatan
            )

            await update_siklus_setelah_event (
                conn, data.rfid.upper(), owner_id, "birahi", data.birahi
            )

        return {"success": True, "message": "Data reproduksi berhasil disimpan.", "auto_calculated": {"bunting": data.bunting, "hpl": data.hpl}}
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error(e, f"tambah reproduksi {data.rfid}")

@router.get("/reproduksi/{rfid}")
async def get_reproduksi_history(rfid: str, request: Request, current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    db = request.app.state.db_pool
    try:
        async with db.acquire() as conn:
            owner_check = await conn.fetchrow("SELECT id FROM hewan WHERE UPPER(id) = UPPER($1) AND owner_id = $2", rfid, owner_id)
            if not owner_check:
                raise HTTPException(status_code=404, detail="Sapi tidak ditemukan atau bukan milik farm Anda.")
            rows = await conn.fetch("SELECT * FROM reproduksi_ternak WHERE UPPER(rfid) = UPPER($1) ORDER BY tanggal_ib DESC LIMIT 3", rfid)
            
            data = [dict(r) for r in rows]
            from datetime import date, datetime
            for item in data:
                for k, v in item.items():
                    if isinstance(v, (date, datetime)):
                        item[k] = v.isoformat()
                        
            return {"data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error(e, f"get reproduksi {rfid}")

@router.delete("/reproduksi/{rfid}")
async def hapus_reproduksi(rfid: str, request: Request, current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    db = request.app.state.db_pool
    try:
        async with db.acquire() as conn:
            owner_check = await conn.fetchrow("SELECT id FROM hewan WHERE UPPER(id) = UPPER($1) AND owner_id = $2", rfid, owner_id)
            if not owner_check:
                raise HTTPException(status_code=404, detail="Sapi tidak ditemukan atau bukan milik farm Anda.")
            await conn.execute("DELETE FROM reproduksi_ternak WHERE UPPER(rfid) = UPPER($1)", rfid)
        return {"success": True, "message": "Riwayat reproduksi berhasil dihapus."}
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error(e, f"hapus reproduksi {rfid}")


# === Endpoints: ESP32 & Collar Pairing ============

@router.post("/scan-rfid", dependencies=[Depends(verify_device)])
async def scan_rfid(req: ScanRFIDRequest, db=Depends(get_db_pool)):
    import json
    async with db.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM hewan WHERE UPPER(id) = UPPER($1)", req.uid)
        
        hewan = None
        repro_dict = None
        
        if row:
            hewan = dict(row)
            hewan['usia'] = hitung_usia(hewan.get('bulan_tahun_lahir'))
            for k, v in hewan.items():
                if isinstance(v, date):
                    hewan[k] = v.isoformat()
                
            repro = await conn.fetchrow("SELECT * FROM reproduksi_ternak WHERE UPPER(rfid) = UPPER($1) ORDER BY tanggal_ib DESC LIMIT 1", req.uid)
            repro_dict = dict(repro) if repro else None
            if repro_dict:
                for k, v in repro_dict.items():
                    if isinstance(v, date):
                        repro_dict[k] = v.isoformat()
        
        # 1. Broadcast to Web App WebSockets via Postgres pg_notify
        payload = {
            "type": "rfid_scan",
            "uid": req.uid,
            "found": True if row else False,
            "hewan": hewan,
            "reproduksi": repro_dict,
            "message": "RFID tidak terdaftar di sistem." if not row else None
        }
        await conn.execute("SELECT pg_notify('ws_events', $1)", json.dumps(payload))
        
        # 2. Broadcast to Telegram users who are currently in "Scan RFID" mode
        try:
            from telegram_bot.state import redis_client
            from telegram_bot.bot import bot_application
            import asyncio
            
            # Search Redis keys for tg_state:*
            keys = await redis_client.keys("tg_state:*")
            for key in keys:
                chat_id = key.split(":")[-1]
                state_json = await redis_client.get(key)
                if state_json:
                    state = json.loads(state_json)
                    if state.get("mode") == "scan":
                        from telegram_bot.state import update_user_state
                        
                        if row:
                            from telegram_bot.helpers import build_profil_text
                            # Update Redis state immediately so the bot knows which cow is active
                            await update_user_state(chat_id, {"id_hewan": req.uid})
                            text = build_profil_text(hewan, repro_dict, judul="🧩 <b>Data ditemukan!</b>")
                        else:
                            # Update Redis state immediately so the bot knows the scanned UID
                            await update_user_state(chat_id, {"uid": req.uid})
                            text = (
                                f"⚠️ Tidak ditemukan data untuk UID: {req.uid}\n"
                                f"Mau mendaftarkan hewan baru?"
                            )
                        
                        if bot_application:
                            from telegram import ReplyKeyboardMarkup
                            
                            async def send_tg_broadcast(chat_id_arg, text_arg, is_found):
                                try:
                                    if is_found:
                                        # Send cow profile message first with inline Edit and Hapus buttons
                                        from telegram import InlineKeyboardButton, InlineKeyboardMarkup
                                        inline_markup = InlineKeyboardMarkup([
                                            [InlineKeyboardButton("✏️ Edit", callback_data=f"edit_{req.uid}")],
                                            [InlineKeyboardButton("🗑 Hapus", callback_data=f"delete_{req.uid}")]
                                        ])
                                        await bot_application.bot.send_message(
                                            chat_id=chat_id_arg,
                                            text=text_arg,
                                            parse_mode="HTML",
                                            reply_markup=inline_markup
                                        )
                                        # Send interactive follow-up menu keyboard
                                        markup = ReplyKeyboardMarkup(
                                            [["➕ Tambah Reproduksi", "📂 Lihat Riwayat Reproduksi"], ["🔙 Kembali"]],
                                            resize_keyboard=True,
                                            one_time_keyboard=True
                                        )
                                        await bot_application.bot.send_message(
                                            chat_id=chat_id_arg,
                                            text="💭 Pilih menu dulu, yuk!",
                                            reply_markup=markup
                                        )
                                    else:
                                        # Send unregistered card question with direct register button
                                        markup = ReplyKeyboardMarkup(
                                            [["➕ Tambah Hewan", "🔙 Kembali"]],
                                            resize_keyboard=True,
                                            one_time_keyboard=True
                                        )
                                        await bot_application.bot.send_message(
                                            chat_id=chat_id_arg,
                                            text=text_arg,
                                            reply_markup=markup
                                        )
                                except Exception as tg_err:
                                    print(f"❌ [TELEGRAM BROADCAST SEND ERROR] {tg_err}")
                            
                            asyncio.create_task(send_tg_broadcast(chat_id, text, bool(row)))
        except Exception as te:
            print(f"❌ [TELEGRAM BROADCAST ERROR] {te}")
            
        if not row:
            return {"found": False, "message": "RFID tidak terdaftar di sistem."}
            
        return {
            "found": True,
            "hewan": hewan,
            "reproduksi": repro_dict
        }

@router.get("/collars/unpaired")
async def get_unpaired_collars(request: Request, current_user: dict = Depends(get_current_user)):
    db = request.app.state.db_pool
    try:
        async with db.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT DISTINCT collar_id FROM sensor_data
                WHERE collar_id IS NOT NULL
                AND collar_id NOT IN (
                    SELECT collar_id FROM hewan WHERE collar_id IS NOT NULL
                )
                ORDER BY collar_id ASC
                """
            )
        return {"data": [r["collar_id"] for r in rows]}
    except Exception as e:
        raise safe_error(e, "fetch unpaired collars")

@router.post("/collars/pair")
async def pair_collar(req: PairCollarRequest, request: Request, current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    db = request.app.state.db_pool
    try:
        async with db.acquire() as conn:
            owner_check = await conn.fetchrow("SELECT id FROM hewan WHERE UPPER(id) = UPPER($1) AND owner_id = $2", req.rfid, owner_id)
            if not owner_check:
                raise HTTPException(status_code=404, detail="Sapi tidak ditemukan.")
            cow_id = owner_check['id']
            await conn.execute("UPDATE hewan SET collar_id = $1 WHERE id = $2", req.collar_id, cow_id)
            await conn.execute("UPDATE collar_registry SET cow_id = $1 WHERE UPPER(collar_id) = UPPER($2)", cow_id, req.collar_id)
        return {"success": True, "message": f"Collar {req.collar_id} berhasil dipasangkan."}
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error(e, f"pair collar {req.rfid}")

@router.delete("/collars/unpair/{rfid}")
async def unpair_collar(rfid: str, request: Request, current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    db = request.app.state.db_pool
    try:
        async with db.acquire() as conn:
            owner_check = await conn.fetchrow("SELECT id, collar_id FROM hewan WHERE UPPER(id) = UPPER($1) AND owner_id = $2", rfid, owner_id)
            if not owner_check:
                raise HTTPException(status_code=404, detail="Sapi tidak ditemukan.")
            if not owner_check["collar_id"]:
                raise HTTPException(status_code=400, detail="Sapi ini belum memiliki collar.")
            cow_id = owner_check['id']
            await conn.execute("UPDATE hewan SET collar_id = NULL WHERE id = $1", cow_id)
            await conn.execute("UPDATE collar_registry SET cow_id = NULL WHERE cow_id = $1", cow_id)
        return {"success": True, "message": "Collar berhasil dilepas."}
    except HTTPException:
        raise
    except Exception as e:
        raise safe_error(e, f"unpair collar {rfid}")


# === Endpoints: Search ============================

@router.get("/search")
async def search_hewan(q: str, request: Request, current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    db = request.app.state.db_pool
    try:
        async with db.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM hewan WHERE owner_id = $1 AND (nama ILIKE $2 OR id ILIKE $2)", owner_id, f"%{q}%")
            results = []
            for r in rows:
                d = dict(r)
                d['usia'] = hitung_usia(d.get('bulan_tahun_lahir'))
                results.append(d)
            return {"data": results}
    except Exception as e:
        raise safe_error(e, f"search hewan {q}")

