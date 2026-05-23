"""
ai/tools.py
All callable tools available to Gendhis.

Tools:
  - analyze_barn_status       : Aggregate health/estrus for all cattle in a barn
  - get_cattle_info           : Look up cattle by name or RFID
  - check_cattle_condition    : Cattle profile + latest sensor data
  - get_farm_overview         : Farm-wide summary stats
  - find_mantri_contact       : List vet/mantri contacts
  - query_knowledge_base      : RAG search on farm management guides
  - notify_vet_whatsapp       : Build a WhatsApp deep link for a vet
  - google_calendar_sync      : Create a Google Calendar event
  - generate_daily_report     : Generate PDF + .ics laporan harian kandang
  - send_estrus_wa_alert      : Generate WA blast link untuk alert estrus
"""
from __future__ import annotations

import json
import urllib.parse
from datetime import datetime, timedelta

from .db import db_query, serialize, search_knowledge_base
from .config import WHATSAPP_COUNTRY_CODE


# ─────────────────────────────────────────────────────────────────────────
# TOOL 1 – Barn Status
# ─────────────────────────────────────────────────────────────────────────
async def analyze_barn_status(barn_id: str) -> dict:
    """Aggregate cattle health and estrus status for every cow in a given barn."""
    rows = await db_query(
        """
        SELECT h.id, h.nama, h.status_kesehatan,
               s.temperature, s.activity_state, s.estrus_detected,
               s.created_at AS last_sensor
        FROM hewan h
        LEFT JOIN LATERAL (
            SELECT temperature, activity_state, estrus_detected, created_at
            FROM sensor_data sd
            WHERE sd.collar_id = h.collar_id
            ORDER BY sd.created_at DESC
            LIMIT 1
        ) s ON true
        WHERE LOWER(h.status_kesehatan) LIKE $1
           OR LOWER(h.nama) LIKE $1
           OR CAST(h.owner_id AS TEXT) = $2
        """,
        f"%{barn_id.lower()}%", barn_id,
    )

    if not rows:
        rows = await db_query(
            """
            SELECT h.id, h.nama, h.status_kesehatan,
                   s.temperature, s.activity_state, s.estrus_detected,
                   s.created_at AS last_sensor
            FROM hewan h
            LEFT JOIN LATERAL (
                SELECT temperature, activity_state, estrus_detected, created_at
                FROM sensor_data sd
                WHERE sd.collar_id = h.collar_id
                ORDER BY sd.created_at DESC
                LIMIT 1
            ) s ON true
            LIMIT 50
            """
        )

    cattle      = serialize(rows)
    estrus_cows = [c for c in cattle if c.get("estrus_detected") == 1]
    sick_cows   = [c for c in cattle if "sakit" in (c.get("status_kesehatan") or "").lower()]

    result: dict = {
        "barn_id"     : barn_id,
        "total_cattle": len(cattle),
        "estrus_count": len(estrus_cows),
        "sick_count"  : len(sick_cows),
        "estrus_cows" : estrus_cows,
        "sick_cows"   : sick_cows,
    }

    if estrus_cows:
        names = ", ".join(c.get("nama", c.get("id", "?")) for c in estrus_cows[:3])
        result["proactive_suggestion"] = (
            f"Ada {len(estrus_cows)} sapi terdeteksi birahi ({names}). "
            "Mau sekalian bikinin jadwal IB di Google Calendar?"
        )

    return result


# ─────────────────────────────────────────────────────────────────────────
# TOOL 2 – Cattle Info
# ─────────────────────────────────────────────────────────────────────────
async def get_cattle_info(nama_sapi: str) -> list[dict]:
    """Find cattle profile by name or RFID/ID."""
    rows = await db_query(
        "SELECT * FROM hewan WHERE nama ILIKE $1 OR id ILIKE $1",
        f"%{nama_sapi}%",
    )
    return serialize(rows)


# ─────────────────────────────────────────────────────────────────────────
# TOOL 3 – Cattle Condition
# ─────────────────────────────────────────────────────────────────────────
async def check_cattle_condition(nama_sapi: str) -> dict | None:
    """Returns cattle profile + latest sensor reading."""
    rows = await db_query(
        """
        SELECT h.id, h.nama, h.jenis, h.status_kesehatan,
               s.temperature, s.activity_state, s.estrus_detected, s.created_at
        FROM hewan h
        LEFT JOIN LATERAL (
            SELECT temperature, activity_state, estrus_detected, created_at
            FROM sensor_data sd
            WHERE sd.collar_id = h.collar_id
            ORDER BY sd.created_at DESC
            LIMIT 1
        ) s ON true
        WHERE h.nama ILIKE $1 OR h.id ILIKE $1
        """,
        f"%{nama_sapi}%",
    )
    return serialize(rows[0]) if rows else None


