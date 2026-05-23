import json
import paho.mqtt.client as mqtt
import psycopg2  # type: ignore
import bcrypt
import threading
import hmac, hashlib
from psycopg2.extras import RealDictCursor  # type: ignore
import os
import requests  # type: ignore
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from notifier import send_estrus_alert, send_anomaly_alert
from mailer import (
    send_estrus_alert_email, 
    send_breeding_reminder_email
)

# Load environment variables
load_dotenv()

# Configuration
DB_CONFIG = {
    "host": os.getenv('DB_HOST', 'db'),
    "port": int(os.getenv('DB_PORT', 5432)),
    "database": os.getenv('DB_NAME', 'Collar_to_Gateway'),
    "user": os.getenv('DB_USER', 'postgres'),
    "password": os.getenv('DB_PASSWORD', 'postgre')
}

MQTT_BROKER_URL = os.getenv('MQTT_BROKER_URL', 'mqtt')
MQTT_BROKER_PORT = int(os.getenv('MQTT_BROKER_PORT', 1883))
MQTT_TOPIC = "kandang/sensor"

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_IDS = [x.strip() for x in os.getenv('TELEGRAM_CHAT_IDS', '').split(',') if x.strip()]

WITA = timezone(timedelta(hours=8))

from psycopg2 import pool  # type: ignore

# Initialize ThreadedConnectionPool
# minconn=1, maxconn=10 (adjust based on expected load)
db_pool = pool.ThreadedConnectionPool(1, 10, **DB_CONFIG)

import redis  # type: ignore
import time

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/0')
redis_client = redis.StrictRedis.from_url(REDIS_URL, decode_responses=True)

DEVICE_CACHE = {}

def get_db_connection():
    return db_pool.getconn()

def db_execute(query, params=None):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
        conn.commit()
    except Exception as e:
        print(f"❌ [DB EXECUTE ERROR] {e}")
        conn.rollback()
    finally:
        db_pool.putconn(conn)

def db_query(query, params=None):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            return cur.fetchall()
    except Exception as e:
        print(f"❌ [DB QUERY ERROR] {e}")
        return []
    finally:
        db_pool.putconn(conn)

def send_telegram_alert(message):
    if not TELEGRAM_BOT_TOKEN:
        print("[TELEGRAM] Token not found, skipping.")
        return
    
    for chat_id in TELEGRAM_CHAT_IDS:
        if not chat_id: continue
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {"chat_id": chat_id, "text": message, "parse_mode": "HTML"}
        try:
            resp = requests.post(url, json=payload, timeout=5)
            if resp.status_code == 200:
                print(f"✅ [TELEGRAM] Alert sent to {chat_id}")
            else:
                print(f"❌ [TELEGRAM] Failed to send: {resp.text}")
        except Exception as e:
            print(f"⚠️ [TELEGRAM ERROR] {str(e)}")

