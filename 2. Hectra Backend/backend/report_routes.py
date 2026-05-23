"""
report_routes.py
FastAPI router untuk download laporan PDF dan .ics dari Gendhis.

Tambahkan ke app.py:
    from report_routes import router as report_router
    app.include_router(report_router)

Endpoints:
  GET /api/report/download?path=...  — serve PDF atau .ics file
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from auth_routes import get_current_user

router = APIRouter(prefix="/api/report", tags=["Reports"])

# Whitelist folder yang boleh di-serve (security: jangan serve file sembarang)
ALLOWED_DIR = "/tmp"
ALLOWED_EXT = {".pdf", ".ics"}


@router.get("/download")
async def download_report(
    path        : str = Query(..., description="Path file yang mau didownload"),
    current_user: dict = Depends(get_current_user),
):
    """
    Serve PDF atau .ics file yang di-generate Gendhis.

    Security:
    - File harus ada di /tmp
    - Extension harus .pdf atau .ics
    - User harus authenticated
    """
    # Sanitize path — hanya boleh dari /tmp
    real_path = os.path.realpath(path)
    if not real_path.startswith(ALLOWED_DIR):
        raise HTTPException(status_code=403, detail="Akses ditolak")

    _, ext = os.path.splitext(real_path)
    if ext.lower() not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Tipe file tidak didukung")

    if not os.path.exists(real_path):
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    media_type = (
        "application/pdf"       if ext == ".pdf"
        else "text/calendar"
    )
    filename = os.path.basename(real_path)

    return FileResponse(
        path        = real_path,
        media_type  = media_type,
        filename    = filename,
        headers     = {"Content-Disposition": f'attachment; filename="{filename}"'},
    )

# ==========================
# MONTHLY PDF GENERATOR (Step 5)
# Dipanggil oleh scheduler bulanan di app.py
# ==========================

def generate_monthly_pdf_bytes(user_id: int) -> bytes:
    """Generate laporan bulanan PDF untuk satu user.
    Return: bytes (raw PDF content) untuk dikirim sebagai email attachment.

    Fungsi ini SYNC (bukan async) karena dipanggil via asyncio.to_thread().
    """
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from io import BytesIO
    from datetime import datetime, timezone, timedelta
    import os

    WITA = timezone(timedelta(hours=8))
    now  = datetime.now(WITA)

    # ── DB connection (sync psycopg2 karena dipanggil di thread) ────────────
    db_cfg = {
        "host"    : os.getenv('DB_HOST', 'db'),
        "port"    : int(os.getenv('DB_PORT', 5432)),
        "database": os.getenv('DB_NAME', 'Collar_to_Gateway'),
        "user"    : os.getenv('DB_USER', 'postgres'),
        "password": os.getenv('DB_PASSWORD', 'postgre'),
    }
    conn = psycopg2.connect(**db_cfg)

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:

            # 1. User info
            cur.execute("SELECT full_name, email FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone() or {}

            # 2. Cattle count
            cur.execute("SELECT COUNT(*) as total FROM hewan WHERE owner_id = %s", (user_id,))
            total_cattle = (cur.fetchone() or {}).get('total', 0)

            # 3. Reproduksi bulan ini
            cur.execute("""
                SELECT r.rfid, h.nama, r.tanggal_ib, r.pemberi_ib, r.results, r.hpl
                FROM reproduksi_ternak r
                JOIN hewan h ON r.rfid = h.id
                WHERE h.owner_id = %s
                AND EXTRACT(MONTH FROM r.tanggal_ib) = %s
                AND EXTRACT(YEAR  FROM r.tanggal_ib) = %s
                ORDER BY r.tanggal_ib DESC
            """, (user_id, now.month, now.year))
            repro_records = cur.fetchall()

            # 4. Estrus detections bulan ini
            cur.execute("""
                SELECT COUNT(*) as cnt FROM notifications n
                JOIN hewan h ON n.cow_id = h.id
                WHERE h.owner_id = %s
                AND UPPER(n.type) = 'ESTRUS'
                AND EXTRACT(MONTH FROM n.timestamp) = %s
                AND EXTRACT(YEAR  FROM n.timestamp) = %s
            """, (user_id, now.month, now.year))
            estrus_count = (cur.fetchone() or {}).get('cnt', 0)

            # 5. Anomalies bulan ini
            cur.execute("""
                SELECT COUNT(*) as cnt FROM notifications n
                JOIN hewan h ON n.cow_id = h.id
                WHERE h.owner_id = %s
                AND UPPER(n.type) NOT IN ('ESTRUS','INSEMINATION','PREGNANCY')
                AND EXTRACT(MONTH FROM n.timestamp) = %s
                AND EXTRACT(YEAR  FROM n.timestamp) = %s
            """, (user_id, now.month, now.year))
            anomaly_count = (cur.fetchone() or {}).get('cnt', 0)

    finally:
        conn.close()

    # ── Build PDF ─────────────────────────────────────────────────────────
    buf    = BytesIO()
    doc    = SimpleDocTemplate(buf, pagesize=A4,
                                leftMargin=2*cm, rightMargin=2*cm,
                                topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    GREEN  = colors.HexColor('#059669')
    DARK   = colors.HexColor('#0f172a')
    GRAY   = colors.HexColor('#64748b')

    title_style = ParagraphStyle('Title', parent=styles['Normal'],
                                  fontSize=20, fontName='Helvetica-Bold',
                                  textColor=DARK, spaceAfter=4)
    sub_style   = ParagraphStyle('Sub', parent=styles['Normal'],
                                  fontSize=11, textColor=GRAY, spaceAfter=16)
    h2_style    = ParagraphStyle('H2', parent=styles['Normal'],
                                  fontSize=13, fontName='Helvetica-Bold',
                                  textColor=DARK, spaceBefore=16, spaceAfter=8)
    cell_style  = ParagraphStyle('Cell', parent=styles['Normal'], fontSize=9)

    month_name = now.strftime("%B %Y")
    farm_owner = user.get('full_name') or user.get('email') or f'User #{user_id}'

    story = [
        Paragraph("Estrus AI", ParagraphStyle('Brand', parent=styles['Normal'],
                  fontSize=11, textColor=GREEN, fontName='Helvetica-Bold')),
        Spacer(1, 8),
        Paragraph(f"Laporan Reproduksi Bulanan", title_style),
        Paragraph(f"{month_name}  ·  {farm_owner}", sub_style),
        HRFlowable(width="100%", thickness=1, color=GREEN, spaceAfter=16),

        # Summary stats
        Paragraph("Ringkasan Bulan Ini", h2_style),
    ]

    stats_data = [
        ["Total Sapi", "Inseminasi Bulan Ini", "Deteksi Birahi", "Anomali Suhu"],
        [str(total_cattle), str(len(repro_records)), str(estrus_count), str(anomaly_count)],
    ]
    stats_table = Table(stats_data, colWidths=[4*cm, 4*cm, 4*cm, 4*cm])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), GREEN),
        ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,0), 9),
        ('FONTSIZE',   (0,1), (-1,1), 16),
        ('FONTNAME',   (0,1), (-1,1), 'Helvetica-Bold'),
        ('TEXTCOLOR',  (0,1), (-1,1), DARK),
        ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
        ('VALIGN',     (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,1), [colors.HexColor('#f0fdf4')]),
        ('BOX',        (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('INNERGRID',  (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 16))

    # Reproduction table
    if repro_records:
        story.append(Paragraph("Detail Catatan Inseminasi", h2_style))
        headers = ["Nama Sapi", "Tanggal IB", "Mantri IB", "Status", "HPL"]
        rows    = [headers]
        for r in repro_records:
            status = "Bunting ✓" if r.get('results') is True else \
                     "Gagal ✗"   if r.get('results') is False else "Pending"
            hpl    = r['hpl'].strftime('%d/%m/%Y') if r.get('hpl') else '-'
            tgl    = r['tanggal_ib'].strftime('%d/%m/%Y') if r.get('tanggal_ib') else '-'
            rows.append([
                Paragraph(r.get('nama', '-'), cell_style),
                tgl,
                r.get('pemberi_ib') or '-',
                status,
                hpl,
            ])
        repro_table = Table(rows, colWidths=[4.5*cm, 3*cm, 3.5*cm, 3*cm, 2.5*cm])
        repro_table.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,0), DARK),
            ('TEXTCOLOR',     (0,0), (-1,0), colors.white),
            ('FONTNAME',      (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE',      (0,0), (-1,-1), 8),
            ('ALIGN',         (0,0), (-1,-1), 'CENTER'),
            ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
            ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
            ('BOX',           (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('INNERGRID',     (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING',    (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(repro_table)
    else:
        story.append(Paragraph("Tidak ada catatan inseminasi bulan ini.", sub_style))

    # Footer
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0')))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        f"Laporan digenerate otomatis oleh Estrus AI pada {now.strftime('%d %B %Y, %H:%M WITA')}",
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=GRAY,
                       alignment=TA_CENTER)
    ))

    doc.build(story)
    return buf.getvalue()