# ─────────────────────────────────────────────────────────────────────────
# TOOL 4 – Farm Overview
# ─────────────────────────────────────────────────────────────────────────
async def get_farm_overview() -> dict:
    """Farm-wide aggregate: total cattle, sick count, estrus alerts (24h)."""
    res_total  = await db_query("SELECT COUNT(*) AS c FROM hewan")
    res_sakit  = await db_query(
        "SELECT COUNT(*) AS c FROM hewan WHERE status_kesehatan ILIKE '%sakit%'"
    )
    res_estrus = await db_query(
        """
        SELECT COUNT(*) AS c FROM sensor_data
        WHERE estrus_detected = 1 AND created_at > NOW() - INTERVAL '24 hours'
        """
    )
    return {
        "total_sapi"       : res_total[0]["c"]  if res_total  else 0,
        "sapi_sakit"       : res_sakit[0]["c"]  if res_sakit  else 0,
        "peringatan_estrus": res_estrus[0]["c"] if res_estrus else 0,
    }


# ─────────────────────────────────────────────────────────────────────────
# TOOL 5 – Mantri/Vet Contacts
# ─────────────────────────────────────────────────────────────────────────
async def find_mantri_contact(wilayah: str | None = None) -> list[dict]:
    """List available vet/mantri contacts, optionally filtered by region."""
    if wilayah:
        rows = await db_query(
            "SELECT nama, nomor_hp, wilayah, spesialisasi "
            "FROM mantri_contacts WHERE wilayah ILIKE $1",
            f"%{wilayah}%",
        )
    else:
        rows = await db_query(
            "SELECT nama, nomor_hp, wilayah, spesialisasi FROM mantri_contacts"
        )
    return serialize(rows)


# ─────────────────────────────────────────────────────────────────────────
# TOOL 6 – RAG Knowledge Base
# ─────────────────────────────────────────────────────────────────────────
async def query_knowledge_base(question: str) -> list[dict]:
    """Vector similarity search on the knowledge_base table."""
    return await search_knowledge_base(question, top_k=3)


# ─────────────────────────────────────────────────────────────────────────
# TOOL 7 – WhatsApp Notification (vet/mantri)
# ─────────────────────────────────────────────────────────────────────────
async def notify_vet_whatsapp(vet_id: str, report: str) -> dict:
    """Generate a pre-filled WhatsApp deep link to send a report to a vet."""
    try:
        rows = await db_query(
            "SELECT nama, nomor_hp FROM mantri_contacts WHERE id::text=$1 OR nama ILIKE $2",
            vet_id, f"%{vet_id}%",
        )
        if not rows:
            return {"error": f"Vet '{vet_id}' tidak ditemukan di database."}

        vet       = rows[0]
        vet_name  = vet["nama"]
        raw_phone = vet["nomor_hp"].replace(" ", "").replace("-", "").lstrip("0")
        phone     = f"{WHATSAPP_COUNTRY_CODE}{raw_phone}"
        wa_link   = f"https://wa.me/{phone}?text={urllib.parse.quote(report)}"

        return {
            "vet_name"   : vet_name,
            "phone"      : phone,
            "wa_link"    : wa_link,
            "message"    : report,
            "instruction": (
                f"Klik link berikut untuk kirim laporan ke {vet_name} via WhatsApp: {wa_link}"
            ),
        }
    except Exception as exc:
        return {"error": str(exc)}