def verify_hmac_signature(raw_payload, secret_key, signature_to_check):
    # Find the index of ,"auth":"
    auth_marker = ',"auth":"'
    idx = raw_payload.rfind(auth_marker)
    if idx == -1:
        print("[HMAC DEBUG] auth_marker not found in payload")
        return False
    
    # Extract the payload that was signed
    signed_part = raw_payload[:idx]
    
    # Compute HMAC-SHA256
    computed_hmac = hmac.new(
        secret_key.encode('utf-8'),
        signed_part.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    print(f"[HMAC DEBUG]\n - Raw: {raw_payload}\n - Secret: {secret_key}\n - Signed part: {signed_part}\n - Received: {signature_to_check}\n - Computed: {computed_hmac}")
    
    return hmac.compare_digest(computed_hmac, signature_to_check)

def verify_device(collar_id, device_secret=None, auth_signature=None, raw_payload=None):
    now_ts = time.time()
    
    # Check cache for DB record to avoid excessive DB queries
    db_record = None
    if collar_id in DEVICE_CACHE:
        cache_entry = DEVICE_CACHE[collar_id]
        if now_ts - cache_entry['time'] < 300: # 5 min cache
            db_record = cache_entry['record']
            
    if not db_record:
        rows = db_query("""
            SELECT device_secret_hash, device_secret, status, kandang_id 
            FROM collar_registry 
            WHERE collar_id = %s
        """, (collar_id,))
        if not rows:
            return False, "UNKNOWN_DEVICE", None
        db_record = rows[0]
        DEVICE_CACHE[collar_id] = {
            'time': now_ts,
            'record': db_record
        }
    
    secret_hash = db_record['device_secret_hash']
    plain_secret = db_record['device_secret']
    status = db_record['status']
    kandang_id = db_record['kandang_id']
    
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
        else:
            print(f"❌ [SECURITY] Bcrypt validation failed for {collar_id}")
            return False, "INVALID_SECRET", None
    
    return False, "MISSING_CREDENTIALS", None

def save_sensor(data, kandang_id):
    ts_epoch = data.get('timestamp')
    if ts_epoch and ts_epoch > 1704067200:
        batch_ts = datetime.fromtimestamp(ts_epoch, tz=timezone.utc).replace(tzinfo=None)
    else:
        batch_ts = datetime.now(WITA).replace(tzinfo=None)

    now = datetime.now(WITA).replace(tzinfo=None)
    
    query = """
        INSERT INTO sensor_data 
        (kandang_id, collar_id, mean_z, rms_z, max_z, temperature, 
         activity_state, estrus_detected, battery_voltage, battery_percent, batch_ts, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
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
    db_execute(query, params)
    return True

from worker import enqueue_task

def handle_estrus_alert(collar_id, kandang_id, rms_z, temperature=39.8):
    rows = db_query("""
        SELECT h.id, h.nama, h.last_estrus_alert_at 
        FROM hewan h
        JOIN collar_registry cr ON cr.cow_id = h.id
        WHERE cr.collar_id = %s
    """, (collar_id,))
    
    if not rows: return
    
    row = rows[0]
    db_id, cow_name, last_alert = row['id'], row['nama'], row['last_estrus_alert_at']
    
    can_send = True
    now_wita = datetime.now(WITA).replace(tzinfo=None)
    
    if last_alert:
        diff = now_wita - last_alert
        if 0 <= diff.total_seconds() < 3600: # 1 hour cooldown
            can_send = False
            print(f"🔇 [COOLDOWN] Alert skipped for {collar_id}")

    if can_send:
        # 1. Update last alert time
        db_execute("UPDATE hewan SET last_estrus_alert_at = %s WHERE id = %s", (now_wita, db_id))
        
        # 2. Add to Dashboard Notifications Table
        msg_text = f"Aktivitas sangat tinggi terdeteksi! (RMS: {rms_z:.2f}). Potensi estrus tinggi."
        db_execute("""
            INSERT INTO notifications (cow_id, type, message) 
            VALUES (%s, 'ESTRUS', %s)
        """, (
            db_id, 
            msg_text
        ))

        # Emit real-time WebSocket notification via Postgres
        try:
            ws_payload = json.dumps({"type": "ESTRUS_ALERT", "cow_id": db_id, "message": msg_text})
            db_execute("SELECT pg_notify('ws_events', %s)", (ws_payload,))
        except:
            pass

        # 3. Send Telegram + Email Alerts (Enqueued to Task Queue)
        # 1. Telegram
        enqueue_task(
            send_estrus_alert,
            cow_name=cow_name,
            collar_id=collar_id,
            kandang_id=str(kandang_id),
            probability=90.0,
            temperature=temperature
        )

        user_email = db_query(
            "SELECT email FROM users WHERE id = (SELECT owner_id FROM hewan WHERE id = %s)", 
            (db_id,)
        )
        if user_email and user_email[0]['email']:
            email_addr = user_email[0]['email']
            
            # Send Email Alert
            enqueue_task(
                send_estrus_alert_email,
                to=email_addr,
                cow_name=cow_name,
                collar_id=collar_id,
                kandang_id=str(kandang_id),
                probability=90.0,
                temperature=temperature
            )

            # Send Breeding Reminder (.ics)
            enqueue_task(
                send_breeding_reminder_email,
                to=email_addr,
                cow_name=cow_name,
                collar_id=collar_id,
                kandang_id=str(kandang_id),
                estrus_detected_at=now_wita,
                probability=90.0
            )
            
        print(f"🔔 [ESTRUS] Alerts enqueued for {cow_name} ({collar_id})")

def process_redis_queue():
    print("🚀 Starting Redis Pop Worker...")
    while True:
        try:
            msgs = []
            while len(msgs) < 100:
                item = redis_client.rpop("sensor_queue")
                if not item:
                    break
                msgs.append(item)
            
            if not msgs:
                time.sleep(0.5)
                continue
                
            # Process batch
            valid_inserts = []
            estrus_events = []
            anomaly_events = []
            ws_updates = []
            
            now_dt = datetime.now(WITA).replace(tzinfo=None)
            
            for payload_raw in msgs:
                try:
                    data = json.loads(payload_raw)
                except Exception as e:
                    print(f"⚠️ [JSON ERROR] Failed to parse payload: {e}")
                    continue
                    
                collar_id = data.get('collar_id', 'UNKNOWN')
                auth_signature = data.get('auth')
                device_secret = data.get('device_secret')
                
                ok, reason, kandang_id = verify_device(
                    collar_id=collar_id,
                    device_secret=device_secret,
                    auth_signature=auth_signature,
                    raw_payload=payload_raw
                )
                if not ok:
                    continue
                    
                ts_epoch = data.get('timestamp')
                if ts_epoch and ts_epoch > 1704067200:
                    batch_ts = datetime.fromtimestamp(ts_epoch, tz=timezone.utc).replace(tzinfo=None)
                else:
                    batch_ts = now_dt
                
                valid_inserts.append((
                    kandang_id, data.get('collar_id'), data.get('mean_z', 0.0), data.get('rms_z', 0.0),
                    data.get('max_z', 0.0), data.get('temperature', 0.0), data.get('activity_state', 'UNKNOWN'),
                    data.get('estrus_code', 0), data.get('battery_voltage', 0.0), data.get('battery_percent', 0),
                    batch_ts, now_dt
                ))
                
                ws_updates.append({"type": "SENSOR_UPDATE", "collar_id": collar_id, "rms_z": float(data.get('rms_z') or 0), "temperature": float(data.get('temperature') or 0)})
                
                if data.get('estrus_code') == 1:
                    estrus_events.append((collar_id, kandang_id, data.get('rms_z', 0), data.get('temperature', 39.8)))
                
                temp = data.get('temperature', 0.0)
                if temp > 39.5:
                    anomaly_events.append((collar_id, temp))
                    
            # Bulk Insert
            if valid_inserts:
                query = """
                    INSERT INTO sensor_data 
                    (kandang_id, collar_id, mean_z, rms_z, max_z, temperature, 
                     activity_state, estrus_detected, battery_voltage, battery_percent, batch_ts, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                conn = get_db_connection()
                try:
                    with conn.cursor() as cur:
                        cur.executemany(query, valid_inserts)
                    conn.commit()
                    print(f"💾 [BULK INSERT] {len(valid_inserts)} records saved.")
                except Exception as e:
                    print(f"❌ [BULK INSERT ERROR] {e}")
                    conn.rollback()
                finally:
                    db_pool.putconn(conn)
                    
                # Broadcast WS
                for ws_up in ws_updates:
                    db_execute("SELECT pg_notify('ws_events', %s)", (json.dumps(ws_up),))
                    
                # Trigger alerts
                for ev in estrus_events:
                    handle_estrus_alert(*ev)
                    
                for anom in anomaly_events:
                    cid, t = anom
                    rows = db_query("SELECT h.nama FROM hewan h JOIN collar_registry cr ON cr.cow_id = h.id WHERE cr.collar_id = %s", (cid,))
                    cow_name = rows[0]['nama'] if rows else cid
                    enqueue_task(send_anomaly_alert, cow_name=cow_name, collar_id=cid, temperature=t)
                    
        except Exception as e:
            print(f"🔥 Redis Worker Error: {e}")
            time.sleep(2)

def on_message(client, userdata, msg):
    try:
        payload_raw = msg.payload.decode().strip()
        if not payload_raw or not payload_raw.startswith('{'): return
        
        # O(1) Push to Redis. The worker thread will handle parsing and DB insertion!
        redis_client.lpush("sensor_queue", payload_raw)
        
    except Exception as e:
        print(f"⚠️ [MSG ERROR] {str(e)}")

def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print(f"✅ Connected to MQTT Broker: {MQTT_BROKER_URL}")
        client.subscribe(MQTT_TOPIC)
    else:
        print(f"❌ Connection failed with code {rc}")

def init_notification_table():
    print("🛠️ Ensuring notifications table exists...")
    db_execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            cow_id VARCHAR(50),
            type VARCHAR(20),
            message TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

if __name__ == "__main__":
    init_notification_table()
    
    # Run database migration to ensure device_secret and updated_at columns exist
    print("🛠️ Ensuring collar_registry has device_secret column...")
    db_execute("ALTER TABLE collar_registry ADD COLUMN IF NOT EXISTS device_secret VARCHAR(100)")
    print("🛠️ Ensuring reproduksi_ternak has updated_at column...")
    db_execute("ALTER TABLE reproduksi_ternak ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    print("🛠️ Ensuring hewan has updated_at column...")
    db_execute("ALTER TABLE hewan ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    
    # Start Redis worker thread
    worker_thread = threading.Thread(target=process_redis_queue, daemon=True)
    worker_thread.start()
    
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message
    
    print(f"🔄 Starting MQTT Bridge on topic: {MQTT_TOPIC}")
    client.connect(MQTT_BROKER_URL, MQTT_BROKER_PORT, 60)
    
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("🛑 Bridge stopped.")
    except Exception as e:
        print(f"🔥 Critical Error: {e}")