# =============================================================================
# mailer.py — Step 5: Gmail API Email Sender
# Taruh di: docker-iot-system/backend/mailer.py
#
# SETUP GMAIL API (lakukan sekali):
# 1. Buka https://console.cloud.google.com → project yang sama dengan OAuth login
# 2. APIs & Services → Enable APIs → cari "Gmail API" → Enable
# 3. APIs & Services → Credentials → OAuth 2.0 Client IDs yang sudah ada
#    → Download JSON → rename jadi "gmail_credentials.json"
#    → Taruh di: docker-iot-system/backend/gmail_credentials.json
# 4. Tambah scope di OAuth consent screen:
#    → APIs & Services → OAuth consent screen → Edit App → Scopes
#    → Add scope: https://www.googleapis.com/auth/gmail.send
# 5. Jalankan sekali untuk generate token (dari luar Docker, di local):
#    cd docker-iot-system/backend
#    python3 mailer.py --setup
#    → Browser akan terbuka, login dengan akun Gmail pengirim
#    → Token tersimpan otomatis di gmail_token.json
# 6. Tambah ke .env:
#    GMAIL_SENDER=your-farm-email@gmail.com
# =============================================================================

import os
import base64
import json
import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime, timezone, timedelta
from pathlib import Path

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

WITA = timezone(timedelta(hours=8))

SCOPES             = ["https://www.googleapis.com/auth/gmail.send"]
CREDENTIALS_FILE   = Path(__file__).parent / "gmail_credentials.json"   # ← dari GCC
TOKEN_FILE         = Path(__file__).parent / "gmail_token.json"          # ← auto-generated
GMAIL_SENDER       = os.getenv("GMAIL_SENDER", "")                       # ← dari .env


# ── Auth ──────────────────────────────────────────────────────────────────────

def _get_gmail_service():
    """Build authenticated Gmail API service. Auto-refresh token kalau expired."""
    creds = None

    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    # Refresh kalau expired
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_FILE.write_text(creds.to_json())

    if not creds or not creds.valid:
        raise RuntimeError(
            "Gmail token tidak valid atau belum ada. "
            "Jalankan: python3 mailer.py --setup"
        )

    return build("gmail", "v1", credentials=creds)


def _encode_message(message: MIMEMultipart) -> dict:
    """Encode MIME message ke format yang diterima Gmail API."""
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return {"raw": raw}


# ── HTML Templates ────────────────────────────────────────────────────────────

