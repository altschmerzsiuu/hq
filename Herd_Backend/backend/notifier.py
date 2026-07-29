import os
import requests
from datetime import datetime, timezone, timedelta

WITA = timezone(timedelta(hours=8))

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
# Fallback global chat IDs dari .env (untuk MQTT bridge yang tidak tahu user_id)
TELEGRAM_CHAT_IDS  = [x.strip() for x in os.getenv("TELEGRAM_CHAT_IDS", "").split(",") if x.strip()]


# ── Low-level sender ──────────────────────────────────────────────────────────

def _send_telegram(text: str, chat_ids: list = None) -> bool:
    """
    Send plain text ke daftar chat_id.
    chat_ids: kalau None, pakai TELEGRAM_CHAT_IDS dari .env (fallback)
    """
    if not TELEGRAM_BOT_TOKEN:
        print("[NOTIFIER] TELEGRAM_BOT_TOKEN not set, skipping.")
        return False

    targets = chat_ids if chat_ids else TELEGRAM_CHAT_IDS
    if not targets:
        print("[NOTIFIER] No chat_ids configured, skipping.")
        return False

    success = True
    for chat_id in targets:
        url     = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
        try:
            resp = requests.post(url, json=payload, timeout=5)
            if resp.status_code == 200:
                print(f"[NOTIFIER] Telegram OK → {chat_id}")
            else:
                print(f"[NOTIFIER] Telegram FAIL → {chat_id}: {resp.text}")
                success = False
        except Exception as e:
            print(f"[NOTIFIER] Telegram ERROR → {chat_id}: {e}")
            success = False
    return success


# ── Template builders (sama seperti sebelumnya) ───────────────────────────────

def _fmt_estrus_telegram(cow_name, collar_id, kandang_id, probability, temperature, dashboard_host):
    now = datetime.now(WITA).strftime("%d %b %Y, %H:%M WITA")
    return (
        "<b>ESTRUS ALERT — Estrus AI</b>\n\n"
        f"Sapi      : {cow_name} ({collar_id})\n"
        f"Kandang   : {kandang_id}\n"
        f"Probabilitas : {probability:.0f}%\n"
        f"Suhu Tubuh   : {temperature:.1f} C\n"
        f"Waktu        : {now}\n\n"
        "Waktu optimal IB: <b>12-24 jam ke depan</b>\n"
        f"<a href=\'http://{dashboard_host}:3030/pages/notifications.html\'>Buka Dashboard</a>"
    )


def _fmt_anomaly_telegram(cow_name, collar_id, temperature, normal_max, dashboard_host):
    now  = datetime.now(WITA).strftime("%d %b %Y, %H:%M WITA")
    diff = temperature - normal_max
    return (
        "<b>ANOMALI TERDETEKSI — Estrus AI</b>\n\n"
        f"Sapi             : {cow_name} ({collar_id})\n"
        f"Suhu Terdeteksi  : {temperature:.1f} C\n"
        f"Batas Normal     : {normal_max:.1f} C\n"
        f"Selisih          : +{diff:.1f} C\n"
        f"Waktu            : {now}\n\n"
        "Segera periksa kondisi sapi ini.\n"
        "Hubungi mantri jika suhu tidak turun dalam 1 jam."
    )


def _fmt_daily_telegram(total, sick, estrus_count, anomaly_count, dashboard_host):
    today = datetime.now(WITA).strftime("%d %B %Y")
    return (
        "<b>LAPORAN HARIAN — Estrus AI</b>\n"
        f"Tanggal: {today}\n\n"
        f"Total Sapi        : {total} ekor\n"
        f"Sakit             : {sick} ekor\n"
        f"Terdeteksi Birahi : {estrus_count} ekor (24 jam)\n"
        f"Anomali Suhu      : {anomaly_count} kejadian\n\n"
        "Laporan PDF &amp; pengingat kalender\n"
        "sudah dikirim ke email Anda.\n"
        f"<a href=\'http://{dashboard_host}:3030/\'>Buka Dashboard</a>"
    )


# ── Public API ────────────────────────────────────────────────────────────────

def send_estrus_alert(cow_name: str, collar_id: str, kandang_id: str,
                       probability: float = 90.0, temperature: float = 39.8,
                       chat_ids: list = None) -> bool:
    host = os.getenv("DASHBOARD_HOST", os.getenv("MQTT_BROKER_URL", "192.168.1.33"))
    msg  = _fmt_estrus_telegram(cow_name, collar_id, kandang_id, probability, temperature, host)
    return _send_telegram(msg, chat_ids=chat_ids)


def send_anomaly_alert(cow_name: str, collar_id: str,
                        temperature: float, normal_max: float = 39.5,
                        chat_ids: list = None) -> bool:
    host = os.getenv("DASHBOARD_HOST", os.getenv("MQTT_BROKER_URL", "192.168.1.33"))
    msg  = _fmt_anomaly_telegram(cow_name, collar_id, temperature, normal_max, host)
    return _send_telegram(msg, chat_ids=chat_ids)


def send_daily_summary(total: int, sick: int,
                        estrus_count: int, anomaly_count: int,
                        chat_ids: list = None) -> bool:
    host = os.getenv("DASHBOARD_HOST", os.getenv("MQTT_BROKER_URL", "192.168.1.33"))
    msg  = _fmt_daily_telegram(total, sick, estrus_count, anomaly_count, host)
    return _send_telegram(msg, chat_ids=chat_ids)