# ─────────────────────────────────────────────────────────────────────────
# TOOL 8 – Google Calendar Sync
# ─────────────────────────────────────────────────────────────────────────
async def google_calendar_sync(title: str, start_time: str) -> dict:
    """Create a Google Calendar event for IB scheduling."""
    try:
        import os
        from .config import GOOGLE_CALENDAR_CREDENTIALS_PATH, GOOGLE_CALENDAR_ID

        if not os.path.exists(GOOGLE_CALENDAR_CREDENTIALS_PATH):
            return {
                "status" : "skipped",
                "message": (
                    "Google Calendar belum dikonfigurasi. "
                    "Letakkan credentials.json di /app/ dan set GOOGLE_CALENDAR_ID."
                ),
            }

        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build

        SCOPES     = ["https://www.googleapis.com/auth/calendar"]
        token_path = "/app/token.json"
        creds      = None

        if os.path.exists(token_path):
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        if not creds or not creds.valid:
            flow  = InstalledAppFlow.from_client_secrets_file(
                GOOGLE_CALENDAR_CREDENTIALS_PATH, SCOPES
            )
            creds = flow.run_local_server(port=0)
            with open(token_path, "w") as f:
                f.write(creds.to_json())

        service  = build("calendar", "v3", credentials=creds)
        start_dt = datetime.fromisoformat(start_time)
        end_dt   = start_dt + timedelta(hours=1)
        event    = {
            "summary": title,
            "start"  : {"dateTime": start_dt.isoformat(), "timeZone": "Asia/Makassar"},
            "end"    : {"dateTime": end_dt.isoformat(),   "timeZone": "Asia/Makassar"},
        }
        created = service.events().insert(calendarId=GOOGLE_CALENDAR_ID, body=event).execute()
        return {
            "status"  : "created",
            "event_id": created.get("id"),
            "link"    : created.get("htmlLink"),
            "message" : f"Event '{title}' berhasil dibuat di Google Calendar!",
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


# ─────────────────────────────────────────────────────────────────────────
# TOOL 9 – Generate Daily Report (PDF + .ics)  ← NEW
# ─────────────────────────────────────────────────────────────────────────
async def generate_daily_report(user_id: int) -> dict:
    """
    Generate laporan harian kandang dalam 2 format:
    1. PDF ringkasan kondisi kandang hari ini
    2. .ics file untuk event reminder di kalender HP (Samsung, iPhone, dll)

    Returns:
        pdf_url  : URL download PDF (disimpan sementara di /tmp)
        ics_url  : URL download .ics file
        summary  : ringkasan teks untuk ditampilkan di chat
    """
    try:
        # ── Ambil data terkini ─────────────────────────────────────────
        overview   = await get_farm_overview()
        rows_sakit = await db_query(
            """
            SELECT h.nama, h.status_kesehatan, s.temperature
            FROM hewan h
            LEFT JOIN LATERAL (
                SELECT temperature FROM sensor_data sd
                WHERE sd.collar_id = h.collar_id
                ORDER BY sd.created_at DESC LIMIT 1
            ) s ON true
            WHERE h.status_kesehatan ILIKE '%sakit%'
            """,
        )
        rows_estrus = await db_query(
            """
            SELECT h.nama, s.temperature, s.activity_state, s.created_at
            FROM sensor_data s
            JOIN hewan h ON h.collar_id = s.collar_id
            WHERE s.estrus_detected = 1
              AND s.created_at > NOW() - INTERVAL '24 hours'
            ORDER BY s.created_at DESC
            """,
        )

        sick_cows   = serialize(rows_sakit)
        estrus_cows = serialize(rows_estrus)
        today       = datetime.now()
        today_str   = today.strftime("%d %B %Y")

        # ── Build PDF ──────────────────────────────────────────────────
        pdf_path = await _build_pdf_report(
            today_str, overview, sick_cows, estrus_cows
        )

        # ── Build .ics ─────────────────────────────────────────────────
        ics_path, ics_events = await _build_ics_file(
            today, estrus_cows, sick_cows
        )

        # ── Summary teks untuk chat ────────────────────────────────────
        summary_lines = [
            f"📋 **Laporan Harian Kandang — {today_str}**\n",
            f"- 🐄 Total sapi: **{overview['total_sapi']}**",
            f"- 🚨 Sakit: **{overview['sapi_sakit']}**",
            f"- 💉 Terdeteksi birahi: **{overview['peringatan_estrus']}**",
        ]
        if estrus_cows:
            names = ", ".join(c.get("nama", "?") for c in estrus_cows[:3])
            summary_lines.append(f"\n⚠️ Sapi birahi: **{names}** — segera jadwalkan IB!")
        if sick_cows:
            names = ", ".join(c.get("nama", "?") for c in sick_cows[:3])
            summary_lines.append(f"🏥 Sapi sakit: **{names}** — perlu perhatian.")

        summary_lines.append(
            f"\n📥 **[Download PDF Laporan]({pdf_path})** | "
            f"**[Download Kalender .ics]({ics_path})**"
        )

        return {
            "status"     : "success",
            "pdf_url"    : pdf_path,
            "ics_url"    : ics_path,
            "ics_events" : ics_events,
            "summary"    : "\n".join(summary_lines),
            "today"      : today_str,
            "overview"   : overview,
        }

    except Exception as exc:
        return {"status": "error", "message": str(exc)}


async def _build_pdf_report(
    today_str  : str,
    overview   : dict,
    sick_cows  : list[dict],
    estrus_cows: list[dict],
) -> str:
    """Generate PDF laporan harian, simpan ke /tmp, return path."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        )

        filename = f"/tmp/laporan_kandang_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        doc      = SimpleDocTemplate(filename, pagesize=A4,
                                     leftMargin=2*cm, rightMargin=2*cm,
                                     topMargin=2*cm, bottomMargin=2*cm)
        styles   = getSampleStyleSheet()
        story    = []

        # Header
        title_style = ParagraphStyle(
            "title", parent=styles["Title"],
            fontSize=18, textColor=colors.HexColor("#16a34a"), spaceAfter=6,
        )
        story.append(Paragraph("🐄 Laporan Harian Kandang", title_style))
        story.append(Paragraph(f"Estrus AI — {today_str}", styles["Normal"]))
        story.append(Spacer(1, 0.5*cm))

        # Overview table
        overview_data = [
            ["Metrik", "Nilai"],
            ["Total Sapi", str(overview.get("total_sapi", 0))],
            ["Sapi Sakit", str(overview.get("sapi_sakit", 0))],
            ["Terdeteksi Birahi (24j)", str(overview.get("peringatan_estrus", 0))],
        ]
        t = Table(overview_data, colWidths=[10*cm, 5*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#16a34a")),
            ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
            ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, -1), 11),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.HexColor("#f0fdf4"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1fae5")),
            ("PADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.5*cm))

        # Sapi birahi
        if estrus_cows:
            story.append(Paragraph("⚠️ Sapi Terdeteksi Birahi", styles["Heading2"]))
            estrus_data = [["Nama Sapi", "Suhu (°C)", "Aktivitas", "Waktu Deteksi"]]
            for c in estrus_cows:
                estrus_data.append([
                    c.get("nama", "-"),
                    str(c.get("temperature", "-")),
                    c.get("activity_state", "-"),
                    str(c.get("created_at", "-"))[:16],
                ])
            t2 = Table(estrus_data, colWidths=[4*cm, 3*cm, 4*cm, 5*cm])
            t2.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fef3c7")),
                ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#fde68a")),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(t2)
            story.append(Spacer(1, 0.3*cm))

        # Sapi sakit
        if sick_cows:
            story.append(Paragraph("🚨 Sapi Dalam Kondisi Sakit", styles["Heading2"]))
            sick_data = [["Nama Sapi", "Status Kesehatan", "Suhu Terakhir (°C)"]]
            for c in sick_cows:
                sick_data.append([
                    c.get("nama", "-"),
                    c.get("status_kesehatan", "-"),
                    str(c.get("temperature", "-")),
                ])
            t3 = Table(sick_data, colWidths=[5*cm, 7*cm, 4*cm])
            t3.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fee2e2")),
                ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#fecaca")),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(t3)

        # Footer
        story.append(Spacer(1, 1*cm))
        story.append(Paragraph(
            f"Dibuat otomatis oleh Gendhis AI · Estrus AI · {today_str}",
            styles["Normal"]
        ))

        doc.build(story)
        print(f"✅ [Report] PDF generated: {filename}")
        return filename

    except ImportError:
        # reportlab tidak diinstall
        return "/tmp/laporan_placeholder.pdf"
    except Exception as exc:
        print(f"❌ [Report] PDF error: {exc}")
        return ""


async def _build_ics_file(
    today      : datetime,
    estrus_cows: list[dict],
    sick_cows  : list[dict],
) -> tuple[str, list[dict]]:
    """
    Generate .ics file berisi reminder untuk:
    - IB scheduling untuk sapi birahi (2 hari dari sekarang = waktu optimal)
    - Follow-up check untuk sapi sakit (besok)
    """
    events    : list[dict] = []
    ics_lines : list[str]  = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Estrus AI//Gendhis//ID",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]

    def _ics_dt(dt: datetime) -> str:
        return dt.strftime("%Y%m%dT%H%M%S")

    now = datetime.now()

    # Event 1: IB reminder untuk setiap sapi birahi
    for cow in estrus_cows:
        nama      = cow.get("nama", "Sapi")
        ib_time   = now + timedelta(days=2)   # optimal 48-72 jam setelah birahi
        ib_time   = ib_time.replace(hour=8, minute=0, second=0)
        end_time  = ib_time + timedelta(hours=1)
        uid       = f"ib-{nama}-{now.strftime('%Y%m%d%H%M%S')}@estrus-ai"

        ics_lines += [
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTART:{_ics_dt(ib_time)}",
            f"DTEND:{_ics_dt(end_time)}",
            f"SUMMARY:💉 IB Sapi {nama} — Estrus AI",
            f"DESCRIPTION:Sapi {nama} terdeteksi birahi. "
            f"Waktu optimal IB: 48-72 jam setelah deteksi.\\n"
            f"Generated by Gendhis AI · Estrus AI",
            "BEGIN:VALARM",
            "TRIGGER:-PT60M",
            "ACTION:DISPLAY",
            f"DESCRIPTION:Reminder: IB Sapi {nama} dalam 1 jam!",
            "END:VALARM",
            "END:VEVENT",
        ]
        events.append({
            "type"    : "IB",
            "cow"     : nama,
            "datetime": ib_time.isoformat(),
            "note"    : "48 jam setelah deteksi birahi",
        })

    # Event 2: Follow-up check untuk sapi sakit
    for cow in sick_cows:
        nama       = cow.get("nama", "Sapi")
        check_time = (now + timedelta(days=1)).replace(hour=7, minute=0, second=0)
        end_time   = check_time + timedelta(minutes=30)
        uid        = f"check-{nama}-{now.strftime('%Y%m%d%H%M%S')}@estrus-ai"

        ics_lines += [
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTART:{_ics_dt(check_time)}",
            f"DTEND:{_ics_dt(end_time)}",
            f"SUMMARY:🏥 Cek Kondisi {nama} — Estrus AI",
            f"DESCRIPTION:Follow-up kondisi sapi {nama} yang sedang sakit.\\n"
            f"Generated by Gendhis AI · Estrus AI",
            "BEGIN:VALARM",
            "TRIGGER:-PT30M",
            "ACTION:DISPLAY",
            f"DESCRIPTION:Reminder: Cek kondisi {nama}!",
            "END:VALARM",
            "END:VEVENT",
        ]
        events.append({
            "type"    : "Cek Kondisi",
            "cow"     : nama,
            "datetime": check_time.isoformat(),
            "note"    : "Follow-up sapi sakit",
        })

    ics_lines.append("END:VCALENDAR")

    # Simpan ke /tmp
    filename = f"/tmp/jadwal_kandang_{now.strftime('%Y%m%d_%H%M%S')}.ics"
    with open(filename, "w", encoding="utf-8") as f:
        f.write("\r\n".join(ics_lines))

    print(f"✅ [Report] .ics generated: {filename} ({len(events)} events)")
    return filename, events


# ─────────────────────────────────────────────────────────────────────────
# TOOL 10 – Send Estrus WA Alert Blast  ← NEW
# ─────────────────────────────────────────────────────────────────────────
async def send_estrus_wa_alert(target: str = "all") -> dict:
    """
    Generate WhatsApp alert link untuk notifikasi estrus.

    Args:
        target: "all" = semua kontak mantri, atau nama mantri spesifik

    Returns:
        wa_links : list of {name, phone, wa_link, message}
        summary  : teks ringkasan untuk ditampilkan di chat
    """
    try:
        # Ambil data estrus terkini
        estrus_rows = await db_query(
            """
            SELECT h.nama, s.temperature, s.activity_state, s.created_at
            FROM sensor_data s
            JOIN hewan h ON h.collar_id = s.collar_id
            WHERE s.estrus_detected = 1
              AND s.created_at > NOW() - INTERVAL '24 hours'
            ORDER BY s.created_at DESC
            """
        )
        estrus_cows = serialize(estrus_rows)

        if not estrus_cows:
            return {
                "status" : "no_estrus",
                "message": "Tidak ada sapi yang terdeteksi birahi dalam 24 jam terakhir.",
            }

        # Ambil kontak mantri
        if target == "all":
            contact_rows = await db_query(
                "SELECT nama, nomor_hp, wilayah FROM mantri_contacts LIMIT 5"
            )
        else:
            contact_rows = await db_query(
                "SELECT nama, nomor_hp, wilayah FROM mantri_contacts "
                "WHERE nama ILIKE $1",
                f"%{target}%",
            )

        contacts = serialize(contact_rows)
        if not contacts:
            return {"status": "error", "message": "Tidak ada kontak mantri ditemukan."}

        # Buat pesan WA
        today_str  = datetime.now().strftime("%d/%m/%Y %H:%M")
        cow_list   = "\n".join(
            f"• {c.get('nama','?')} — suhu {c.get('temperature','?')}°C, "
            f"aktivitas: {c.get('activity_state','?')}"
            for c in estrus_cows
        )
        wa_message = (
            f"🔔 *ALERT ESTRUS — Estrus AI*\n"
            f"Tanggal: {today_str}\n\n"
            f"Sapi berikut terdeteksi *birahi* dalam 24 jam terakhir:\n"
            f"{cow_list}\n\n"
            f"Mohon segera jadwalkan IB.\n"
            f"_Pesan otomatis dari Gendhis AI · Estrus AI_"
        )

        # Generate WA links untuk setiap kontak
        wa_links = []
        for c in contacts:
            raw_phone = c["nomor_hp"].replace(" ", "").replace("-", "").lstrip("0")
            phone     = f"{WHATSAPP_COUNTRY_CODE}{raw_phone}"
            wa_link   = f"https://wa.me/{phone}?text={urllib.parse.quote(wa_message)}"
            wa_links.append({
                "name"   : c["nama"],
                "phone"  : phone,
                "wa_link": wa_link,
                "message": wa_message,
            })

        # Summary untuk chat
        cow_names    = ", ".join(c.get("nama", "?") for c in estrus_cows)
        contact_list = "\n".join(
            f"- [{l['name']}]({l['wa_link']})" for l in wa_links
        )
        summary = (
            f"✅ **WA Alert siap dikirim!**\n\n"
            f"🐄 Sapi birahi: **{cow_names}**\n\n"
            f"📲 Klik nama mantri di bawah untuk kirim WA langsung:\n"
            f"{contact_list}"
        )

        return {
            "status"  : "success",
            "wa_links": wa_links,
            "summary" : summary,
            "cows"    : estrus_cows,
        }

    except Exception as exc:
        return {"status": "error", "message": str(exc)}


# ─────────────────────────────────────────────────────────────────────────
# TOOL 11 – Send Direct WhatsApp Message (Autopilot / Agentic Action)
# ─────────────────────────────────────────────────────────────────────────
async def send_whatsapp_message_tool(target_name: str, message: str) -> dict:
    """
    Kirim pesan WhatsApp secara langsung (Autopilot/Tanpa Link re-routing) ke kontak mantri/pekerja.
    Fitur ini menggunakan Meta WhatsApp Cloud API langsung dari backend (whatsapp_api.py).

    Args:
        target_name: Nama target kontak (misal "Budi" atau "all" untuk broadcast massal)
        message: Isi pesan yang ingin dikirimkan secara autonomous
    """
    from whatsapp_api import send_whatsapp

    try:
        if target_name.lower() == "all":
            contact_rows = await db_query("SELECT nama, nomor_hp FROM mantri_contacts")
        else:
            contact_rows = await db_query(
                "SELECT nama, nomor_hp FROM mantri_contacts WHERE nama ILIKE $1",
                f"%{target_name}%",
            )
        
        contacts = serialize(contact_rows)
        if not contacts:
            return {"status": "error", "message": f"Karyawan/Mantri dengan nama '{target_name}' tidak ditemukan."}

        sent_to = []
        failed_to = []

        for c in contacts:
            success = send_whatsapp(c["nomor_hp"], message)
            if success:
                sent_to.append(c["nama"])
            else:
                failed_to.append(c["nama"])

        summary = f"Pesan WA berhasil dikirim ke: {', '.join(sent_to) if sent_to else '-'}"
        if failed_to:
            summary += f"\n⚠️ Gagal terkirim ke: {', '.join(failed_to)}. Sistem mendeteksi WA_ACCESS_TOKEN dan WA_PHONE_NUMBER_ID di backend belum diset oleh User."

        return {
            "status": "success",
            "message": summary,
            "details": {"sukses": sent_to, "gagal": failed_to}
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}

# ─────────────────────────────────────────────────────────────────────────
# Exported tool list (used by agent.py)
# ─────────────────────────────────────────────────────────────────────────
GENDHIS_TOOLS = [
    analyze_barn_status,
    get_cattle_info,
    check_cattle_condition,
    get_farm_overview,
    find_mantri_contact,
    query_knowledge_base,
    notify_vet_whatsapp,
    google_calendar_sync,
    generate_daily_report,    # NEW
    send_estrus_wa_alert,     # NEW
    send_whatsapp_message_tool, # AUTOPILOT WA
]