def _html_daily_summary(total: int, sick: int, estrus_count: int,
                         anomaly_count: int, date_str: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background:#f8fafc; margin:0; padding:0; }}
  .container {{ max-width:560px; margin:32px auto; background:#fff;
                border-radius:16px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.08); }}
  .header {{ background:linear-gradient(135deg,#059669,#047857); padding:32px 32px 24px; color:#fff; }}
  .header h1 {{ margin:0; font-size:22px; font-weight:700; }}
  .header p  {{ margin:6px 0 0; font-size:13px; opacity:0.85; }}
  .body {{ padding:28px 32px; }}
  .stat-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:20px 0; }}
  .stat {{ background:#f1f5f9; border-radius:12px; padding:16px; text-align:center; }}
  .stat .num {{ font-size:28px; font-weight:800; color:#0f172a; }}
  .stat .label {{ font-size:11px; color:#64748b; margin-top:4px; text-transform:uppercase; letter-spacing:.05em; }}
  .stat.red   {{ background:#fef2f2; }} .stat.red   .num {{ color:#dc2626; }}
  .stat.amber {{ background:#fffbeb; }} .stat.amber .num {{ color:#d97706; }}
  .stat.green {{ background:#f0fdf4; }} .stat.green .num {{ color:#16a34a; }}
  .stat.blue  {{ background:#eff6ff; }} .stat.blue  .num {{ color:#2563eb; }}
  .footer {{ background:#f8fafc; padding:20px 32px; border-top:1px solid #e2e8f0;
             font-size:11px; color:#94a3b8; text-align:center; }}
  .cta {{ display:inline-block; margin:20px 0 8px; padding:12px 28px;
          background:#059669; color:#fff !important; border-radius:999px;
          text-decoration:none; font-weight:600; font-size:14px; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>📋 Laporan Harian</h1>
    <p>Estrus AI &nbsp;·&nbsp; {date_str}</p>
  </div>
  <div class="body">
    <p style="color:#475569;font-size:14px;margin:0 0 8px;">
      Berikut ringkasan kondisi peternakan kamu hari ini:
    </p>
    <div class="stat-grid">
      <div class="stat blue">
        <div class="num">{total}</div>
        <div class="label">Total Sapi</div>
      </div>
      <div class="stat {'red' if sick > 0 else 'green'}">
        <div class="num">{sick}</div>
        <div class="label">Sapi Sakit</div>
      </div>
      <div class="stat {'red' if estrus_count > 0 else 'green'}">
        <div class="num">{estrus_count}</div>
        <div class="label">Terdeteksi Birahi</div>
      </div>
      <div class="stat {'amber' if anomaly_count > 0 else 'green'}">
        <div class="num">{anomaly_count}</div>
        <div class="label">Anomali Suhu</div>
      </div>
    </div>
    {'<p style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 16px;color:#dc2626;font-size:13px;margin:16px 0;">⚠️ Ada sapi yang membutuhkan perhatian hari ini. Segera cek detail di dashboard.</p>' if (sick > 0 or estrus_count > 0 or anomaly_count > 0) else '<p style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;color:#16a34a;font-size:13px;margin:16px 0;">✅ Semua kondisi normal hari ini. Mantap!</p>'}
    <center><a href="#" class="cta">Buka Dashboard</a></center>
  </div>
  <div class="footer">
    Estrus AI &nbsp;·&nbsp; Sistem Monitoring Reproduksi Sapi Cerdas<br>
    Email ini dikirim otomatis setiap pagi jam 06:00 WITA.
  </div>
</div>
</body>
</html>
"""


def _html_estrus_alert(cow_name: str, collar_id: str, kandang_id: str,
                        probability: float, temperature: float) -> str:
    now = datetime.now(WITA).strftime("%d %b %Y, %H:%M WITA")
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body {{ font-family:'Segoe UI',Arial,sans-serif; background:#f8fafc; margin:0; padding:0; }}
  .container {{ max-width:520px; margin:32px auto; background:#fff;
                border-radius:16px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.08); }}
  .header {{ background:linear-gradient(135deg,#dc2626,#b91c1c); padding:28px 32px; color:#fff; }}
  .header h1 {{ margin:0; font-size:20px; font-weight:700; }}
  .header p  {{ margin:6px 0 0; font-size:13px; opacity:0.85; }}
  .body {{ padding:28px 32px; }}
  .info-row {{ display:flex; justify-content:space-between; align-items:center;
               padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:14px; }}
  .info-row:last-child {{ border:none; }}
  .info-label {{ color:#64748b; }}
  .info-value {{ font-weight:600; color:#0f172a; }}
  .prob-bar {{ background:#f1f5f9; border-radius:999px; height:8px; margin:16px 0; overflow:hidden; }}
  .prob-fill {{ height:100%; background:linear-gradient(90deg,#f59e0b,#dc2626);
                border-radius:999px; width:{min(probability,100):.0f}%; }}
  .cta {{ display:inline-block; margin:20px 0 0; padding:12px 28px;
          background:#dc2626; color:#fff !important; border-radius:999px;
          text-decoration:none; font-weight:600; font-size:14px; }}
  .footer {{ background:#f8fafc; padding:16px 32px; border-top:1px solid #e2e8f0;
             font-size:11px; color:#94a3b8; text-align:center; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🐄 Estrus Alert!</h1>
    <p>Deteksi birahi terdeteksi &nbsp;·&nbsp; {now}</p>
  </div>
  <div class="body">
    <p style="color:#475569;font-size:14px;margin:0 0 16px;">
      Sistem Estrus AI mendeteksi tanda-tanda birahi pada sapi berikut:
    </p>
    <div class="info-row"><span class="info-label">Nama Sapi</span><span class="info-value">{cow_name}</span></div>
    <div class="info-row"><span class="info-label">Collar ID</span><span class="info-value">{collar_id}</span></div>
    <div class="info-row"><span class="info-label">Kandang</span><span class="info-value">{kandang_id}</span></div>
    <div class="info-row"><span class="info-label">Suhu Tubuh</span><span class="info-value">{temperature:.1f} °C</span></div>
    <div class="info-row"><span class="info-label">Probabilitas Birahi</span><span class="info-value" style="color:#dc2626">{probability:.0f}%</span></div>
    <div class="prob-bar"><div class="prob-fill"></div></div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;margin-top:16px;">
      <p style="margin:0;color:#991b1b;font-size:13px;font-weight:600;">⏰ Waktu Optimal Inseminasi</p>
      <p style="margin:6px 0 0;color:#b91c1c;font-size:13px;">
        Lakukan IB dalam <strong>12–24 jam</strong> ke depan untuk hasil terbaik.
      </p>
    </div>
    <center><a href="#" class="cta">Buka Dashboard</a></center>
  </div>
  <div class="footer">Estrus AI &nbsp;·&nbsp; Notifikasi ini dikirim otomatis oleh sistem.</div>
</div>
</body>
</html>
"""


def _html_monthly_pdf_email(month_str: str, pdf_filename: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body {{ font-family:'Segoe UI',Arial,sans-serif; background:#f8fafc; margin:0; padding:0; }}
  .container {{ max-width:520px; margin:32px auto; background:#fff;
                border-radius:16px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.08); }}
  .header {{ background:linear-gradient(135deg,#7c3aed,#6d28d9); padding:28px 32px; color:#fff; }}
  .header h1 {{ margin:0; font-size:20px; font-weight:700; }}
  .header p  {{ margin:6px 0 0; font-size:13px; opacity:0.85; }}
  .body {{ padding:28px 32px; }}
  .attach-box {{ display:flex; align-items:center; gap:14px; padding:14px 16px;
                 background:#f5f3ff; border:1px solid #ddd6fe; border-radius:12px; margin:16px 0; }}
  .attach-icon {{ font-size:28px; }}
  .attach-info .name {{ font-weight:600; font-size:14px; color:#4c1d95; }}
  .attach-info .desc {{ font-size:12px; color:#7c3aed; margin-top:2px; }}
  .footer {{ background:#f8fafc; padding:16px 32px; border-top:1px solid #e2e8f0;
             font-size:11px; color:#94a3b8; text-align:center; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>📊 Laporan Bulanan</h1>
    <p>Estrus AI &nbsp;·&nbsp; {month_str}</p>
  </div>
  <div class="body">
    <p style="color:#475569;font-size:14px;margin:0 0 16px;">
      Laporan reproduksi bulanan peternakan kamu sudah siap. Terlampir file PDF lengkap.
    </p>
    <div class="attach-box">
      <div class="attach-icon">📎</div>
      <div class="attach-info">
        <div class="name">{pdf_filename}</div>
        <div class="desc">Laporan Reproduksi Bulanan — Estrus AI</div>
      </div>
    </div>
    <p style="color:#64748b;font-size:13px;">
      Laporan mencakup: ringkasan conception rate, daftar sapi birahi,
      jadwal IB, anomali suhu, dan rekomendasi bulan depan.
    </p>
  </div>
  <div class="footer">Estrus AI &nbsp;·&nbsp; Laporan dikirim otomatis setiap awal bulan.</div>
</div>
</body>
</html>
"""


# ── Core send function ────────────────────────────────────────────────────────

def _send_email(to: str, subject: str, html_body: str,
                pdf_bytes: bytes = None, pdf_filename: str = None) -> bool:
    """
    Kirim email HTML via Gmail API.
    pdf_bytes: opsional, kalau ada akan dilampirkan sebagai attachment.
    """
    if not GMAIL_SENDER:
        print("[MAILER] GMAIL_SENDER not set in .env, skipping.")
        return False
    if not to:
        print("[MAILER] No recipient email, skipping.")
        return False

    try:
        service = _get_gmail_service()

        msg = MIMEMultipart("mixed")
        msg["to"]      = to
        msg["from"]    = f"Estrus AI <{GMAIL_SENDER}>"
        msg["subject"] = subject

        # HTML body
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        # PDF attachment (opsional)
        if pdf_bytes and pdf_filename:
            part = MIMEApplication(pdf_bytes, _subtype="pdf")
            part.add_header("Content-Disposition", "attachment", filename=pdf_filename)
            msg.attach(part)

        service.users().messages().send(
            userId="me",
            body=_encode_message(msg)
        ).execute()

        print(f"[MAILER] Email sent → {to} | Subject: {subject}")
        return True

    except HttpError as e:
        print(f"[MAILER] Gmail API error: {e}")
        return False
    except RuntimeError as e:
        print(f"[MAILER] Auth error: {e}")
        return False
    except Exception as e:
        print(f"[MAILER] Unexpected error: {e}")
        return False


# ── Public API ────────────────────────────────────────────────────────────────

def send_daily_summary_email(to: str, total: int, sick: int,
                              estrus_count: int, anomaly_count: int) -> bool:
    """
    Kirim daily summary email.
    Dipanggil dari _send_daily_summary_job() di app.py (via asyncio.to_thread).

    Contoh:
        send_daily_summary_email(
            to="peternak@gmail.com",
            total=45, sick=2, estrus_count=3, anomaly_count=1
        )
    """
    date_str = datetime.now(WITA).strftime("%d %B %Y")
    subject  = f"[Estrus AI] Laporan Harian — {date_str}"
    html     = _html_daily_summary(total, sick, estrus_count, anomaly_count, date_str)
    return _send_email(to, subject, html)


def send_estrus_alert_email(to: str, cow_name: str, collar_id: str,
                             kandang_id: str, probability: float = 90.0,
                             temperature: float = 39.8) -> bool:
    """
    Kirim estrus alert email (detail lengkap, sebagai backup Telegram).
    Dipanggil dari handle_estrus_alert() di app.py (via asyncio.to_thread).
    """
    subject = f"[Estrus AI] 🐄 Estrus Alert — {cow_name}"
    html    = _html_estrus_alert(cow_name, collar_id, kandang_id,
                                  probability, temperature)
    return _send_email(to, subject, html)


def send_monthly_report_email(to: str, pdf_bytes: bytes, month_str: str = None) -> bool:
    """
    Kirim laporan bulanan PDF via email.
    pdf_bytes: hasil generate dari report_routes.py (ReportLab).
    Dipanggil dari scheduler bulanan di app.py.

    Contoh:
        pdf = generate_monthly_pdf(...)  # dari report_routes.py
        send_monthly_report_email(to="peternak@gmail.com", pdf_bytes=pdf)
    """
    if not month_str:
        month_str = datetime.now(WITA).strftime("%B %Y")
    filename = f"Laporan_Estrus_AI_{month_str.replace(' ','_')}.pdf"
    subject  = f"[Estrus AI] 📊 Laporan Bulanan — {month_str}"
    html     = _html_monthly_pdf_email(month_str, filename)
    return _send_email(to, subject, html, pdf_bytes=pdf_bytes, pdf_filename=filename)

# ==========================
# STEP 6: Breeding Reminder + .ics Attachment
# ==========================

def send_breeding_reminder_email(
    to: str,
    cow_name: str,
    collar_id: str,
    kandang_id: str,
    estrus_detected_at,          # datetime object
    probability: float = 90.0,
) -> bool:
    """
    Kirim email Breeding Reminder dengan .ics calendar attachment.
    Dipanggil dari handle_estrus_alert() di app.py (via asyncio.to_thread).

    Flow:
      Estrus detected → email terkirim → peternak klik .ics → masuk Google Calendar
    """
    from calendar_reminder import generate_ib_reminder_ics
    from datetime import timedelta

    # Generate .ics
    ics_bytes = generate_ib_reminder_ics(
        cow_name           = cow_name,
        collar_id          = collar_id,
        kandang_id         = kandang_id,
        estrus_detected_at = estrus_detected_at,
        probability        = probability,
    )

    # Hitung waktu optimal untuk ditampilkan di email body
    optimal_time = estrus_detected_at + timedelta(hours=15)
    optimal_str  = optimal_time.strftime("%d %b %Y, %H:%M WITA")
    detected_str = estrus_detected_at.strftime("%d %b %Y, %H:%M WITA")

    html = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8">
        <style>
        body {{ font-family:'Segoe UI',Arial,sans-serif; background:#f8fafc; margin:0; padding:0; }}
        .container {{ max-width:520px; margin:32px auto; background:#fff;
                        border-radius:16px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.08); }}
        .header {{ background:linear-gradient(135deg,#16a34a,#15803d); padding:28px 32px; color:#fff; }}
        .header h1 {{ margin:0; font-size:20px; font-weight:700; }}
        .header p  {{ margin:6px 0 0; font-size:13px; opacity:0.85; }}
        .body {{ padding:28px 32px; }}
        .info-row {{ display:flex; justify-content:space-between; align-items:center;
                    padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:14px; }}
        .info-row:last-child {{ border:none; }}
        .info-label {{ color:#64748b; }}
        .info-value {{ font-weight:600; color:#0f172a; }}
        .calendar-box {{ display:flex; align-items:flex-start; gap:14px; padding:16px;
                        background:#f0fdf4; border:1px solid #bbf7d0;
                        border-radius:12px; margin:20px 0; }}
        .calendar-icon {{ font-size:32px; flex-shrink:0; }}
        .calendar-info .title {{ font-weight:700; font-size:14px; color:#15803d; }}
        .calendar-info .desc  {{ font-size:12px; color:#166534; margin-top:4px; line-height:1.5; }}
        .steps {{ background:#f8fafc; border-radius:10px; padding:14px 16px; margin:16px 0; }}
        .steps p {{ margin:0 0 8px; font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:.05em; }}
        .steps ol {{ margin:0; padding-left:18px; }}
        .steps li {{ font-size:13px; color:#64748b; margin-bottom:4px; }}
        .footer {{ background:#f8fafc; padding:16px 32px; border-top:1px solid #e2e8f0;
                    font-size:11px; color:#94a3b8; text-align:center; }}
        </style>
        </head>
        <body>
        <div class="container">
        <div class="header">
            <h1>📅 Breeding Reminder</h1>
            <p>Jadwal IB otomatis dari Estrus AI &nbsp;·&nbsp; {detected_str}</p>
        </div>
        <div class="body">
            <p style="color:#475569;font-size:14px;margin:0 0 16px;">
            Sistem mendeteksi birahi pada sapi <strong>{cow_name}</strong>.
            Berikut jadwal inseminasi yang direkomendasikan:
            </p>
            <div class="info-row"><span class="info-label">Nama Sapi</span><span class="info-value">{cow_name}</span></div>
            <div class="info-row"><span class="info-label">Collar ID</span><span class="info-value">{collar_id}</span></div>
            <div class="info-row"><span class="info-label">Kandang</span><span class="info-value">{kandang_id}</span></div>
            <div class="info-row"><span class="info-label">Estrus Terdeteksi</span><span class="info-value">{detected_str}</span></div>
            <div class="info-row"><span class="info-label">Probabilitas</span><span class="info-value" style="color:#16a34a">{probability:.0f}%</span></div>
            <div class="info-row">
            <span class="info-label">⏰ Waktu Optimal IB</span>
            <span class="info-value" style="color:#dc2626;font-size:15px">{optimal_str}</span>
            </div>

            <div class="calendar-box">
            <div class="calendar-icon">📎</div>
            <div class="calendar-info">
                <div class="title">Calendar Reminder Terlampir!</div>
                <div class="desc">
                File <strong>IB_Reminder_{cow_name.replace(' ','_')}.ics</strong> sudah dilampirkan.<br>
                Klik file tersebut untuk langsung menambahkan jadwal IB ke calendar kamu.
                </div>
            </div>
            </div>

            <div class="steps">
            <p>Cara pakai:</p>
            <ol>
                <li>Download file <strong>.ics</strong> terlampir</li>
                <li>Klik/buka file tersebut</li>
                <li>Pilih <em>"Add to Calendar"</em></li>
                <li>Jadwal IB otomatis masuk ke Google Calendar / Apple Calendar / Outlook</li>
            </ol>
            </div>
        </div>
        <div class="footer">Estrus AI &nbsp;·&nbsp; Notifikasi ini dikirim otomatis oleh sistem.</div>
        </div>
        </body>
        </html>
        """

    ics_filename = f"IB_Reminder_{cow_name.replace(' ', '_')}_{estrus_detected_at.strftime('%Y%m%d')}.ics"
    subject      = f"[Estrus AI] 📅 Jadwal IB — {cow_name} ({optimal_str})"

    # Kirim email dengan .ics sebagai attachment
    # Gunakan _send_email() yang sudah ada di mailer.py, tapi dengan ics_bytes
    return _send_email(to, subject, html, pdf_bytes=ics_bytes, pdf_filename=ics_filename)


def send_birth_reminder_email(
    to: str,
    cow_name: str,
    collar_id: str,
    hpl,             # datetime object
) -> bool:
    """
    Kirim email reminder persiapan kelahiran + .ics 30 hari sebelum HPL.
    Dipanggil dari update_reproduction_record() saat status = bunting.
    """
    from calendar_reminder import generate_monthly_checkup_ics

    ics_bytes    = generate_monthly_checkup_ics(cow_name, collar_id, hpl)
    hpl_str      = hpl.strftime("%d %B %Y")
    ics_filename = f"Birth_Reminder_{cow_name.replace(' ','_')}.ics"
    subject      = f"[Estrus AI] 🐄 Reminder Kelahiran — {cow_name} (HPL: {hpl_str})"

    html = f"""
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8">
        <style>
        body {{ font-family:'Segoe UI',Arial,sans-serif; background:#f8fafc; margin:0; padding:0; }}
        .container {{ max-width:520px; margin:32px auto; background:#fff;
                        border-radius:16px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.08); }}
        .header {{ background:linear-gradient(135deg,#7c3aed,#6d28d9); padding:28px 32px; color:#fff; }}
        .header h1 {{ margin:0; font-size:20px; font-weight:700; }}
        .body  {{ padding:28px 32px; }}
        .info-row {{ display:flex; justify-content:space-between; padding:10px 0;
                    border-bottom:1px solid #f1f5f9; font-size:14px; }}
        .footer {{ background:#f8fafc; padding:16px 32px; border-top:1px solid #e2e8f0;
                    font-size:11px; color:#94a3b8; text-align:center; }}
        </style>
        </head>
        <body>
        <div class="container">
        <div class="header">
            <h1>🐄 Reminder Kelahiran</h1>
            <p>HPL sapi {cow_name} semakin dekat!</p>
        </div>
        <div class="body">
            <div class="info-row"><span style="color:#64748b">Nama Sapi</span><span style="font-weight:600">{cow_name}</span></div>
            <div class="info-row"><span style="color:#64748b">Collar ID</span><span style="font-weight:600">{collar_id}</span></div>
            <div class="info-row"><span style="color:#64748b">HPL (Perkiraan Lahir)</span><span style="font-weight:700;color:#7c3aed">{hpl_str}</span></div>
            <p style="margin:20px 0 8px;font-size:13px;color:#475569;">
            File <strong>.ics</strong> terlampir berisi reminder persiapan 30 hari sebelum HPL.
            Klik untuk tambah ke calendar kamu.
            </p>
        </div>
        <div class="footer">Estrus AI &nbsp;·&nbsp; Generated automatically.</div>
        </div>
        </body>
        </html>
        """
    return _send_email(to, subject, html, pdf_bytes=ics_bytes, pdf_filename=ics_filename)


# ── Setup CLI (jalankan sekali untuk generate token) ─────────────────────────

def run_setup():
    """
    Jalankan: python3 mailer.py --setup
    Akan buka browser untuk login Gmail, lalu simpan token ke gmail_token.json
    """
    if not CREDENTIALS_FILE.exists():
        print(f"[SETUP] File tidak ditemukan: {CREDENTIALS_FILE}")
        print("[SETUP] Download dari GCC → APIs & Services → Credentials → OAuth 2.0 Client IDs → Download JSON")
        print("[SETUP] Rename jadi 'gmail_credentials.json' dan taruh di folder backend/")
        return

    flow  = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
    creds = flow.run_local_server(port=0)
    TOKEN_FILE.write_text(creds.to_json())
    print(f"[SETUP] ✅ Token tersimpan di {TOKEN_FILE}")
    print("[SETUP] Sekarang mailer.py siap dipakai dari app.py!")


if __name__ == "__main__":
    import sys
    if "--setup" in sys.argv:
        run_setup()
    else:
        print("Usage: python3 mailer.py --setup")