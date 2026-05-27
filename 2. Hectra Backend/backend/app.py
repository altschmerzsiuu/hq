from fastapi import FastAPI, HTTPException, Depends, Body, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from typing import Optional, List
import asyncpg
import paho.mqtt.client as mqtt
import asyncio
import joblib
import requests  # type: ignore
import json
import bcrypt
import os
import numpy as np
import logging
from datetime import datetime, UTC, timedelta, timezone, date
from dotenv import load_dotenv
import threading
from auth_routes import get_current_user

# ── Logging Setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)
from notifier import send_estrus_alert, send_anomaly_alert, send_daily_summary
from mailer import (
    send_daily_summary_email,
    send_estrus_alert_email,
    send_monthly_report_email,
    send_breeding_reminder_email,
    send_birth_reminder_email,
)
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from worker import enqueue_task

# Import routers (modular approach)
from auth_routes import router as auth_router
from profile_routes import router as profile_router
from chat_routes import router as chat_router
from report_routes import router as report_router
from routers.estrus_report import router as estrus_report_router
from routers.scanner import router as scanner_router
from telegram_bot.bot import start_telegram_bot, stop_telegram_bot

# Load environment variables
load_dotenv()

# Load ML Models
try:
    svm_model = joblib.load("models/svm_estrus_sensor.joblib")
    xgb_model = joblib.load("models/xgb_estrus_historical.joblib")
    THRESHOLD = 0.75
    XGB_WEIGHT = 0.65
    SVM_WEIGHT = 0.35
    print("[ML] Models loaded successfully.")
except Exception as e:
    print(f"[ML ERROR] Failed to load models: {e}")
    svm_model = None
    xgb_model = None

from prediction_engine import ModelRegistry, run_hybrid_prediction
if svm_model and xgb_model:
    ModelRegistry.set_models(xgb_model, svm_model)

# Konfigurasi Timezone (WITA = UTC+8 untuk Balikpapan)
WITA = timezone(timedelta(hours=8))

# Database Configuration
DB_CONFIG = {
    "host": os.getenv('DB_HOST', 'db'),
    "port": int(os.getenv('DB_PORT', 5432)),
    "database": os.getenv('DB_NAME', 'Collar_to_Gateway'),
    "user": os.getenv('DB_USER', 'postgres'),
    "password": os.getenv('DB_PASSWORD', 'postgre')
}

# MQTT Configuration
MQTT_BROKER_URL = os.getenv('MQTT_BROKER_URL', 'mqtt')
MQTT_BROKER_PORT = int(os.getenv('MQTT_BROKER_PORT', 1883))
MQTT_TOPIC = "kandang/sensor"

# Telegram Configuration
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_IDS = [x.strip() for x in os.getenv('TELEGRAM_CHAT_IDS', '').split(',') if x.strip()]

# FastAPI Application
app = FastAPI(title="IoT Peternakan API", version="2.0.0")

# Consolidated Owner ID helper
def get_effective_owner_id(user: dict) -> int:
    """Get either the user's ID or their parent's ID (the Farm Owner)"""
    eff_id = user.get('parent_id') or user.get('id')
    # Use standard print for terminal visibility
    print(f"📡 [DATA ISOLATION] User Email: {user.get('email')} | ID: {user.get('id')} | Parent: {user.get('parent_id')} | Effective Owner: {eff_id}")
    return int(eff_id) if eff_id is not None else 0

# CORS Configuration - Permissive for Dev/Local Device Testing
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174"], 
    allow_origin_regex="https?://.*",  # Allows any local network IP / port with credentials enabled
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(report_router)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(chat_router) 
app.include_router(estrus_report_router, prefix="/api")
app.include_router(scanner_router)

# ── Global Exception Handlers ─────────────────────────────────────────────────

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """
    Sanitasi 422 Pydantic validation error — tidak expose raw field names/internal ke client.
    Field names di-map ke label bahasa Indonesia yang ramah user.
    """
    logger.warning(f"[Validation Error] {request.method} {request.url}: {exc.errors()}")

    _FIELD_LABELS = {
        "bulan_tahun_lahir": "Tanggal Lahir",
        "tanggal_ib": "Tanggal IB",
        "birahi": "Tanggal Birahi",
        "bunting": "Tanggal Bunting",
        "hpl": "HPL",
        "sapih": "Tanggal Sapih",
        "id": "RFID",
        "nama": "Nama Sapi",
        "jenis": "Jenis Sapi",
        "status_kesehatan": "Status Kesehatan",
        "rfid": "RFID",
        "pemberi_ib": "Pemberi IB",
        "jumlah_ib": "Jumlah IB",
        "catatan": "Catatan",
        "email": "Email",
        "password": "Password",
        "uid": "UID Scanner",
    }

    messages = []
    for error in exc.errors():
        field = error["loc"][-1] if error.get("loc") else "data"
        label = _FIELD_LABELS.get(str(field), str(field))
        msg_type = error.get("type", "")

        if "missing" in msg_type:
            messages.append(f"{label} wajib diisi.")
        elif "date" in msg_type or "datetime" in msg_type:
            messages.append(f"{label}: format tanggal tidak valid (gunakan YYYY-MM-DD).")
        elif "int" in msg_type or "integer" in msg_type:
            messages.append(f"{label} harus berupa angka.")
        elif "string" in msg_type:
            messages.append(f"{label} tidak valid.")
        else:
            messages.append(f"{label}: input tidak valid.")

    detail_msg = " | ".join(messages) if messages else "Data yang dikirim tidak valid."
    return JSONResponse(status_code=422, content={"detail": detail_msg})


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """
    Tangkap semua unhandled exception — JANGAN expose str(exc) ke client.
    Log detail asli di server untuk debugging.
    """
    logger.error(
        f"[Unhandled Error] {request.method} {request.url} | "
        f"{type(exc).__name__}: {str(exc)}"
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Terjadi kesalahan internal. Tim teknis telah diberitahu."}
    )

# Database Connection Pool
db_pool: Optional[asyncpg.Pool] = None

# MQTT Client
mqtt_client = None

class ScannerRequest(BaseModel):
    uid: str
    device_secret: str
    chatId: Optional[str] = None

# ==========================
# DATABASE FUNCTIONS
# ==========================

async def get_db_pool() -> asyncpg.Pool:
    """Get or create database connection pool"""
    global db_pool
    if db_pool is None:
        db_pool = await asyncpg.create_pool(**DB_CONFIG, min_size=2, max_size=10)
        app.state.db_pool = db_pool  # Standard FastAPI state attachment
    assert db_pool is not None
    return db_pool

async def close_db_pool():
    """Close database connection pool"""
    global db_pool
    if db_pool:
        await db_pool.close()
        db_pool = None

async def db_query(query: str, *args):
    """Execute a query and return rows"""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)

async def db_execute(query: str, *args):
    """Execute a query (INSERT/UPDATE/DELETE)"""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)

# ==========================
# WEBSOCKETS & REAL-TIME
# ==========================

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        json_msg = json.dumps(message)
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json_msg)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)

ws_manager = ConnectionManager()

async def listen_to_pg_notifications():
    """Background task to listen to Postgres NOTIFY and broadcast to WebSockets"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        async def notification_handler(connection, pid, channel, payload):
            try:
                data = json.loads(payload)
                await ws_manager.broadcast(data)
            except Exception as e:
                print(f"❌ [WS ERROR] Failed to broadcast: {e}")

        await conn.add_listener('ws_events', notification_handler)
        print("✅ [WS] Listening to Postgres channel 'ws_events'")
        
        while True:
            await asyncio.sleep(3600)  # Keep connection alive
    except Exception as e:
        print(f"❌ [PG LISTEN ERROR] {e}")

scheduler = AsyncIOScheduler()

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

# ==========================
# TELEGRAM FUNCTIONS
# ==========================

def send_telegram_alert(message):
    """Send Telegram alert to configured chat IDs"""
    if not TELEGRAM_BOT_TOKEN:
        print("[TELEGRAM] Token not found, skipping.")
        return
    
    for chat_id in TELEGRAM_CHAT_IDS:
        if not chat_id:
            continue
        
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML"
        }
        try:
            resp = requests.post(url, json=payload, timeout=5)
            if resp.status_code == 200:
                print(f"[TELEGRAM] Alert sent to {chat_id}")
            else:
                print(f"[TELEGRAM] Failed to send to {chat_id}: {resp.text}")
        except Exception as e:
            print(f" [TELEGRAM ERROR] {str(e)}")

# ==========================
# DEVICE VERIFICATION
# ==========================

def verify_hmac_signature(raw_payload: str, secret_key: str, signature_to_check: str) -> bool:
    auth_marker = ',"auth":"'
    idx = raw_payload.rfind(auth_marker)
    if idx == -1:
        return False
    signed_part = raw_payload[:idx]
    
    import hmac, hashlib
    computed_hmac = hmac.new(
        secret_key.encode('utf-8'),
        signed_part.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(computed_hmac, signature_to_check)

async def verify_device(collar_id: str, device_secret: Optional[str] = None, auth_signature: Optional[str] = None, raw_payload: Optional[str] = None):
    """Verify device credentials using Bcrypt or HMAC-SHA256"""
    pool = await get_db_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT device_secret_hash, device_secret, status, kandang_id 
                FROM collar_registry 
                WHERE collar_id = $1
            """, collar_id)
            
            if not row:
                return False, "UNKNOWN_DEVICE", None
            
            secret_hash, plain_secret, status, kandang_id = row['device_secret_hash'], row['device_secret'], row['status'], row['kandang_id']
            
            if status != 'ACTIVE':
                return False, f"DEVICE_{status}", None

            # Case 1: HMAC Signature Verification (Production)
            if auth_signature and raw_payload:
                if not plain_secret:
                    print(f"❌ [HMAC ERROR] Plain device_secret not found in DB for {collar_id}")
                    return False, "MISSING_PLAIN_SECRET", None
                if verify_hmac_signature(raw_payload, plain_secret, auth_signature):
                    return True, "OK", kandang_id
                else:
                    print(f"❌ [SECURITY] HMAC verification failed for {collar_id}")
                    return False, "INVALID_SIGNATURE", None

            # Case 2: Legacy Bcrypt Verification (Backup)
            elif device_secret:
                pwd_bytes = device_secret.strip().encode('utf-8')
                hash_bytes = secret_hash.strip().encode('utf-8')

                if bcrypt.checkpw(pwd_bytes, hash_bytes):
                    return True, "OK", kandang_id
                    
                print(f"[SECURITY] Bcrypt validation failed for {collar_id}")
                return False, "INVALID_SECRET", None
                
            return False, "MISSING_CREDENTIALS", None
    except Exception as e:
        print(f" ❌ [DB VERIFY ERROR] {str(e)}")
        return False, "DB_ERROR", None

def run_hybrid_prediction(mean_z, rms_z, max_z, temperature,
                           days_since_estrus, cycle_avg, parity):
    if svm_model is None or xgb_model is None:
        print("[ML WARNING] Models not loaded. Returning fallback probability 0.0")
        return 0.0, 0.0, 0.0
    svm_prob = float(svm_model.predict_proba(
        [[mean_z, rms_z, max_z, temperature]])[0, 1])
    xgb_prob = float(xgb_model.predict_proba(
        [[days_since_estrus, cycle_avg, parity, 5.0, abs(mean_z)]])[0, 1])
    hybrid = (XGB_WEIGHT * xgb_prob) + (SVM_WEIGHT * svm_prob)
    return svm_prob, xgb_prob, hybrid

# ==========================
# SAVE SENSOR DATA
# ==========================

async def save_sensor(data: dict, kandang_id: Optional[str] = None):
    """Save sensor data to database"""
    pool = await get_db_pool()
    try:
        async with pool.acquire() as conn:
            # Parse Device Timestamp (Sudah dibantu offset oleh Collar)
            ts_epoch = data.get('timestamp')
            # Safety: Jika epoch di bawah tahun 2024 (1704067200), berarti NTP alat gagal.
            # Kita pakai jam server saja.
            if ts_epoch and ts_epoch > 1704067200:
                batch_ts = datetime.fromtimestamp(ts_epoch, UTC).replace(tzinfo=None)
            else:
                batch_ts = datetime.now(WITA).replace(tzinfo=None)

            now = datetime.now(WITA).replace(tzinfo=None)
            
            await conn.execute("""
                INSERT INTO sensor_data 
                (kandang_id, collar_id, mean_z, rms_z, max_z, temperature, 
                 activity_state, estrus_detected, battery_voltage, battery_percent, batch_ts, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            """,
                kandang_id,
                data['collar_id'],
                data.get('mean_z', 0.0),
                data.get('rms_z', 0.0),
                data.get('max_z', 0.0),
                data.get('temperature', 0.0),
                data.get('activity_state', 'UNKNOWN'),
                data.get('estrus_code', 0),
                data.get('battery_voltage', 0.0),
                data.get('battery_percent', 0),
                batch_ts,
                now
            )
            return True
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[SAVE ERROR] {str(e)}")
        return False

# Main Event Loop Tracker
main_loop = None

# ==========================
# MQTT MESSAGE HANDLER
# ==========================

async def handle_mqtt_message(payload_raw: str):
    """Handle incoming MQTT sensor data"""
    try:
        if not payload_raw or not payload_raw.strip().startswith('{'):
            return

        payload = json.loads(payload_raw)
        collar_id = payload.get('collar_id', 'UNKNOWN')
        print(f" [DEBUG] Processing message for: {collar_id}")

        # Proses Verifikasi
        auth_signature = payload.get('auth')
        device_secret = payload.get('device_secret')
        ok, reason, kandang_id = await verify_device(
            collar_id=collar_id, 
            device_secret=device_secret,
            auth_signature=auth_signature,
            raw_payload=payload_raw
        )

        if not ok:
            print(f" [SECURITY DROP] {collar_id} -> {reason}")
            return

        # Simpan ke Database
        if await save_sensor(payload, kandang_id):
            print(f"[DB OK] Saved data for {collar_id}")
            
            if payload.get('estrus_code') == 1:
                await handle_estrus_alert(collar_id, kandang_id, payload.get('temperature', 39.8))
        else:
            print(f" [DB FAIL] Could not save for {collar_id}")

    except Exception as e:
        print(f" [PROCESS ERROR] {str(e)}")

async def handle_estrus_alert(collar_id: str, kandang_id: Optional[str] = None, temperature: float = 39.8):
    """Specific logic for estrus alerts"""
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            # Explicit transaction wrapping for FOR UPDATE lock
            async with conn.transaction():
                row = await conn.fetchrow("""
                    SELECT h.id, h.nama, h.last_estrus_alert_at 
                    FROM hewan h
                    JOIN collar_registry cr ON cr.cow_id = h.id
                    WHERE cr.collar_id = $1
                    FOR UPDATE
                """, collar_id)
                
                if not row: return
                
                db_id, cow_name, last_alert = row['id'], row['nama'], row['last_estrus_alert_at']
                
                can_send = True
                now_wita = datetime.now(WITA).replace(tzinfo=None)
                
                if last_alert:
                    diff = now_wita - last_alert
                    if 0 <= diff.total_seconds() < 3600:
                        can_send = False
                        print(f" [COOLDOWN] Alert skipped for {collar_id}, last sent {int(diff.total_seconds()/60)} mins ago")

                if can_send:
                    await conn.execute("UPDATE hewan SET last_estrus_alert_at = $1 WHERE id = $2", now_wita, db_id)
                    dashboard_host = os.getenv('MQTT_BROKER_URL', '192.168.1.33')
                    
                    await asyncio.to_thread(                        
                        send_estrus_alert,                          
                        cow_name    = cow_name,                     
                        collar_id   = collar_id,                    
                        kandang_id  = kandang_id or "Tanpa Kandang",
                        probability = 90.0,                         
                        temperature = temperature,                         
                    )                                               
                    print(f"[ESTRUS] Alert sent (bg) for {cow_name}")

                    # Step 5: Kirim email alert ke semua user yang punya cow ini
                    owner_and_email = await conn.fetchrow(
                        """SELECT u.id as owner_id, u.email 
                           FROM users u 
                           WHERE u.id = (SELECT owner_id FROM hewan WHERE id = (SELECT cow_id FROM collar_registry WHERE collar_id = $1))""",
                        collar_id
                    )

                    if owner_and_email:
                        owner_id = owner_and_email['owner_id']
                        user_email = owner_and_email['email']

                        # Cek user preference sebelum kirim
                        pref_row = await conn.fetchrow(
                            "SELECT notif_estrus, notif_breeding FROM user_preferences WHERE user_id = $1",
                            owner_id
                        )
                        notif_estrus   = pref_row["notif_estrus"]   if pref_row else True
                        notif_breeding = pref_row["notif_breeding"]  if pref_row else False

                        if notif_estrus and user_email:
                            await asyncio.to_thread(
                                send_estrus_alert_email,
                                to          = user_email,
                                cow_name    = cow_name,
                                collar_id   = collar_id,
                                kandang_id  = kandang_id or "Tanpa Kandang",
                                probability = 90.0,
                                temperature = temperature,
                            )
                            print(f"[ESTRUS EMAIL] Sent to {user_email}")

                        if notif_breeding and user_email:
                            await asyncio.to_thread(
                                send_breeding_reminder_email,
                                to                 = user_email,
                                cow_name           = cow_name,
                                collar_id          = collar_id,
                                kandang_id         = kandang_id or "Tanpa Kandang",
                                estrus_detected_at = datetime.now(WITA),
                                probability        = 90.0,
                            )
                            print(f"[BREEDING REMINDER] .ics sent to {user_email}")
    except Exception as e:
        print(f" [ALERT ERROR] {str(e)}")

# ==========================
# MQTT CLIENT SETUP
# ==========================

def on_mqtt_connect(client, userdata, flags, rc):
    print(f" MQTT Connected (rc={rc})")
    client.subscribe(MQTT_TOPIC)

def on_mqtt_message(client, userdata, message):
    """MQTT message callback (Runs in background thread)"""
    try:
        payload_raw = message.payload.decode().strip()
        print(f" MQTT Received: {payload_raw[:30]}...")
        
        # Schedule the async handler in the main event loop
        if main_loop and main_loop.is_running():
            asyncio.run_coroutine_threadsafe(handle_mqtt_message(payload_raw), main_loop)
        else:
            print(" [LOOP ERROR] Main event loop not running!")
    except Exception as e:
        print(f" [CALLBACK ERROR] {str(e)}")

def setup_mqtt():
    global mqtt_client
    mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    mqtt_client.on_connect = on_mqtt_connect
    mqtt_client.on_message = on_mqtt_message
    mqtt_client.connect(MQTT_BROKER_URL, MQTT_BROKER_PORT, 60)
    mqtt_client.loop_forever()

# ==========================
# FASTAPI LIFECYCLE EVENTS
# ==========================

async def _send_daily_summary_job():
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            total   = await conn.fetchval("SELECT COUNT(*) FROM hewan") or 0
            sick    = await conn.fetchval(
                "SELECT COUNT(*) FROM hewan WHERE status_kesehatan != 'Sehat'"
            ) or 0
            estrus  = await conn.fetchval(
                """SELECT COUNT(*) FROM notifications
                   WHERE UPPER(type)='ESTRUS'
                   AND timestamp > NOW() - INTERVAL '24 hours'"""
            ) or 0
            anomaly = await conn.fetchval(
                """SELECT COUNT(*) FROM notifications
                   WHERE UPPER(type) NOT IN ('ESTRUS','INSEMINATION','PREGNANCY')
                   AND timestamp > NOW() - INTERVAL '24 hours'"""
            ) or 0

            # Ambil semua email user yang aktif (punya sapi)
            user_emails = await conn.fetch(
                """SELECT DISTINCT u.email
                   FROM users u
                   JOIN hewan h ON h.owner_id = u.id
                   WHERE u.email IS NOT NULL"""
            )

        # 1. Telegram (broadcast ke semua chat_id dari .env)
        await asyncio.to_thread(
            send_daily_summary,
            total=total, sick=sick,
            estrus_count=estrus, anomaly_count=anomaly
        )

        # 2. Email (kirim ke tiap user)
        users = await conn.fetch("""
            SELECT
                u.id, u.email,
                COALESCE(up.telegram_chat_id, '') AS telegram_chat_id,
                COALESCE(up.notif_daily, TRUE)    AS notif_daily,
                COALESCE(up.notif_estrus, TRUE)   AS notif_estrus
            FROM users u
            LEFT JOIN user_preferences up ON up.user_id = u.id
            JOIN hewan h ON h.owner_id = u.id
            GROUP BY u.id, u.email, up.telegram_chat_id, up.notif_daily, up.notif_estrus
            HAVING COUNT(h.id) > 0
        """)

        for row in users:
            if not row["notif_daily"]:
                continue   # user matikan notif daily → skip
            email   = row["email"]
            chat_id = row["telegram_chat_id"]

            # Email
            await asyncio.to_thread(
                send_daily_summary_email,
                to           = email,
                total        = total,
                sick         = sick,
                estrus_count = estrus,
                anomaly_count= anomaly,
            )

            # Telegram (jika chat_id ada)
            if chat_id:
                await asyncio.to_thread(
                    send_daily_summary,
                    total        = total,
                    sick         = sick,
                    estrus_count = estrus,
                    anomaly_count= anomaly,
                    chat_ids     = [chat_id],
                )

        print("✅ [DAILY SUMMARY] Telegram + Email sent successfully")
    except Exception as e:
        print(f"❌ [DAILY SUMMARY ERROR] {e}")

async def _send_monthly_report_job():
    """Kirim laporan bulanan PDF ke semua user setiap tanggal 1."""
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            users = await conn.fetch(
                """SELECT DISTINCT u.id, u.email
                   FROM users u
                   JOIN hewan h ON h.owner_id = u.id
                   WHERE u.email IS NOT NULL"""
            )

        from report_routes import generate_monthly_pdf_bytes  # import lokal
        month_str = datetime.now(WITA).strftime("%B %Y")

        for user in users:
            try:
                pdf_bytes = await asyncio.to_thread(
                    generate_monthly_pdf_bytes,
                    user_id=user['id']
                )
                await asyncio.to_thread(
                    send_monthly_report_email,
                    to        = user['email'],
                    pdf_bytes = pdf_bytes,
                    month_str = month_str,
                )
                print(f"📊 [MONTHLY PDF] Sent to {user['email']}")
            except Exception as e:
                print(f"❌ [MONTHLY PDF ERROR] {user['email']}: {e}")

    except Exception as e:
        print(f"❌ [MONTHLY JOB ERROR] {e}")

async def _ensure_hourly_table():
    """Create sensor_data_hourly archival table if it doesn't yet exist."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS sensor_data_hourly (
                id              SERIAL PRIMARY KEY,
                collar_id       VARCHAR(50),
                kandang_id      VARCHAR(50),
                hour_bucket     TIMESTAMP NOT NULL,
                avg_rms_z       FLOAT,
                avg_temperature FLOAT,
                max_rms_z       FLOAT,
                max_temperature FLOAT,
                min_temperature FLOAT,
                estrus_count    INTEGER DEFAULT 0,
                sample_count    INTEGER DEFAULT 0,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_hourly_collar ON sensor_data_hourly(collar_id);
            CREATE INDEX IF NOT EXISTS idx_hourly_bucket ON sensor_data_hourly(hour_bucket DESC);
            CREATE INDEX IF NOT EXISTS idx_hourly_collar_bucket ON sensor_data_hourly(collar_id, hour_bucket DESC);
        """)
    print("🗜️  [DB] sensor_data_hourly table ensured.")
    
    # --- RESTORE KANDANG TABLE (Priority 3) ---
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS kandang (
                id          VARCHAR(50) PRIMARY KEY,
                nama        VARCHAR(100),
                lokasi      VARCHAR(200),
                kapasitas   INTEGER DEFAULT 50,
                owner_id    INTEGER,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        # Seed if empty (Optional)
        count = await conn.fetchval("SELECT COUNT(*) FROM kandang")
        if count == 0:
            await conn.execute("INSERT INTO kandang (id, nama) VALUES ('K1', 'Kandang Utama')")
            print("🌱 [DB] Seeded initial kandang table.")
            
    print("🏠 [DB] kandang table ensured.")


async def downsample_sensor_data():
    """
    Nightly cron job (02:00 WITA) that:
    1. Finds all raw sensor_data rows older than 30 days
    2. Groups them per collar per hour and inserts summaries into sensor_data_hourly
    3. Deletes the original raw rows to keep the table lean
    """
    CUTOFF_DAYS = 30
    print(f"🗜️  [DOWNSAMPLE] Starting nightly downsampling (cutoff: {CUTOFF_DAYS} days)...")
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            # Insert aggregated hourly rows (skip any that already exist via ON CONFLICT DO NOTHING)
            inserted = await conn.execute("""
                INSERT INTO sensor_data_hourly
                    (collar_id, kandang_id, hour_bucket,
                     avg_rms_z, avg_temperature,
                     max_rms_z, max_temperature, min_temperature,
                     estrus_count, sample_count)
                SELECT
                    collar_id,
                    kandang_id,
                    DATE_TRUNC('hour', batch_ts)   AS hour_bucket,
                    ROUND(AVG(rms_z)::numeric, 4)  AS avg_rms_z,
                    ROUND(AVG(temperature)::numeric, 2) AS avg_temperature,
                    MAX(rms_z)                     AS max_rms_z,
                    MAX(temperature)               AS max_temperature,
                    MIN(temperature)               AS min_temperature,
                    SUM(CASE WHEN estrus_detected = 1 THEN 1 ELSE 0 END) AS estrus_count,
                    COUNT(*)                       AS sample_count
                FROM sensor_data
                WHERE batch_ts < NOW() - INTERVAL '$1 days'
                  AND batch_ts IS NOT NULL
                GROUP BY collar_id, kandang_id, DATE_TRUNC('hour', batch_ts)
                ON CONFLICT DO NOTHING
            """, CUTOFF_DAYS)

            # Count rows to be deleted
            count_row = await conn.fetchrow(
                "SELECT COUNT(*) FROM sensor_data WHERE batch_ts < NOW() - INTERVAL '$1 days'",
                CUTOFF_DAYS
            )
            delete_count = count_row['count'] if count_row else 0

            # Delete the raw rows
            await conn.execute(
                "DELETE FROM sensor_data WHERE batch_ts < NOW() - INTERVAL '$1 days'",
                CUTOFF_DAYS
            )

            print(f"🗜️  [DOWNSAMPLE] Done! Archived & deleted {delete_count} rows → sensor_data_hourly")

    except Exception as e:
        print(f"❌ [DOWNSAMPLE ERROR] {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    global main_loop
    main_loop = asyncio.get_running_loop()
    print(" FastAPI Startup - Event loop captured")
    try:
        pool = await get_db_pool()
        print("🛠️ Ensuring database tables and columns are up to date...")
        async with pool.acquire() as conn:
            await conn.execute("ALTER TABLE collar_registry ADD COLUMN IF NOT EXISTS device_secret VARCHAR(100);")
            await conn.execute("ALTER TABLE reproduksi_ternak ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
            await conn.execute("ALTER TABLE hewan ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
            # Ensure observation_logs table exists
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS observation_logs (
                    id SERIAL PRIMARY KEY,
                    cow_id VARCHAR(50) NOT NULL REFERENCES hewan(id) ON DELETE CASCADE,
                    activity_type VARCHAR(50) NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
        await _ensure_hourly_table()
    except Exception as db_err:
        print(f"❌ [DB INIT ERROR] Failed to run database startup checks/migrations: {db_err}")

    scheduler = AsyncIOScheduler(timezone="Asia/Makassar")
    scheduler.add_job(
        _send_daily_summary_job,
        trigger="cron",
        hour=7, minute=0,
        id="daily_summary"
    )
    scheduler.add_job(
        _send_monthly_report_job,
        trigger="cron",
        day=1, hour=8, minute=0,
        id="monthly_report"
    )
    scheduler.add_job(
        downsample_sensor_data,
        trigger="cron",
        hour=2, minute=0,     # 02:00 WITA every night
        id="downsample_sensor"
    )
    scheduler.start()
    print("⏰ [SCHEDULER] Daily summary job registered (07:00 WITA)")
    print("🗜️  [SCHEDULER] Downsampling job registered (02:00 WITA)")

    # Start WebSocket PG listener
    asyncio.create_task(listen_to_pg_notifications())
    
    # Start Telegram Bot
    asyncio.create_task(start_telegram_bot())

    yield

    # Shutdown logic
    print(" Shutting down FastAPI IoT Backend...")
    await close_db_pool()
    if mqtt_client:
        mqtt_client.disconnect()
        
    # Stop Telegram Bot
    await stop_telegram_bot()

app.router.lifespan_context = lifespan

# ==========================
# PYDANTIC MODELS
# ==========================

class DeviceVerify(BaseModel):
    collar_id: str
    device_secret: str

class MaintenanceRequest(BaseModel):
    command: str = "START_OTA"
    duration: int = 180

class HewanCreate(BaseModel):
    id: str
    nama: str
    tanggal_lahir: Optional[str] = None
    jenis: str
    breed_id: Optional[str] = None
    status_kesehatan: Optional[str] = "Sehat"
    berat_badan: Optional[float] = None
    kandang_id: Optional[str] = None

class AlertTest(BaseModel):
    message: str

class ObservationRequest(BaseModel):
    cow_id: str
    activity_type: str
    notes: Optional[str] = ""

# ==========================
# REST API ENDPOINTS
# ==========================

# Consolidated with definition at line 58

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "IoT Peternakan API",
        "version": "2.0.0",
        "framework": "FastAPI"
    }

@app.get("/api/hewan")
async def get_all_hewan(current_user: dict = Depends(get_current_user)):
    """Get all cattle filtered by user with standard JSON keys"""
    pool = await get_db_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT 
                    h.id as cow_id,          
                    h.id as rfid,            
                    h.nama,
                    h.jenis as jenis,
                    h.bulan_tahun_lahir as birth_date,
                    h.status_kesehatan as status,
                    cr.collar_id, 
                    cr.status as collar_status,
                    
                    -- Deteksi Estrus (High Risk)
                    CASE WHEN EXISTS (
                        SELECT 1 FROM ai_predictions ap
                        WHERE ap.cow_id = h.id 
                        AND ap.prediction_type = 'ESTRUS'
                        AND ap.prediction_result = 'HIGH'
                        AND ap.prediction_ts > NOW() - INTERVAL '24 hours'
                    ) THEN 1 ELSE 0 END as estrus_detected,
                    
                    -- Status Hidup (Active Collar)
                    CASE WHEN cr.status = 'ACTIVE' THEN true ELSE false END as is_live,
                    
                    -- Aktivitas Terakhir
                    (SELECT activity_state FROM sensor_data 
                     WHERE collar_id = cr.collar_id 
                     ORDER BY batch_ts DESC LIMIT 1) as activity_state,

                    -- Suhu Terakhir (Waktu Nyata)
                    (SELECT ROUND(temperature::numeric, 1) FROM sensor_data 
                     WHERE collar_id = cr.collar_id 
                     ORDER BY batch_ts DESC LIMIT 1) as temp,

                    -- Persentase Baterai Terakhir (Waktu Nyata)
                    (SELECT battery_percent FROM sensor_data 
                     WHERE collar_id = cr.collar_id 
                     ORDER BY batch_ts DESC LIMIT 1) as battery,

                    -- Waktu Sinkronisasi Terakhir
                    (SELECT batch_ts FROM sensor_data 
                     WHERE collar_id = cr.collar_id 
                     ORDER BY batch_ts DESC LIMIT 1) as last_sync

                FROM hewan h
                LEFT JOIN collar_registry cr ON cr.cow_id = h.id
                WHERE h.owner_id = $1  -- FILTER OWNER (PENTING!)
                ORDER BY h.nama
            """, get_effective_owner_id(current_user))
            
            return [dict(row) for row in rows]
    except Exception as e:
        print(f" [GET CATTLE ERROR] {str(e)}")
        return []

@app.get("/api/hewan/{hewan_id}")
async def get_hewan_detail(hewan_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed information about a specific cattle (Filtered)"""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        # Get cattle info
        hewan = await conn.fetchrow("""
            SELECT 
                h.id, h.nama, h.bulan_tahun_lahir, h.jenis,
                h.status_kesehatan,
                cr.collar_id, cr.status as collar_status
            FROM hewan h
            LEFT JOIN collar_registry cr ON cr.cow_id = h.id
            WHERE h.id = $1 AND h.owner_id = $2
        """, hewan_id, get_effective_owner_id(current_user))
        
        if not hewan:
            raise HTTPException(status_code=404, detail="Cattle not found")
        
        # Get recent sensor data
        sensor_data = await conn.fetch("""
            SELECT * FROM sensor_data
            WHERE collar_id = $1
            ORDER BY batch_ts DESC
            LIMIT 100
        """, dict(hewan)['collar_id']) if dict(hewan)['collar_id'] else []
        
        return {
            "hewan": dict(hewan),
            "sensor_data": [dict(row) for row in sensor_data]
        }

@app.post("/api/hewan")
async def add_hewan(hewan: HewanCreate, current_user: dict = Depends(get_current_user)):
    """Add new cattle (Filtered)"""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        try:
            # Sesuaikan dengan kolom yang benar-benar ada di pgAdmin kamu
            await conn.execute("""
                INSERT INTO hewan 
                (id, nama, bulan_tahun_lahir, jenis, status_kesehatan, owner_id)
                VALUES ($1, $2, $3, $4, $5, $6)
            """,
                hewan.id, 
                hewan.nama, 
                hewan.tanggal_lahir, # Masuk ke bulan_tahun_lahir
                hewan.jenis,         # Masuk ke jenis
                hewan.status_kesehatan, 
                get_effective_owner_id(current_user)
            )
            return {"message": "Cattle added successfully", "id": hewan.id}
        except Exception as e:
            # Cek terminal backend kamu, di sana akan tertulis kolom mana yang error
            print(f" [ADD ERROR]: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sensor-data")
async def get_sensor_data(
    collar_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get sensor data filtered by owner"""
    pool = await get_db_pool()
    owner_id = get_effective_owner_id(current_user)
    async with pool.acquire() as conn:
        if collar_id:
            # Join with hewan to verify ownership
            rows = await conn.fetch("""
                SELECT sd.* FROM sensor_data sd
                JOIN hewan h ON sd.collar_id = h.collar_id
                WHERE sd.collar_id = $1 AND h.owner_id = $2
                ORDER BY sd.batch_ts DESC
                LIMIT $3
            """, collar_id, owner_id, limit)
        else:
            # Show all sensor data for the owner's farm
            rows = await conn.fetch("""
                SELECT sd.* FROM sensor_data sd
                JOIN hewan h ON sd.collar_id = h.collar_id
                WHERE h.owner_id = $1
                ORDER BY sd.batch_ts DESC
                LIMIT $2
            """, owner_id, limit)
        
        return [dict(row) for row in rows]

@app.post("/api/alert-test")
async def test_telegram_alert(alert: AlertTest):
    """Test Telegram alert functionality"""
    send_telegram_alert(alert.message)
    return {"message": "Alert sent"}

@app.get("/api/notifications")
async def get_notifications(
    type_filter: str = "all",
    limit: int = 10,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    from datetime import datetime, timedelta, timezone

    user_id = current_user["id"]

    # Naive UTC datetime (WITA offset untuk stats "hari ini")
    wita_offset = timedelta(hours=8)
    now_wita = datetime.now(timezone.utc).replace(tzinfo=None) + wita_offset
    today_start_wita = now_wita.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start_wita - wita_offset  # naive, no tzinfo
 
    pool = await get_db_pool()   # <-- KUNCI: pakai get_db_pool() sama seperti endpoint lain
    try:
        async with pool.acquire() as conn:
 
            # WHERE clause untuk filter type
            if type_filter == "all":
                where_type = ""
                logs_params  = [user_id, limit, offset]
                count_params = [user_id]
            else:
                where_type = "AND n.type = $4"
                logs_params  = [user_id, limit, offset, type_filter]
                count_params = [user_id, type_filter]
 
            logs_q = f"""
                SELECT n.id, n.cow_id, h.nama AS cow_name,
                       n.type, n.message, n.severity, n.timestamp
                FROM notifications n
                LEFT JOIN hewan h ON h.id = n.cow_id
                WHERE h.owner_id = $1 {where_type}
                ORDER BY n.timestamp DESC
                LIMIT $2 OFFSET $3
            """
 
            count_where = "AND n.type = $2" if type_filter != "all" else ""
            count_q = f"""
                SELECT COUNT(*) FROM notifications n
                LEFT JOIN hewan h ON h.id = n.cow_id
                WHERE h.owner_id = $1 {count_where}
            """
 
            stats_q = """
                SELECT
                    COUNT(*)                                                        AS today,
                    COUNT(*) FILTER (WHERE n.type = 'ESTRUS')                       AS estrus,
                    COUNT(*) FILTER (WHERE n.type ILIKE '%ANOMAL%')                 AS anomaly,
                    COUNT(*)                                                        AS sent
                FROM notifications n
                LEFT JOIN hewan h ON h.id = n.cow_id
                WHERE h.owner_id = $1
                  AND n.timestamp >= $2
            """
 
            logs_rows  = await conn.fetch(logs_q,  *logs_params)
            total      = await conn.fetchval(count_q, *count_params)
            stats_row  = await conn.fetchrow(stats_q, user_id, today_start_utc)
 
            logs = []
            for row in logs_rows:
                logs.append({
                    "id":        row["id"],
                    "cow_id":    row["cow_id"],
                    "cow_name":  row["cow_name"],
                    "type":      row["type"],
                    "message":   row["message"],
                    "severity":  row.get("severity", "info"),
                    "timestamp": row["timestamp"].isoformat() if row["timestamp"] else None,
                })
 
            stats = {
                "today":   stats_row["today"]   if stats_row else 0,
                "estrus":  stats_row["estrus"]  if stats_row else 0,
                "anomaly": stats_row["anomaly"] if stats_row else 0,
                "sent":    stats_row["sent"]    if stats_row else 0,
            }
 
        return {"logs": logs, "total": total or 0, "stats": stats}
 
    except Exception as e:
        print(f"[NOTIFICATIONS ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/logout")
async def logout():
    """Logout endpoint (placeholder for frontend)"""
    return {"message": "Logged out"}


# ==========================
# API FOR CRUD
# ==========================

@app.put("/api/hewan/{hewan_id}")
async def update_hewan(hewan_id: str, data: HewanCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') == 'worker':
        raise HTTPException(status_code=403, detail="Pekerja tidak diizinkan mengubah data rekam ternak.")
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        # Cek apakah sapi itu memang milik user yang login
        result = await conn.execute("""
            UPDATE hewan 
            SET nama = $1, bulan_tahun_lahir = $2, jenis = $3, status_kesehatan = $4
            WHERE id = $5 AND owner_id = $6
        """, data.nama, data.tanggal_lahir, data.jenis, data.status_kesehatan, hewan_id, current_user.get('sub', current_user.get('id')))
        
        if "UPDATE 0" in result:
            raise HTTPException(status_code=404, detail="Sapi tidak ditemukan atau bukan milik Anda")
        return {"message": "Data sapi berhasil diperbarui"}

@app.delete("/api/hewan/{hewan_id}")
async def delete_hewan(hewan_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') == 'worker':
        raise HTTPException(status_code=403, detail="Akses Ditolak: Hanya admin yang dapat menghapus data sapi.")
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM hewan WHERE id = $1 AND owner_id = $2", 
                                    hewan_id, current_user.get('sub', current_user.get('id')))
        if "DELETE 0" in result:
            raise HTTPException(status_code=404, detail="Gagal menghapus sapi")
        return {"message": "Sapi berhasil dihapus"}

# ==========================
# REPRODUCTION PAGE HANDLE
# ==========================
@app.get("/api/reproduction")
async def get_reproduction_records(current_user: dict = Depends(get_current_user)):
    pool = await get_db_pool()
    owner_id = get_effective_owner_id(current_user)

    async with pool.acquire() as conn:
        try:
            # Kueri ini mengambil data TERBARU (tanggal_ib DESC) untuk setiap RFID unik
            rows = await conn.fetch("""
                WITH LatestRecords AS (
                    SELECT DISTINCT ON (r.rfid) 
                        r.*, 
                        h.nama as cow_name
                    FROM reproduksi_ternak r
                    JOIN hewan h ON r.rfid = h.id
                    WHERE h.owner_id = $1
                    ORDER BY r.rfid, r.id DESC, r.tanggal_ib DESC -- ID DESC ditaruh di depan agar input terbaru yang menang
                )
                SELECT * FROM LatestRecords 
                ORDER BY tanggal_ib DESC, id DESC;
            """, owner_id)
            
            return [dict(row) for row in rows]
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

# TAMBAHKAN ENDPOINT BARU UNTUK LIHAT SEJARAH LENGKAP SATU SAPI
@app.get("/api/reproduction/history/{rfid}")
async def get_cattle_history(rfid: str, current_user: dict = Depends(get_current_user)):
    pool = await get_db_pool()
    owner_id = get_effective_owner_id(current_user)
    async with pool.acquire() as conn:
        # PENTING: Join dengan tabel hewan untuk memastikan rfid ini milik user
        rows = await conn.fetch("""
            SELECT r.* FROM reproduksi_ternak r
            JOIN hewan h ON r.rfid = h.id
            WHERE r.rfid = $1 AND h.owner_id = $2
            ORDER BY r.tanggal_ib DESC
        """, rfid, owner_id)
        if not rows:
            return [] # Atau raise 404
        return [dict(row) for row in rows]

@app.post("/api/reproduction")
async def add_reproduction_record(data: dict, current_user: dict = Depends(get_current_user)):
    pool = await get_db_pool()
    # USE EFFECTIVE OWNER ID (Parent ID if worker)
    owner_id = get_effective_owner_id(current_user)
    async with pool.acquire() as conn:
        try:
            # SECURITY: Cek apakah sapi ini milik farm ini
            hewan_exists = await conn.fetchval("SELECT 1 FROM hewan WHERE id = $1 AND owner_id = $2", 
                                                data['rfid'], owner_id)
            if not hewan_exists:
                raise HTTPException(status_code=403, detail="Sapi ini bukan milik peternakan Anda.")

            # 2. Hitung jumlah IB sebelumnya untuk sapi ini
            last_count = await conn.fetchval("""
                SELECT COALESCE(MAX(jumlah_ib), 0) 
                FROM reproduksi_ternak 
                WHERE rfid = $1
            """, data['rfid'])
            next_service_no = last_count + 1
            
            # 3. Parse service_date (Always make it naive for DB)
            try:
                raw_sd = data.get('service_date', '')
                if 'T' in raw_sd:
                    service_date = datetime.fromisoformat(raw_sd.replace('Z', '+00:00'))
                else:
                    service_date = datetime.strptime(raw_sd[:10], '%Y-%m-%d')
                
                if service_date.tzinfo:
                    print(f"📡 [DEBUG] Add Route: Strip TZ from service_date: {service_date.tzinfo}")
                    service_date = service_date.replace(tzinfo=None)
            except Exception as pe:
                print(f"📡 [DEBUG ERROR] Add Route Date Parse: {pe} | Input: {data.get('service_date')}")
                service_date = datetime.now(WITA).replace(tzinfo=None)

            # 4. Insert data with created_at timestamp
            now = datetime.now(WITA).replace(tzinfo=None)
            await conn.execute("""
                INSERT INTO reproduksi_ternak 
                (rfid, tanggal_ib, pemberi_ib, catatan, jumlah_ib, hpl, results, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """, 
            data['rfid'], service_date, data['technician'], data['notes'], 
            next_service_no, None, None, now)

            # 5. Add to notifications table for timeline visibility
            await conn.execute("""
                INSERT INTO notifications (cow_id, type, message, severity, timestamp)
                VALUES ($1, 'insemination', $2, 'INFO', $3)
            """, data['rfid'], f"Inseminasi baru (Suntik ke-{next_service_no}) direkam oleh sistem.", now)
            
            return {"status": "success", "message": f"Record added as Service No. {next_service_no}"}
        except Exception as e:
            print(f"ERROR ADD: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/reproduction/{record_id}")
async def update_reproduction_record(record_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    pool = await get_db_pool()
    # USE EFFECTIVE OWNER ID (Parent ID if worker)
    owner_id = get_effective_owner_id(current_user)

    async with pool.acquire() as conn:
        try:
            # 1. Parse service_date (Make naive for DB)
            try:
                raw_sd = data.get('service_date', '')
                if 'T' in raw_sd:
                    # ISO format (might have TZ)
                    service_date = datetime.fromisoformat(raw_sd.replace('Z', '+00:00'))
                else:
                    service_date = datetime.strptime(raw_sd[:10], '%Y-%m-%d')
                
                if service_date.tzinfo:
                    print(f"📡 [DEBUG] Strip TZ from service_date: {service_date.tzinfo}")
                    service_date = service_date.replace(tzinfo=None)
            except Exception as pe:
                print(f"📡 [DEBUG ERROR] Update Date Parse: {pe} | Input: {data.get('service_date')}")
                service_date = datetime.now(WITA).replace(tzinfo=None)
            
            status_input = str(data.get('is_pregnant', 'pending')).lower()

            # 2. KONVERSI PENTING: String 'true' dari JS harus jadi Boolean True di Python
            results_bool = None
            hpl_final = None

            if status_input == "true":
                results_bool = True
                hpl_final = service_date + timedelta(days=283)
            elif status_input == "false" or status_input == "failed":
                results_bool = False
                hpl_final = None
            else:
                results_bool = None
                hpl_final = None

            # 3. FIX QUERY: Bandingkan rfid dengan cow_id (sesama String)
            result = await conn.execute("""
                UPDATE reproduksi_ternak 
                SET rfid = $1, tanggal_ib = $2, pemberi_ib = $3, catatan = $4, results = $5, hpl = $6
                WHERE id = $7 AND rfid IN (SELECT id FROM hewan WHERE owner_id = $8)
            """, 
            data['rfid'],      # $1
            service_date,      # $2
            data['technician'], # $3
            data['notes'],      # $4
            results_bool,      # $5
            hpl_final,         # $6
            record_id,         # $7
            owner_id            # $8
            )
            
            if result == "UPDATE 0":
                raise HTTPException(status_code=404, detail="Data tidak ditemukan")
            
            # 4. Add notification for result update (if confirmed)
            if results_bool is not None:
                now_naive = datetime.now(WITA).replace(tzinfo=None)
                msg = f"Hasil IB sapi {data['rfid']} dikonfirmasi: " + ("Bunting 🐮✅" if results_bool else "Gagal (Kembali Birahi) 🐮❌")
                
                print(f"📡 [DEBUG] Inserting notification for {data['rfid']} at {now_naive}")
                await conn.execute("""
                    INSERT INTO notifications (cow_id, type, message, severity, timestamp)
                    VALUES ($1, 'pregnancy', $2, 'INFO', $3)
                """, data['rfid'], msg, now_naive)
                
                if results_bool is True and hpl_final:
                    user_email = await conn.fetchval(
                        "SELECT email FROM users WHERE id = $1", int(current_user['id'])
                    )
                    if user_email:
                        cow_name_row = await conn.fetchval(
                            "SELECT nama FROM hewan WHERE id = $1", data['rfid']
                        )
                        await asyncio.to_thread(
                            send_birth_reminder_email,
                            to         = user_email,
                            cow_name   = cow_name_row or data['rfid'],
                            collar_id  = data['rfid'],
                            hpl        = hpl_final,
                        )
                        print(f"[BIRTH REMINDER] .ics sent to {user_email}")
                
            return {"status": "success", "message": "Record updated"}

        except Exception as e:
            # PESAN INI PENTING: Cek terminal Docker kamu kalau masih error!
            print(f"DATABASE ERROR: {str(e)}") 
            raise HTTPException(status_code=500, detail=f"DB Error: {str(e)}")

@app.delete("/api/reproduction/{record_id}")
async def delete_reproduction_record(record_id: int, current_user: dict = Depends(get_current_user)):
    pool = await get_db_pool()
    owner_id = get_effective_owner_id(current_user)
    async with pool.acquire() as conn:
        try:
            result = await conn.execute("""
                DELETE FROM reproduksi_ternak
                WHERE id = $1 AND rfid IN (SELECT id FROM hewan WHERE owner_id = $2)
            """, record_id, owner_id)
            if result == "DELETE 0":
                raise HTTPException(status_code=404, detail="Data tidak ditemukan atau Anda tidak memiliki akses")
            return {"status": "success", "message": "Record deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            print(f"ERROR DELETE: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reproduction/stats")
async def get_repro_stats(current_user: dict = Depends(get_current_user)):
    pool = await get_db_pool()
    owner_id = get_effective_owner_id(current_user)

    async with pool.acquire() as conn:
        try:
            # 1. Hitung Statistik (Sinkron dengan tampilan Tabel: Latest Status per Sapi)
            row = await conn.fetchrow("""
                WITH StatsRecords AS (
                    SELECT DISTINCT ON (r.rfid) 
                        r.results, 
                        r.hpl
                    FROM reproduksi_ternak r
                    JOIN hewan h ON r.rfid = h.id
                    WHERE h.owner_id = $1
                    ORDER BY r.rfid, r.id DESC, r.tanggal_ib DESC
                )
                SELECT 
                    COUNT(*) FILTER (WHERE results = TRUE AND hpl > CURRENT_DATE) as pregnant_count,
                    (SELECT COUNT(*) FROM reproduksi_ternak WHERE rfid IN (SELECT id FROM hewan WHERE owner_id = $1)) as total_services,
                    NULLIF(COUNT(*) FILTER (WHERE results = TRUE AND hpl > CURRENT_DATE), 0) as success_divider
                FROM StatsRecords
            """, owner_id)

            if not row or not row['total_services']:
                return {
                    "conception_rate": None,
                    "avg_interval": None,
                    "services_per_conception": None,
                    "pregnant_cows": 0
                }

            # 2. Hitung Conception Rate (%)
            total = row['total_services'] or 0
            pregnant = row['pregnant_count'] or 0
            conception_rate = round((pregnant / total * 100), 1) if total > 0 else None

            # 3. Hitung Services per Conception
            s_per_c = round((total / row['success_divider']), 1) if row['success_divider'] else None

            # 4. Hitung Avg Service Interval
            avg_val = await conn.fetchval("""
                WITH intervals AS (
                    SELECT tanggal_ib - LAG(tanggal_ib) OVER (PARTITION BY rfid ORDER BY tanggal_ib) as diff
                    FROM reproduksi_ternak
                    WHERE rfid IN (SELECT id FROM hewan WHERE owner_id = $1)
                )
                SELECT EXTRACT(DAY FROM AVG(diff)) FROM intervals WHERE diff IS NOT NULL
            """, owner_id)

            avg_interval = f"{int(avg_val)} days" if avg_val is not None else None

            return {
                "conception_rate": f"{conception_rate}%" if conception_rate is not None else None,
                "avg_interval": avg_interval,
                "services_per_conception": s_per_c,
                "pregnant_cows": pregnant
            }
        except Exception as e:
            print(f" STATS ERROR: {e}")
            raise HTTPException(status_code=500, detail=str(e))

# ==========================
# SENSOR DATA API
# ==========================

@app.get("/api/cattle")
async def get_cattle_list(current_user: dict = Depends(get_current_user)):
    pool = await get_db_pool()
    owner_id = get_effective_owner_id(current_user)
    async with pool.acquire() as conn:
        # Ambil ID dan Nama dari tabel 'hewan'
        rows = await conn.fetch("SELECT id, nama FROM hewan WHERE owner_id = $1", owner_id)
        return [{"id": row['id'], "nama": row['nama']} for row in rows]

@app.get("/api/sensors/{cattle_id}")
async def get_sensor_history(cattle_id: str, current_user: dict = Depends(get_current_user), range_type: str = "24h", start_date: Optional[str] = None, end_date: Optional[str] = None):
    pool = await get_db_pool()
    owner_id = get_effective_owner_id(current_user)
    async with pool.acquire() as conn:
        try:
            # SECURITY: Pastikan sapi milik user
            hewan_row = await conn.fetchrow("SELECT collar_id FROM hewan WHERE id = $1 AND owner_id = $2", 
                                             cattle_id, owner_id)
            if not hewan_row:
                return [] # Atau raise 404
            
            collar_id = hewan_row['collar_id']

            time_filter = "created_at > NOW() - INTERVAL '24 hours'" # Default
        
            if range_type == "7d": time_filter = "created_at > NOW() - INTERVAL '7 days'"
            elif range_type == "30d": time_filter = "created_at > NOW() - INTERVAL '30 days'"
            elif range_type == "custom" and start_date and end_date:
                time_filter = f"created_at BETWEEN '{start_date}' AND '{end_date}'"

            rows = await conn.fetch(f"""
                SELECT created_at, temperature, max_z as movement 
                FROM public.sensor_data 
                WHERE collar_id = $1
                AND {time_filter}
                ORDER BY created_at ASC
            """, collar_id)
                
            return [dict(row) for row in rows]

        except Exception as e:
            print(f" DATABASE ERROR: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/api/collars/available")
async def get_available_collars(current_user: dict = Depends(get_current_user)):
    """Get available collars (not assigned to any cattle)"""
    pool = await get_db_pool()
    owner_id = get_effective_owner_id(current_user)
    async with pool.acquire() as conn:
        # SECURITY: Only show collars that have SENT DATA but are not in HEWAN table.
        # Ideally, we'd also check if the collar was "provisioned" to this farm,
        # but for now, we'll let users see unassigned collars to facilitate pairing.
        # IMPORTANT: We restrict this to a recent window to avoid revealing too much.
        rows = await conn.fetch("""
            SELECT DISTINCT collar_id 
            FROM public.sensor_data 
            WHERE collar_id IS NOT NULL 
            AND batch_ts > NOW() - INTERVAL '7 days'
            AND collar_id NOT IN (
                SELECT collar_id FROM public.hewan WHERE collar_id IS NOT NULL
            )
        """)
        return [row['collar_id'] for row in rows]

# ==========================
# BEHAVIOR ANALYTICS
# ==========================
@app.get("/api/behavior")
async def get_behavior_analytics(cow_id: str = "all", current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    pool = await get_db_pool()
    
    # 1. Define Time Ranges (WITA)
    now = datetime.now(WITA).replace(tzinfo=None)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_7d_start = today_start - timedelta(days=7)
    
    async with pool.acquire() as conn:
        try:
            # Base query to link sensor_data to cattle owned by user
            base_join = """
                FROM sensor_data sd
                JOIN hewan h ON sd.collar_id = h.collar_id
                WHERE h.owner_id = $1
            """
            params: List[str | int] = [owner_id]
            
            cow_filter = ""
            if cow_id != "all":
                cow_filter = " AND h.id = $2 "
                params.append(cow_id)

            # A. Daily Activity (Today vs 7-Day Avg)
            if cow_id != "all":
                today_rows = await conn.fetch(f"""
                    SELECT EXTRACT(HOUR FROM sd.created_at) as hour, AVG(sd.max_z) as activity
                    {base_join} AND h.id = $2
                    AND sd.created_at >= $3
                    GROUP BY hour ORDER BY hour
                """, owner_id, cow_id, today_start)

                baseline_rows = await conn.fetch(f"""
                    SELECT EXTRACT(HOUR FROM sd.created_at) as hour, AVG(sd.max_z) as activity
                    {base_join} AND h.id = $2
                    AND sd.created_at >= $3 AND sd.created_at < $4
                    GROUP BY hour ORDER BY hour
                """, owner_id, cow_id, last_7d_start, today_start)
            else:
                today_rows = await conn.fetch(f"""
                    SELECT EXTRACT(HOUR FROM sd.created_at) as hour, AVG(sd.max_z) as activity
                    {base_join}
                    AND sd.created_at >= $2
                    GROUP BY hour ORDER BY hour
                """, owner_id, today_start)

                baseline_rows = await conn.fetch(f"""
                    SELECT EXTRACT(HOUR FROM sd.created_at) as hour, AVG(sd.max_z) as activity
                    {base_join}
                    AND sd.created_at >= $2 AND sd.created_at < $3
                    GROUP BY hour ORDER BY hour
                """, owner_id, last_7d_start, today_start)

            # Format for Chart.js
            hours = [f"{h:02}:00" for h in range(24)]
            today_data = [0.0] * 24
            baseline_data = [0.0] * 24
            
            for r in today_rows: today_data[int(r['hour'])] = round(r['activity'] * 10, 1) # Scaling for visibility
            for r in baseline_rows: baseline_data[int(r['hour'])] = round(r['activity'] * 10, 1)

            # B. Most Active Today (Top 5)
            # Movement estimated by SUM(max_z) * factor
            most_active_rows = await conn.fetch(f"""
                SELECT h.id, h.nama, SUM(sd.max_z) as total_movement
                {base_join}
                AND sd.created_at >= $2
                GROUP BY h.id, h.nama
                ORDER BY total_movement DESC
                LIMIT 5
            """, owner_id, today_start)
            
            most_active = []
            for r in most_active_rows:
                steps = int(r['total_movement'] * 150) # Heuristic factor for steps
                most_active.append({
                    "id": r['id'],
                    "name": r['nama'],
                    "steps": f"{steps:,}",
                    "percentage": min(100, int((steps / 15000) * 100)) # 15k steps as 100%
                })

            # C. Unusual Behavior (Heuristic)
            unusual_behavior = []
            if cow_id == "all":
                anomaly_rows = await conn.fetch("""
                    WITH today_agg AS (
                        SELECT h.id, h.nama,
                            AVG(sd.max_z) as avg_today,
                            AVG(sd.temperature) as avg_temp_today
                        FROM sensor_data sd
                        JOIN hewan h ON sd.collar_id = h.collar_id
                WHERE h.owner_id = $1 AND sd.created_at >= $2
                GROUP BY h.id, h.nama
            ),
            baseline_agg AS (
                SELECT h.id, AVG(sd.max_z) as avg_baseline
                FROM sensor_data sd
                JOIN hewan h ON sd.collar_id = h.collar_id
                WHERE h.owner_id = $1
                AND sd.created_at >= $3
                AND sd.created_at < $2
                GROUP BY h.id
            )
            SELECT t.id, t.nama, t.avg_today, t.avg_temp_today, b.avg_baseline
            FROM today_agg t
            JOIN baseline_agg b ON t.id = b.id
            WHERE ABS(t.avg_today - b.avg_baseline) > (b.avg_baseline * 0.4)
        """, owner_id, today_start, last_7d_start)

                for r in anomaly_rows:
                    diff_pct = int(((r['avg_today'] - r['avg_baseline']) / r['avg_baseline']) * 100)
                    status = "Observe" if diff_pct < 0 else "High Activity"
                    label = "Estrus" if diff_pct > 80 else ("Anomaly" if diff_pct > 40 else "Low Activity")
                    avg_temp = round(float(r['avg_temp_today']), 1) if r['avg_temp_today'] is not None else None

                    unusual_behavior.append({
                        "id": r['id'],
                        "cow_id_display": f"#{r['id'][:4].upper()}",
                        "name": r['nama'],
                        "message": f"{r['nama']} - {'Abnormally Low' if diff_pct < 0 else 'Higher'} Activity",
                        "detail": f"{diff_pct:+}% pergerakan dibanding baseline",
                        "status": status,
                        "label": label,
                        "type": "warning" if diff_pct < 0 else "danger",
                        "avg_temp": avg_temp
                    })

            # D. Real distribution of activities for Pie Chart (last 24 hours)
            pie_rows = await conn.fetch(f"""
                SELECT sd.activity_state, COUNT(*) as cnt
                {base_join} {cow_filter}
                AND sd.created_at >= NOW() - INTERVAL '24 hours'
                GROUP BY sd.activity_state
            """, *params)

            pie_counts = {
                "RESTING": 0,
                "EATING": 0,
                "RUMINATING": 0,
                "ESTRUS": 0,
                "SICK": 0,
                "UNKNOWN": 0
            }
            for r in pie_rows:
                state = r["activity_state"] or "UNKNOWN"
                pie_counts[state] = r["cnt"]

            total_pie = sum(pie_counts.values())
            
            def pct(val):
                return round((val / total_pie) * 100) if total_pie > 0 else 0

            makan_val = pct(pie_counts["EATING"] + pie_counts["RUMINATING"])
            istirahat_val = pct(pie_counts["RESTING"])
            aktif_val = pct(pie_counts["ESTRUS"])
            lainnya_val = pct(pie_counts["SICK"] + pie_counts.get("UNKNOWN", 0))

            if total_pie > 0:
                diff = 100 - (makan_val + istirahat_val + aktif_val + lainnya_val)
                if diff != 0:
                    vals = [makan_val, istirahat_val, aktif_val, lainnya_val]
                    max_idx = vals.index(max(vals))
                    if max_idx == 0: makan_val += diff
                    elif max_idx == 1: istirahat_val += diff
                    elif max_idx == 2: aktif_val += diff
                    else: lainnya_val += diff

            if total_pie == 0:
                pie_data = [
                    { "name": "Makan / Memamah Biak", "value": 0, "color": "#2D4A3E" },
                    { "name": "Istirahat / Tidur", "value": 0, "color": "#7A9E8E" },
                    { "name": "Aktif / Estrus", "value": 0, "color": "#C9963A" },
                    { "name": "Aktivitas Lainnya", "value": 0, "color": "#A8C5B8" }
                ]
            else:
                pie_data = [
                    { "name": "Makan / Memamah Biak", "value": makan_val, "color": "#2D4A3E" },
                    { "name": "Istirahat / Tidur", "value": istirahat_val, "color": "#7A9E8E" },
                    { "name": "Aktif / Estrus", "value": aktif_val, "color": "#C9963A" },
                    { "name": "Aktivitas Lainnya", "value": lainnya_val, "color": "#A8C5B8" }
                ]

            # E. Weekly comparison data (last 7 days)
            weekly_rows = await conn.fetch(f"""
                SELECT 
                    TO_CHAR(sd.created_at, 'Dy') as day_name,
                    DATE(sd.created_at) as date_val,
                    sd.activity_state,
                    COUNT(*) as cnt
                {base_join} {cow_filter}
                AND sd.created_at >= NOW() - INTERVAL '7 days'
                GROUP BY date_val, day_name, sd.activity_state
                ORDER BY date_val ASC
            """, *params)

            day_map = {
                "Mon": "Sen", "Tue": "Sel", "Wed": "Rab", "Thu": "Kam",
                "Fri": "Jum", "Sat": "Sab", "Sun": "Min"
            }
            
            daily_stats = {}
            for r in weekly_rows:
                dt = r["date_val"]
                if dt not in daily_stats:
                    daily_stats[dt] = {
                        "day": day_map.get(r["day_name"], r["day_name"]),
                        "RESTING": 0,
                        "EATING": 0,
                        "RUMINATING": 0,
                        "ESTRUS": 0,
                        "SICK": 0,
                        "UNKNOWN": 0
                    }
                state = r["activity_state"] or "UNKNOWN"
                daily_stats[dt][state] = r["cnt"]

            weekly_data = []
            for dt in sorted(daily_stats.keys()):
                stats = daily_stats[dt]
                t_day = sum(stats[k] for k in ["RESTING", "EATING", "RUMINATING", "ESTRUS", "SICK", "UNKNOWN"])
                if t_day > 0:
                    aktif_pct = round(((stats["ESTRUS"]) / t_day) * 100)
                    makan_pct = round(((stats["EATING"] + stats["RUMINATING"]) / t_day) * 100)
                    istirahat_pct = round(((stats["RESTING"]) / t_day) * 100)
                    
                    diff = 100 - (aktif_pct + makan_pct + istirahat_pct)
                    if diff != 0:
                        p_list = [aktif_pct, makan_pct, istirahat_pct]
                        max_idx = p_list.index(max(p_list))
                        if max_idx == 0: aktif_pct += diff
                        elif max_idx == 1: makan_pct += diff
                        else: istirahat_pct += diff
                else:
                    aktif_pct, makan_pct, istirahat_pct = 0, 0, 0
                
                weekly_data.append({
                    "day": stats["day"],
                    "aktif": aktif_pct,
                    "makan": makan_pct,
                    "istirahat": istirahat_pct
                })

            if not weekly_data:
                for i in range(6, -1, -1):
                    d = now - timedelta(days=i)
                    dy = d.strftime('%a')
                    weekly_data.append({
                        "day": day_map.get(dy, dy),
                        "aktif": 0,
                        "makan": 0,
                        "istirahat": 0
                    })

            return {
                "daily_activity": {
                    "labels": hours,
                    "today": today_data,
                    "baseline": baseline_data
                },
                "most_active": most_active,
                "unusual_behavior": unusual_behavior,
                "pie_data": pie_data,
                "weekly_data": weekly_data
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))

# ==========================
# ACTIVITY TIMELINE
# ==========================
@app.get("/api/timeline/events")
async def get_timeline_events(current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    all_events = []
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        try:
            # 1. FETCH REPRODUCTION DATA (Filter by owner_id)
            repro_records = await conn.fetch("""
                SELECT r.rfid, r.tanggal_ib, r.created_at, r.pemberi_ib, r.catatan, r.results, h.nama as cow_name
                FROM reproduksi_ternak r
                JOIN hewan h ON r.rfid = h.id
                WHERE h.owner_id = $1
                ORDER BY r.created_at DESC
            """, owner_id)
            
            for r in repro_records:
                if not r['tanggal_ib']:
                    continue
                
                # Ensure we have time data from created_at
                event_ts = r['created_at'] if r['created_at'] else r['tanggal_ib']
                
                # Format to ISO string EXPLICITLY including time
                if isinstance(event_ts, (datetime, date)):
                    if hasattr(event_ts, 'hour'):
                        tgl = event_ts.strftime('%Y-%m-%dT%H:%M:%S')
                    else:
                        # Fallback for old pure-date objects
                        tgl = f"{event_ts.isoformat()}T00:00:00"
                else:
                    tgl = str(event_ts)
                
                # A. Insemination Event
                all_events.append({
                    "type": "insemination",
                    "title": "Insemination Recorded",
                    "description": f"Metode: IB. Mantri: {r.get('pemberi_ib') or '-'}. Catatan: {r.get('catatan') or '-'}",
                    "timestamp": tgl,
                    "cow_id": r['rfid'],
                    "cow_name": r.get('cow_name')
                })

                # B. Pregnancy Result Event
                res_val = str(r['results']).lower() if r['results'] is not None else None
                if res_val in ['true', 't', '1']:
                    all_events.append({
                        "type": "pregnancy",
                        "title": "Pregnancy Confirmed",
                        "description": f"Sapi {r.get('cow_name') or r['rfid']} dikonfirmasi bunting.",
                        "timestamp": tgl, 
                        "cow_id": r['rfid'],
                        "cow_name": r.get('cow_name')
                    })
                elif res_val in ['false', 'f', '0']:
                    all_events.append({
                        "type": "anomaly", 
                        "title": "Insemination Failed",
                        "description": f"Sapi {r.get('cow_name') or r['rfid']} gagal bunting (kembali birahi).",
                        "timestamp": tgl,
                        "cow_id": r['rfid'],
                        "cow_name": r.get('cow_name')
                    })

            # 2. FETCH NOTIFICATIONS (Filter by owner_id)
            try:
                alerts = await conn.fetch("""
                    SELECT n.cow_id, n.timestamp, n.type, n.message, h.nama as cow_name 
                    FROM notifications n
                    JOIN hewan h ON n.cow_id = h.id
                    WHERE h.owner_id = $1
                    ORDER BY n.timestamp DESC LIMIT 50
                """, owner_id)
                for a in alerts:
                    tgl_alert = a['timestamp'].isoformat() if isinstance(a['timestamp'], datetime) else str(a['timestamp'])
                    event_type = "estrus" if a['type'] == "ESTRUS" else "anomaly"
                    title = "High Estrus Detected" if event_type == "estrus" else "System Anomaly"

                    all_events.append({
                        "type": event_type,
                        "title": title,
                        "description": a['message'],
                        "timestamp": tgl_alert,
                        "cow_id": a['cow_id'],
                        "cow_name": a.get('cow_name')
                    })
            except Exception as e:
                print(f"Skipping notifications: {e}")

            # 3. SORT & RETURN
            all_events.sort(key=lambda x: x["timestamp"], reverse=True)
            return all_events

        except Exception as e:
            print(f"Error fetching timeline: {e}")
            return []

# NOTE: db_query and db_execute are defined above near line 222-232.
# Duplicate definitions removed to fix Pyright reportRedeclaration errors.


# ==========================
# MAINTENANCE & OTA CONTROL
# ==========================

@app.post("/api/maintenance/{collar_id}")
async def trigger_maintenance(collar_id: str, req: MaintenanceRequest):
    """Publish a maintenance command to a specific collar"""
    pool = await get_db_pool()
    resolved_collar_id = collar_id
    try:
        async with pool.acquire() as conn:
            # Check if input collar_id matches an actual collar in the registry
            exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM collar_registry WHERE UPPER(collar_id) = UPPER($1))",
                collar_id
            )
            if not exists:
                # If not, check if it matches a cow_id in collar_registry
                cow_collar = await conn.fetchval(
                    "SELECT collar_id FROM collar_registry WHERE UPPER(cow_id) = UPPER($1) LIMIT 1",
                    collar_id
                )
                if cow_collar:
                    resolved_collar_id = cow_collar
                    print(f" [CMD] Resolved input cow_id '{collar_id}' to collar_id '{resolved_collar_id}'")
            
        topic = f"kandang/command/{resolved_collar_id}"
        payload = json.dumps({
            "command": req.command,
            "duration": req.duration,
            "sent_at": datetime.now(WITA).isoformat()
        })
        
        if mqtt_client is None:
            raise HTTPException(status_code=503, detail="MQTT broker connection not initialized")
        
        # Publish with RETAIN=True so the collar sees it even if it wakes up later
        info = mqtt_client.publish(topic, payload, qos=1, retain=True)
        info.wait_for_publish() # Ensure it's sent to broker
        
        print(f" [CMD] Sent {req.command} to {resolved_collar_id} (input: {collar_id})")
        return {"status": "success", "message": f"Command {req.command} sent to {resolved_collar_id}"}
    except Exception as e:
        print(f" [CMD ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/research/observe")
async def get_observations(current_user: dict = Depends(get_current_user)):
    """Get recent manual observation records (Hidden Research Feature)"""
    pool = await get_db_pool()
    owner_id = get_effective_owner_id(current_user)
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT o.id, o.cow_id, h.nama as cow_name, o.activity_type, o.notes, o.created_at
                FROM observation_logs o
                JOIN hewan h ON o.cow_id = h.id
                WHERE h.owner_id = $1
                ORDER BY o.created_at DESC
                LIMIT 20
            """, owner_id)
            return [dict(row) for row in rows]
    except Exception as e:
        print(f"[API ERROR] GET /api/research/observe: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan saat mengambil data observasi.")

@app.post("/api/research/observe")
async def add_observation(req: ObservationRequest):
    """Add manual observation record (Hidden Research Feature)"""
    pool = await get_db_pool()
    try:
        async with pool.acquire() as conn:
            # check if cow exists
            hewan_exists = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM hewan WHERE UPPER(id) = UPPER($1))", req.cow_id)
            if not hewan_exists:
                raise HTTPException(status_code=404, detail=f"Sapi dengan ID {req.cow_id} tidak ditemukan.")
            
            # Insert into observation_logs
            await conn.execute("""
                INSERT INTO observation_logs (cow_id, activity_type, notes)
                VALUES ($1, $2, $3)
            """, req.cow_id.upper(), req.activity_type.upper(), req.notes)

        return {"status": "success", "message": "Observation logged successfully!"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API ERROR] POST /api/research/observe: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan saat menyimpan observasi.")

@app.get("/api/breeds")
async def get_breeds():
    """Get all breeds"""
    pool = await get_db_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM breed ORDER BY nama_breed")
            return [dict(row) for row in rows]
    except Exception as e:
        print(f"[WARN] Breed table error: {str(e)}")
        return []

@app.get("/api/kandang")
async def get_kandang():
    """Get all kandang"""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM kandang ORDER BY id")
        return [dict(row) for row in rows]

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(
    # INI KUNCINYA: Kita paksa API minta User Data dulu sebelum jalan
    current_user: dict = Depends(get_current_user)
):
    """Get real summary statistics FILTERED BY USER"""
    pool = await get_db_pool()
    try:
        async with pool.acquire() as conn:
            owner_id = get_effective_owner_id(current_user)
            print(f"DEBUG: Mengambil data dashboard untuk User: {current_user['email']} (Effective Owner ID: {owner_id})")

            # 1. Total Cattle (HANYA MILIK FARM INI)
            total_cattle = await conn.fetchval(
                "SELECT COUNT(*) FROM hewan WHERE owner_id = $1", 
                owner_id
            )
            
            # 2. High Risk (Filter join ke tabel hewan -> owner_id)
            high_risk = await conn.fetchval("""
                SELECT COUNT(DISTINCT a.cow_id) 
                FROM ai_predictions a
                JOIN hewan h ON a.cow_id = h.id
                WHERE a.prediction_type = 'ESTRUS' 
                AND a.prediction_result = 'HIGH'
                AND a.prediction_ts > NOW() - INTERVAL '48 hours'
                AND h.owner_id = $1
            """, owner_id)
            
            # 3. Pregnant (Filter join ke tabel hewan)
            pregnant = await conn.fetchval("""
                SELECT COUNT(r.id) 
                FROM reproduksi_ternak r
                JOIN hewan h ON r.rfid = h.id
                WHERE r.results = TRUE AND r.hpl > CURRENT_DATE
                AND h.owner_id = $1
            """, owner_id)
            
            # 4. Sensors Active (Filter join ke hewan)
            sensors_active = await conn.fetchval("""
                SELECT COUNT(cr.collar_id) 
                FROM collar_registry cr
                JOIN hewan h ON cr.cow_id = h.id
                WHERE cr.status = 'ACTIVE'
                AND h.owner_id = $1
            """, owner_id)

            # 5. Average Temperature of active collars (last 24 hours)
            avg_temp_val = await conn.fetchval("""
                SELECT ROUND(AVG(sd.temperature)::numeric, 1)
                FROM sensor_data sd
                JOIN collar_registry cr ON sd.collar_id = cr.collar_id
                JOIN hewan h ON cr.cow_id = h.id
                WHERE cr.status = 'ACTIVE'
                AND h.owner_id = $1
                AND sd.batch_ts > NOW() - INTERVAL '24 hours'
            """, owner_id)
            avg_temp = float(avg_temp_val) if avg_temp_val else None

            # 6. Breeding Windows (cows in HIGH or MEDIUM estrus risk in the last 48 hours)
            ib_windows = await conn.fetchval("""
                SELECT COUNT(DISTINCT a.cow_id) 
                FROM ai_predictions a
                JOIN hewan h ON a.cow_id = h.id
                WHERE a.prediction_type = 'ESTRUS' 
                AND a.prediction_result IN ('HIGH', 'MEDIUM')
                AND a.prediction_ts > NOW() - INTERVAL '48 hours'
                AND h.owner_id = $1
            """, owner_id)

            # 7. AI Accuracy score (percentage of correct predictions from user feedback on prediksi_birahi)
            ai_conf_val = await conn.fetchval("""
                SELECT ROUND(
                    (COUNT(CASE WHEN verified = TRUE THEN 1 END) * 100.0) / 
                    NULLIF(COUNT(CASE WHEN verified IS NOT NULL THEN 1 END), 0)
                )::integer
                FROM prediksi_birahi
                WHERE owner_id = $1
            """, owner_id)
            ai_conf = int(ai_conf_val) if ai_conf_val is not None else None

            # 8. Last Sync string representation (time elapsed since last active collar sensor update)
            latest_ts = await conn.fetchval("""
                SELECT MAX(sd.batch_ts)
                FROM sensor_data sd
                JOIN collar_registry cr ON sd.collar_id = cr.collar_id
                JOIN hewan h ON cr.cow_id = h.id
                WHERE cr.status = 'ACTIVE'
                AND h.owner_id = $1
            """, owner_id)
            if latest_ts:
                diff = (datetime.now(timezone.utc).replace(tzinfo=None) - latest_ts.replace(tzinfo=None)).total_seconds() / 60
                if diff < 1:
                    last_sync = "Just now"
                elif diff < 60:
                    last_sync = f"{int(diff)} min ago"
                else:
                    last_sync = f"{int(diff / 60)} hr ago"
            else:
                last_sync = "Never"
            
            return {
                "total_cattle": total_cattle or 0,
                "high_risk": high_risk or 0,
                "pregnant": pregnant or 0,
                "sensors_active": sensors_active or 0,
                "avg_temp": avg_temp,
                "ib_windows": ib_windows or 0,
                "ai_conf": ai_conf,
                "last_sync": last_sync
            }
    except Exception as e:
        print(f" [DASHBOARD STATS ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard/estrus-summary")
async def get_estrus_summary(current_user: dict = Depends(get_current_user)):
    """Get distribution of estrus risk for donut chart (FILTERED)"""
    pool = await get_db_pool()
    owner_id = get_effective_owner_id(current_user)
    try:
        async with pool.acquire() as conn:
            # 1. High Risk (Owner's cattle)
            high = await conn.fetchval("""
                SELECT COUNT(DISTINCT ap.cow_id) FROM ai_predictions ap
                JOIN hewan h ON ap.cow_id = h.id
                WHERE h.owner_id = $1 AND ap.prediction_type='ESTRUS' AND ap.prediction_result='HIGH'
            """, owner_id)
            
            # 2. Medium Risk
            medium = await conn.fetchval("""
                SELECT COUNT(DISTINCT ap.cow_id) FROM ai_predictions ap
                JOIN hewan h ON ap.cow_id = h.id
                WHERE h.owner_id = $1 AND ap.prediction_type='ESTRUS' AND ap.prediction_result='MEDIUM'
            """, owner_id)
            
            # 3. Low Risk (Total cattle - high - medium)
            total = await conn.fetchval("SELECT COUNT(*) FROM hewan WHERE owner_id = $1", owner_id)
            low = max(0, (total or 0) - (high or 0) - (medium or 0))
            
            return {
                "high": high or 0,
                "medium": medium or 0,
                "low": low or 0
            }
    except Exception as e:
        print(f" [ESTRUS SUMMARY ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard/high-risk-list")
async def get_high_risk_list(current_user: dict = Depends(get_current_user)):
    """Get list of high risk cattle for 'Upcoming Actions' (FILTERED)"""
    pool = await get_db_pool()
    owner_id = get_effective_owner_id(current_user)
    try:
        async with pool.acquire() as conn:
            # Join with hewan to check ownership
            rows = await conn.fetch("""
                SELECT 
                    a.cow_id,
                    h.nama as cow_name,
                    a.collar_id,
                    a.prediction_result as risk_level,
                    a.prediction_ts as timestamp
                FROM ai_predictions a
                JOIN hewan h ON a.cow_id = h.id
                WHERE h.owner_id = $1
                AND a.prediction_type = 'ESTRUS' 
                AND a.prediction_result IN ('HIGH', 'MEDIUM')
                ORDER BY a.prediction_ts DESC
                LIMIT 5
            """, owner_id)
            
            return [dict(row) for row in rows]
    except Exception as e:
        print(f" [HIGH RISK LIST ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search")
async def global_search(
    q: str, 
    current_user: dict = Depends(get_current_user) # 1. Wajib lapor diri dulu
):
    """Global search for cattle FILTERED BY USER"""
    pool = await get_db_pool()
    try:
        async with pool.acquire() as conn:
            user_id = current_user['id']
            
            # 2. Update SQL: Tambahkan (AND h.owner_id = $2)
            cattle_results = await conn.fetch("""
                SELECT 
                    h.id as rfid,
                    h.nama,
                    h.jenis,
                    cr.collar_id,
                    h.status_kesehatan
                FROM hewan h
                LEFT JOIN collar_registry cr ON h.id = cr.cow_id
                WHERE 
                    (LOWER(h.nama) LIKE LOWER($1) OR
                     LOWER(h.id) LIKE LOWER($1) OR
                     LOWER(cr.collar_id) LIKE LOWER($1))
                    AND h.owner_id = $2  -- FILTER PENTING DISINI
                LIMIT 10
            """, f"%{q}%", user_id)
            
            return {
                "cattle": [dict(row) for row in cattle_results],
                "query": q
            }
    except Exception as e:
        print(f" [SEARCH ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/notifications/recent")
async def get_recent_notifications(limit: int = 5, current_user: dict = Depends(get_current_user)):
    """Get recent notifications for the bell icon (FILTERED)"""
    pool = await get_db_pool()
    owner_id = get_effective_owner_id(current_user)
    try:
        async with pool.acquire() as conn:
            # Get recent AI predictions (estrus alerts) for owner's cattle
            notifications = await conn.fetch("""
                SELECT 
                    a.id,
                    a.cow_id,
                    h.nama as cow_name,
                    a.prediction_type,
                    a.prediction_result as severity,
                    a.confidence_score,
                    a.prediction_ts as timestamp
                FROM ai_predictions a
                JOIN hewan h ON a.cow_id = h.id
                WHERE h.owner_id = $1
                AND a.prediction_type = 'ESTRUS'
                AND a.prediction_result IN ('HIGH', 'MEDIUM')
                ORDER BY a.prediction_ts DESC
                LIMIT $2
            """, owner_id, limit)
            
            # Count unread (last 24 hours as "new") for owner's cattle
            unread_count = await conn.fetchval("""
                SELECT COUNT(*) FROM ai_predictions a
                JOIN hewan h ON a.cow_id = h.id
                WHERE h.owner_id = $1
                AND a.prediction_type = 'ESTRUS'
                AND a.prediction_result IN ('HIGH', 'MEDIUM')
                AND a.prediction_ts > NOW() - INTERVAL '24 hours'
            """, owner_id)
            
            return {
                "notifications": [dict(row) for row in notifications],
                "unread_count": unread_count or 0
            }
    except Exception as e:
        print(f" [NOTIFICATIONS ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/predict/batch/run")
async def run_batch_prediction(current_user: dict = Depends(get_current_user)):
    user_id = int(current_user['id'])
    print(f"[BATCH PREDICT] Starting for user_id={user_id}")
    pool = await get_db_pool()
    results = []
    async with pool.acquire() as conn:
        cattle = await conn.fetch("SELECT id, nama FROM hewan WHERE owner_id = $1", user_id)
        print(f"[BATCH PREDICT] Found {len(cattle)} cattle")
        for cow in cattle:
            cow_id = cow['id']
            cow_name = cow['nama']
            try:
                # 1. Look up collar_id from collar_registry (more reliable)
                collar_row = await conn.fetchrow(
                    "SELECT collar_id FROM collar_registry WHERE cow_id = $1 AND status = 'ACTIVE' LIMIT 1",
                    cow_id,
                )
                # Fallback: check collar_registry without status filter
                if not collar_row:
                    collar_row = await conn.fetchrow(
                        "SELECT collar_id FROM collar_registry WHERE cow_id = $1 LIMIT 1",
                        cow_id,
                    )
                if not collar_row or not collar_row['collar_id']:
                    print(f"[BATCH PREDICT] No collar for {cow_name} ({cow_id}), skipping")
                    continue

                collar_id = collar_row['collar_id']

                # 2. Latest sensor data
                sensor = await conn.fetchrow("""
                    SELECT mean_z, rms_z, max_z, temperature
                    FROM sensor_data
                    WHERE collar_id = $1
                    ORDER BY created_at DESC LIMIT 1
                """, collar_id)
                if not sensor:
                    print(f"[BATCH PREDICT] No sensor data for collar {collar_id}, skipping")
                    continue

                # 3. Reproduction data (null-safe)
                repro = await conn.fetchrow("""
                    SELECT
                        COALESCE(EXTRACT(DAY FROM NOW() - MAX(birahi)), 21)::float AS days_since,
                        21.0::float AS cycle_avg,
                        COUNT(*)::int AS parity
                    FROM reproduksi_ternak WHERE rfid = $1
                """, cow_id)

                days_since = float(repro['days_since'] or 21.0) if repro else 21.0
                cycle_avg  = float(repro['cycle_avg']  or 21.0) if repro else 21.0
                parity     = int(repro['parity']       or 0)    if repro else 0

                # 4. Run hybrid model
                svm_p, xgb_p, hybrid = run_hybrid_prediction(
                    float(sensor['mean_z']     or -0.97),
                    float(sensor['rms_z']      or  0.97),
                    float(sensor['max_z']      or -0.95),
                    float(sensor['temperature'] or 38.5),
                    days_since, cycle_avg, parity,
                )

                # 5. Persist
                await conn.execute("""
                    INSERT INTO ai_predictions
                        (cow_id, collar_id, prediction_type, confidence_score,
                         prediction_result, prediction_ts, model_version)
                    VALUES ($1, $2, 'hybrid_estrus', $3, $4, NOW(), 'xgb_v1+svm_v2')
                """, cow_id, collar_id, hybrid,
                    'estrus' if hybrid >= THRESHOLD else 'non_estrus')

                results.append({
                    "cow_id": cow_id, "nama": cow_name,
                    "collar_id": collar_id,
                    "hybrid_score": round(hybrid, 4),
                    "estrus": hybrid >= THRESHOLD
                })
                print(f"[BATCH PREDICT] ✅ {cow_name}: score={round(hybrid,4)}, estrus={hybrid >= THRESHOLD}")

            except Exception as e:
                import traceback
                print(f"[BATCH PREDICT ERROR] {cow_id} ({cow_name}): {e}")
                traceback.print_exc()
                continue

    print(f"[BATCH PREDICT] Done. Processed {len(results)} cattle.")
    return {"success": True, "processed": len(results), "results": results}

@app.get("/api/ai-predictions")
async def get_ai_predictions(current_user: dict = Depends(get_current_user), limit: int = 50):
    owner_id = get_effective_owner_id(current_user)
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT p.id, p.cow_id, h.nama AS cow_name,
                   p.collar_id, p.prediction_type, p.confidence_score,
                   p.prediction_result, p.prediction_ts, p.model_version
            FROM ai_predictions p
            LEFT JOIN hewan h ON h.id = p.cow_id
            WHERE h.owner_id = $1
            ORDER BY p.prediction_ts DESC LIMIT $2
        """, owner_id, limit)
        return [dict(r) for r in rows]

# ── Estrus Predictions from prediksi_birahi (3-Layer Hybrid Engine) ──────────

@app.get("/api/estrus-predictions")
async def get_estrus_predictions(
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    status: str = "active"
):
    """
    Ambil prediksi estrus dari tabel prediksi_birahi.
    Ini adalah output dari 3-layer hybrid prediction engine (Layer 1 calendar, 
    Layer 2 sensor SVM, Layer 3 XGBoost historical).
    """
    owner_id = get_effective_owner_id(current_user)
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                pb.id,
                pb.rfid AS cow_id,
                h.nama  AS cow_name,
                h.jenis AS breed,
                pb.prediksi_tanggal,
                pb.prediksi_ib_optimal,
                pb.window_awal,
                pb.window_akhir,
                pb.confidence_layer1,
                pb.confidence_layer2,
                pb.confidence_layer3,
                pb.confidence_final,
                pb.metode,
                pb.status,
                pb.verified,
                pb.created_at,
                -- Days until next predicted estrus
                (pb.prediksi_tanggal - CURRENT_DATE)::int AS days_until,
                -- Is in window right now?
                (CURRENT_DATE BETWEEN pb.window_awal AND pb.window_akhir) AS in_window_now
            FROM prediksi_birahi pb
            LEFT JOIN hewan h ON h.id = pb.rfid
            WHERE pb.owner_id = $1
              AND ($2::text = 'all' OR pb.status = $2)
            ORDER BY pb.prediksi_tanggal ASC
            LIMIT $3
        """, owner_id, status, limit)
        return [dict(r) for r in rows]


class FeedbackPayload(BaseModel):
    verified: bool


@app.post("/api/estrus-predictions/{prediction_id}/feedback")
async def save_prediction_feedback(
    prediction_id: int,
    payload: FeedbackPayload,
    current_user: dict = Depends(get_current_user)
):
    owner_id = get_effective_owner_id(current_user)
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        # Verify ownership
        exists = await conn.fetchval(
            "SELECT 1 FROM prediksi_birahi WHERE id = $1 AND owner_id = $2",
            prediction_id, owner_id
        )
        if not exists:
            raise HTTPException(status_code=404, detail="Prediksi tidak ditemukan atau bukan milik Anda.")
        
        await conn.execute("""
            UPDATE prediksi_birahi
            SET verified = $1,
                verified_at = CURRENT_TIMESTAMP,
                status = 'verified',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        """, payload.verified, prediction_id)
        
        return {"status": "ok", "message": "Feedback berhasil disimpan"}


@app.post("/api/estrus-predictions/run")
async def run_estrus_predictions(
    current_user: dict = Depends(get_current_user)
):
    """
    Jalankan ulang prediksi 3-layer untuk semua sapi milik user.
    Menggunakan predict_estrus() async dari prediction_engine.py (Layer 1 + 2 + 3).
    Hasilnya disimpan ke prediksi_birahi.
    """
    from prediction_engine import predict_estrus
    owner_id = get_effective_owner_id(current_user)
    pool = await get_db_pool()
    results = []
    errors  = []

    async with pool.acquire() as conn:
        cattle = await conn.fetch(
            "SELECT id, nama FROM hewan WHERE owner_id = $1", owner_id
        )
        print(f"[ESTRUS PREDICT] Starting for owner={owner_id}, {len(cattle)} cattle")

        for cow in cattle:
            rfid     = cow["id"]
            cow_name = cow["nama"]
            try:
                result = await predict_estrus(conn, rfid, owner_id)
                results.append({
                    "rfid":             rfid,
                    "cow_name":         cow_name,
                    "status":           result.get("status"),
                    "confidence_final": result.get("confidence_final"),
                    "prediksi_tanggal": str(result.get("prediksi_tanggal", "")),
                    "metode":           result.get("metode"),
                })
                print(f"[ESTRUS PREDICT] ✅ {cow_name} ({rfid}): {result.get('status')} conf={result.get('confidence_final', 0):.3f}")
            except Exception as e:
                import traceback
                errors.append({"rfid": rfid, "cow_name": cow_name, "error": str(e)})
                print(f"[ESTRUS PREDICT] ❌ {cow_name} ({rfid}): {e}")
                traceback.print_exc()

    print(f"[ESTRUS PREDICT] Done. {len(results)} ok, {len(errors)} errors.")
    return {
        "success":   True,
        "processed": len(results),
        "errors":    len(errors),
        "results":   results,
        "error_details": errors if errors else None,
    }

@app.post("/api/scan-rfid")
async def scan_rfid(request: ScannerRequest):
    """Handle RFID scans from hardware (ESP32 PN532)"""
    # 1. Device Verification (Secure Pattern)
    # Note: Scanner uses device_id "RFID_SCANNER_01"
    ok, reason, _ = await verify_device("RFID_SCANNER_01", request.device_secret)
    if not ok:
        print(f" [SCAN SECURITY DROP] RFID_SCANNER_01 -> {reason}")
        raise HTTPException(status_code=401, detail=f"Unauthorized: {reason}")

    pool = await get_db_pool()
    try:
        async with pool.acquire() as conn:
            # 2. Get Animal Profile (Hewan)
            hewan = await conn.fetchrow("SELECT * FROM hewan WHERE id = $1", request.uid)
            
            if not hewan:
                print(f" [SCAN] Unknown RFID: {request.uid}")
                return {
                    "success": True,
                    "nama": "Unknown",
                    "jenis": request.uid,
                    "registered": False
                }

            # 3. Get Repro Data
            repro = await conn.fetchrow("""
                SELECT * FROM reproduksi_ternak 
                WHERE rfid = $1 
                ORDER BY updated_at DESC LIMIT 1
            """, request.uid)

            # 4. Prepare Telegram Notification
            target_chats = [request.chatId] if request.chatId else TELEGRAM_CHAT_IDS
            
            alert_msg = (
                f" <b>SCAN RFID DETEKSI</b>\n\n"
                f" <b>Sapi:</b> {hewan['nama']} ({hewan['id']})\n"
                f" <b>Jenis:</b> {hewan['jenis']}\n"
                f" <b>Kesehatan:</b> {hewan['status_kesehatan'] or '-'}\n"
                f" <b>Waktu:</b> {datetime.now(WITA).strftime('%H:%M:%S WITA')}\n"
            )
            
            if repro:
                alert_msg += f"\n <b>Status Reproduksi:</b>\n"
                if repro['birahi']: alert_msg += f" Birahi: {repro['birahi'].strftime('%d/%m/%Y')}\n"
                if repro['hpl']: alert_msg += f" HPL: {repro['hpl'].strftime('%d/%m/%Y')}\n"
            
            # Send alert (enqueued to task queue)
            for chat_id in target_chats:
                if chat_id:
                    enqueue_task(send_telegram_alert, message=alert_msg)

            print(f" [SCAN] Recognized: {hewan['nama']} ({request.uid})")
            return {
                "success": True,
                "nama": hewan['nama'],
                "jenis": hewan['jenis'],
                "registered": True
            }

    except Exception as e:
        print(f" [SCAN API ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================
# TELEGRAM SETTINGS
# ==========================

@app.get("/api/user/telegram-settings")
async def get_telegram_settings(current_user: dict = Depends(get_current_user)):
    """Get Telegram Chat ID from DB"""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT telegram_chat_id FROM user_preferences WHERE user_id = $1",
            int(current_user['id'])
        )
        chat_id = row['telegram_chat_id'] if row else None
        # Mask sebagian untuk keamanan: 1234***789
        masked = None
        if chat_id and len(chat_id) > 4:
            masked = chat_id[:3] + '***' + chat_id[-3:]
        elif chat_id:
            masked = '***'
        return {
            "has_chat_id": bool(chat_id),
            "chat_id_masked": masked
        }


@app.put("/api/user/telegram-settings")
async def save_telegram_settings(
    data: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Save Telegram Chat ID to DB (upsert)"""
    chat_id = str(data.get("telegram_chat_id", "")).strip()
    if not chat_id:
        raise HTTPException(status_code=400, detail="Chat ID tidak boleh kosong")

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        # Upsert: insert kalau belum ada, update kalau sudah ada
        await conn.execute("""
            INSERT INTO user_preferences (user_id, telegram_chat_id, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET telegram_chat_id = $2, updated_at = NOW()
        """, int(current_user['id']), chat_id)
    return {"status": "success", "message": "Chat ID tersimpan"}


@app.post("/api/user/telegram-test")
async def test_telegram(current_user: dict = Depends(get_current_user)):
    """Send test message to user's Telegram Chat ID"""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT telegram_chat_id FROM user_preferences WHERE user_id = $1",
            int(current_user['id'])
        )

    if not row or not row['telegram_chat_id']:
        raise HTTPException(status_code=400, detail="Chat ID belum disimpan. Simpan dulu sebelum test.")

    chat_id  = row['telegram_chat_id']
    user_name = current_user.get('full_name') or current_user.get('email', 'Peternak')
    now_str  = datetime.now(WITA).strftime('%d %b %Y, %H:%M WITA')

    test_msg = (
        f"✅ <b>Koneksi Berhasil!</b>\\n\\n"
        f"Halo {user_name}!\\n"
        f"Notifikasi Estrus AI sudah aktif.\\n"
        f"Waktu: {now_str}\\n\\n"
        f"Kamu akan menerima alert:\\n"
        f"• 🐄 Deteksi birahi sapi\\n"
        f"• ⚠️ Anomali suhu\\n"
        f"• 📋 Laporan harian (06:00 WITA)"
    )

    # Kirim langsung ke chat_id spesifik user ini (bukan TELEGRAM_CHAT_IDS global)
    success = await asyncio.to_thread(_send_single_telegram, chat_id, test_msg)

    if success:
        return {"status": "success", "message": "Pesan test berhasil dikirim!"}
    else:
        raise HTTPException(status_code=500, detail="Gagal kirim pesan. Cek Chat ID dan Bot Token di .env")

@app.get("/api/user/notification-preferences")
async def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT notif_estrus, notif_anomaly, notif_daily, notif_breeding
            FROM user_preferences WHERE user_id = $1
            """,
            int(user_id),
        )
        if row:
            return {
                "notif_estrus":   row["notif_estrus"],
                "notif_anomaly":  row["notif_anomaly"],
                "notif_daily":    row["notif_daily"],
                "notif_breeding": row["notif_breeding"],
            }
        return {
            "notif_estrus":   True,
            "notif_anomaly":  True,
            "notif_daily":    True,
            "notif_breeding": False,
        }


@app.put("/api/user/notification-preferences")
async def update_notification_preferences(
    prefs: dict,
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["id"])
    allowed = {"notif_estrus", "notif_anomaly", "notif_daily", "notif_breeding"}
    filtered = {k: bool(v) for k, v in prefs.items() if k in allowed}
    if not filtered:
        raise HTTPException(status_code=400, detail="Tidak ada field valid untuk diupdate.")
 
    pool = await get_db_pool()   # <-- pakai get_db_pool(), bukan app.state.db_pool
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO user_preferences (user_id)
            VALUES ($1)
            ON CONFLICT (user_id) DO NOTHING
            """,
            user_id,
        )

        set_clauses = ", ".join(f"{col} = ${i+2}" for i, col in enumerate(filtered))
        values = list(filtered.values())
        await conn.execute(
            f"UPDATE user_preferences SET {set_clauses} WHERE user_id = $1",
            user_id, *values,
        )
 
    return {"status": "success", "updated": filtered}

def _send_single_telegram(chat_id: str, text: str) -> bool:
    """Helper: send to single chat_id only (not broadcast)"""
    if not TELEGRAM_BOT_TOKEN:
        print("[TELEGRAM] Token not set")
        return False
    url     = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        resp = requests.post(url, json=payload, timeout=5)
        return resp.status_code == 200
    except Exception as e:
        print(f"[TELEGRAM ERROR] {e}")
        return False




# NOTE: _send_daily_summary_job is defined above near line 613.
# Duplicate definition removed to fix Pyright reportRedeclaration error.

# ==========================
# IOT DEVICE PROVISIONING
# ==========================
class PairDevice(BaseModel):
    device_id: str
    cattle_id: str

class UnpairDevice(BaseModel):
    device_id: str

@app.get("/api/iot/devices")
async def get_iot_devices(current_user: dict = Depends(get_current_user)):
    owner_id = get_effective_owner_id(current_user)
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        q = """
            SELECT cr.collar_id as device_id, cr.status, cr.cow_id as cattle_id, h.nama as cattle_name,
            (SELECT battery_percent FROM sensor_data 
             WHERE collar_id = cr.collar_id 
             ORDER BY batch_ts DESC LIMIT 1) as battery_pct
            FROM collar_registry cr
            LEFT JOIN hewan h ON h.id = cr.cow_id
            WHERE cr.cow_id IS NULL OR h.owner_id = $1
        """
        rows = await conn.fetch(q, owner_id)
        return [dict(row) for row in rows]

@app.post("/api/iot/pair")
async def pair_iot_device(data: PairDevice, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') == 'worker':
        raise HTTPException(status_code=403, detail="Pekerja tidak berhak memasangkan perangkat IoT.")
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        cow = await conn.fetchrow("SELECT id FROM hewan WHERE id = $1 AND owner_id = $2", data.cattle_id, get_effective_owner_id(current_user))
        if not cow:
            raise HTTPException(status_code=403, detail="Sapi tidak ditemukan atau bukan milik tim Anda.")
        dev = await conn.fetchrow("SELECT cow_id FROM collar_registry WHERE collar_id = $1", data.device_id)
        if not dev:
            raise HTTPException(status_code=404, detail="Perangkat kalung tidak terdaftar di sistem.")
        await conn.execute("UPDATE collar_registry SET cow_id = $1 WHERE collar_id = $2", data.cattle_id, data.device_id)
        await conn.execute("UPDATE hewan SET collar_id = $1 WHERE id = $2", data.device_id, data.cattle_id)
        return {"message": "Berhasil dipasangkan", "device_id": data.device_id, "cattle_id": data.cattle_id}

@app.post("/api/iot/unpair")
async def unpair_iot_device(data: UnpairDevice, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') == 'worker':
        raise HTTPException(status_code=403, detail="Pekerja tidak berhak melepas perangkat IoT.")
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        dev = await conn.fetchrow("SELECT cow_id FROM collar_registry WHERE collar_id = $1", data.device_id)
        if not dev:
            raise HTTPException(status_code=404, detail="Perangkat kalung tidak terdaftar.")
        if dev['cow_id']:
            cow = await conn.fetchrow("SELECT owner_id FROM hewan WHERE id = $1", dev['cow_id'])
            if cow and cow['owner_id'] != get_effective_owner_id(current_user):
                raise HTTPException(status_code=403, detail="Tidak berhak melepas perangkat sapi ini (milik tim lain).")
        await conn.execute("UPDATE collar_registry SET cow_id = NULL WHERE collar_id = $1", data.device_id)
        await conn.execute("UPDATE hewan SET collar_id = NULL WHERE collar_id = $1", data.device_id)
        return {"message": "Berhasil dilepaskan", "device_id": data.device_id}

# ==========================
# ADMIN & TEAM MANAGEMENT
# ==========================

class TeamInvite(BaseModel):
    email: str
    role: str = "viewer"

class RoleUpdate(BaseModel):
    role: str

@app.get("/api/admin/users")
async def get_team_users(current_user: dict = Depends(get_current_user)):
    """List users belonging to the current owner's team"""
    if current_user.get('role') not in ['owner', 'admin']:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    
    owner_id = current_user.get('id')
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        users = await conn.fetch("""
            SELECT id, email, full_name, role 
            FROM users 
            WHERE id = $1 OR parent_id = $1
            ORDER BY role DESC, full_name ASC
        """, owner_id)
        return [dict(row) for row in users]

@app.post("/api/admin/users/invite")
async def invite_team_member(invite: TeamInvite, current_user: dict = Depends(get_current_user)):
    """Add a user to the team by email"""
    if current_user.get('role') not in ['owner', 'admin']:
        raise HTTPException(status_code=403, detail="Hanya owner/admin yang bisa menambah anggota tim")
    
    owner_id = current_user.get('id')
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        target_user = await conn.fetchrow("SELECT id FROM users WHERE email = $1", invite.email)
        if not target_user:
            raise HTTPException(status_code=404, detail="User tidak ditemukan. Minta mereka mendaftar dulu.")
        
        if target_user['id'] == owner_id:
            raise HTTPException(status_code=400, detail="Anda tidak bisa menambahkan diri sendiri")

        await conn.execute("""
            UPDATE users SET parent_id = $1, role = $2 WHERE id = $3
        """, owner_id, invite.role, target_user['id'])
        
        # SECURITY: Success message is the same regardless of whether user was newly invited
        # to avoid confirming existence of email if it failed before this point,
        # but here the user MUST exist to reach this point.
        # We sanitize the confirm email and name.
        return {"message": f"Anggota tim berhasil ditambahkan."}

@app.patch("/api/admin/users/{user_id}/role")
async def update_user_role(user_id: int, data: RoleUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') not in ['owner', 'admin']:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    
    owner_id = current_user.get('id')
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        # Ensure we only update someone in OUR team
        target = await conn.fetchrow("SELECT id FROM users WHERE id = $1 AND (parent_id = $2 OR id = $2)", user_id, owner_id)
        if not target:
            raise HTTPException(status_code=404, detail="User tidak ditemukan di tim Anda")

        await conn.execute("UPDATE users SET role = $1 WHERE id = $2", data.role, user_id)
        return {"message": "Role berhasil diperbarui"}

# NOTE: validation_exception_handler and general_exception_handler are defined above near line 127-189.
# Duplicate definitions removed to fix Pyright reportRedeclaration errors.
