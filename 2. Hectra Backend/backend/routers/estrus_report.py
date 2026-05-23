"""
routers/estrus_report.py

FastAPI router that generates a 2-page PDF report for the Estrus Prediction page.

Uses Playwright (headless Chromium) to render HTML → PDF, preserving all CSS perfectly.

SETUP:
    pip install playwright jinja2
    playwright install chromium

MOUNT in app.py:
    from routers.estrus_report import router as estrus_report_router
    app.include_router(estrus_report_router, prefix="/api")

ENDPOINT:
    POST /api/report/estrus-prediction
    → Returns PDF as file download

TEMPLATE:
    Place  estrus_report_template.html  in the same directory as this file (routers/).
    Or adjust TEMPLATE_DIR below to wherever you keep templates.
"""

import asyncio
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

router = APIRouter(tags=["Report"])

# ── Template location ──────────────────────────────────────────────────────────
# Assumes estrus_report_template.html sits next to this file.
# Change if your project structure differs.
TEMPLATE_DIR = Path(__file__).parent


# ══════════════════════════════════════════════════════════════════════════════
# PDF GENERATOR  (same Playwright helper as Genesis, self-contained here)
# ══════════════════════════════════════════════════════════════════════════════

async def _html_to_pdf(html: str) -> bytes:
    """Render HTML string → PDF bytes via Playwright headless Chromium."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Playwright not installed. Run: pip install playwright && playwright install chromium"
        )

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox", "--disable-setuid-sandbox"])
        page = await browser.new_page()
        await page.set_content(html, wait_until="load")
        await asyncio.sleep(2)          # let Google Fonts settle
        pdf_bytes = await page.pdf(
            format="A4",
            print_background=True,
            margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"},
        )
        await browser.close()
    return pdf_bytes


# ══════════════════════════════════════════════════════════════════════════════
# DATA HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _risk(score_float: float) -> tuple[str, str]:
    """Return (risk_class, risk_label) for a 0.0–1.0 confidence score."""
    pct = score_float * 100
    if pct >= 75:   return "high",   "TINGGI"
    if pct >= 50:   return "medium", "SEDANG"
    return              "low",    "RENDAH"


def _fmt_date(ts_str: str) -> str:
    """Format ISO timestamp to human-readable Indonesian format in WITA."""
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        # Convert UTC/naive to WITA (+8)
        tz_wita = timezone(timedelta(hours=8))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc).astimezone(tz_wita)
        elif dt.tzinfo != tz_wita:
            dt = dt.astimezone(tz_wita)
            
        months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"]
        return f"{dt.day} {months[dt.month - 1]} {dt.year}, {dt.strftime('%H:%M')} WITA"
    except Exception:
        return ts_str


def _countdown_text(next_dt: datetime, now: datetime) -> str:
    """Human-readable countdown string from now to next_dt in Indonesian."""
    diff = next_dt - now
    if diff.total_seconds() < 0:
        return "Masa Subur Aktif"
    days  = diff.days
    hours = diff.seconds // 3600
    if days == 0:
        return f"Sisa {hours} jam"
    if days <= 3:
        return f"{days} hari {hours} jam"
    return f"{days} hari"


def _urgency_class(next_dt: datetime, now: datetime) -> str:
    diff = (next_dt - now).total_seconds()
    if diff < 0:          return "urgent-now"
    if diff < 3 * 86400:  return "urgent-3days"
    return ""


def _fmt_indonesian_date(dt: datetime) -> str:
    months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", 
              "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    return f"{dt.day} {months[dt.month - 1]} {dt.year}, {dt.strftime('%H:%M')} WITA"


def _build_template_context(db_predictions: list[dict], farm_name: str) -> dict:
    """
    Transform raw rows from ai_predictions (joined with hewan for cow_name)
    into the template context dict.

    Expected keys per row:
        cow_id, cow_name (optional), confidence_score (0.0–1.0),
        prediction_ts (ISO string), model_version, prediction_type
    """
    tz_wita = timezone(timedelta(hours=8))
    now = datetime.now(tz_wita).replace(tzinfo=None)

    # ── Deduplicate: keep latest prediction per cow ───────────────────────────
    latest: dict[str, dict] = {}
    for row in db_predictions:
        cid = row["cow_id"]
        if cid not in latest:
            latest[cid] = row
        else:
            try:
                if datetime.fromisoformat(row["prediction_ts"].replace("Z", "+00:00")) > \
                   datetime.fromisoformat(latest[cid]["prediction_ts"].replace("Z", "+00:00")):
                    latest[cid] = row
            except Exception:
                pass

    sorted_preds = sorted(latest.values(), key=lambda r: r.get("confidence_score", 0), reverse=True)

    # ── Summary counts ────────────────────────────────────────────────────────
    high_count   = sum(1 for r in sorted_preds if r.get("confidence_score", 0) * 100 >= 75)
    medium_count = sum(1 for r in sorted_preds if 50 <= r.get("confidence_score", 0) * 100 < 75)
    low_count    = sum(1 for r in sorted_preds if r.get("confidence_score", 0) * 100 < 50)

    # ── Prediction rows for table ─────────────────────────────────────────────
    predictions = []
    for row in sorted_preds:
        score_float  = row.get("confidence_score", 0)
        score_pct    = round(score_float * 100)
        risk_class, risk_label = _risk(score_float)
        name         = row.get("cow_name") or row.get("cow_id", "Unknown")
        predictions.append({
            "cow_id":       row.get("cow_id", ""),
            "name":         name,
            "initials":     name[:2].upper(),
            "risk_class":   risk_class,
            "risk_label":   risk_label,
            "score":        score_pct,
            "width_pct":    f"{score_pct}%",
            "predicted_at": _fmt_date(row.get("prediction_ts", "")),
            "model_version":"Sistem Hectra",
        })

    # ── Countdown cards (HIGH risk only) ─────────────────────────────────────
    high_countdowns = []
    for row in sorted_preds:
        score_float = row.get("confidence_score", 0)
        if score_float * 100 < 75:
            continue
        try:
            last_high_dt = datetime.fromisoformat(row["prediction_ts"].replace("Z", "+00:00")).astimezone(tz_wita).replace(tzinfo=None)
        except Exception:
            last_high_dt = now

        next_dt  = last_high_dt + timedelta(days=21)
        ib_dt    = next_dt - timedelta(hours=12)   # IB: 12h before estrus window

        name = row.get("cow_name") or row.get("cow_id", "Unknown")
        score_pct = round(score_float * 100)
        months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"]
        next_date_str = f"{next_dt.day} {months[next_dt.month - 1]} {next_dt.year}"
        
        high_countdowns.append({
            "cow_id":         row.get("cow_id", ""),
            "name":           name,
            "initials":       name[:2].upper(),
            "score":          score_pct,
            "width_pct":      f"{score_pct}%",
            "next_date":      next_date_str,
            "ib_date":        _fmt_date(ib_dt.isoformat()),
            "countdown_text": _countdown_text(next_dt, now),
            "urgency_class":  _urgency_class(next_dt, now),
        })

    # ── Generate Dynamic CSS to avoid IDE lint errors in template ─────────────
    # We move the width: XX% logic to class rules like .w-cowID { width: XX%; }
    dynamic_css_list = []
    for p in predictions:
        # Clean ID for CSS class (no special chars)
        css_id = "".join(c for c in p["cow_id"] if c.isalnum())
        dynamic_css_list.append(f".wp-{css_id} {{ width: {p['width_pct']}; }}")
        p["css_class"] = f"wp-{css_id}"

    for c in high_countdowns:
        css_id = "".join(c for c in c["cow_id"] if c.isalnum())
        dynamic_css_list.append(f".wc-{css_id} {{ width: {c['width_pct']}; }}")
        c["css_class"] = f"wc-{css_id}"

    return {
        "farm_name":        farm_name,
        "generated_date":   _fmt_indonesian_date(datetime.now(tz_wita)),
        "total_cattle":     len(sorted_preds),
        "high_count":       high_count,
        "medium_count":     medium_count,
        "low_count":        low_count,
        "predictions":      predictions,
        "high_countdowns":  high_countdowns,
        "dynamic_css":      "\n".join(dynamic_css_list),
    }


# Dependency to get DB pool (consistent with profile_routes.py)
async def get_db_pool_dependency():
    from app import get_db_pool
    return await get_db_pool()

from auth_routes import get_current_user


# ══════════════════════════════════════════════════════════════════════════════
# ROUTE
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/report/estrus-prediction",
    summary="Generate Estrus Prediction PDF Report",
    response_description="2-page PDF file download",
)
async def generate_estrus_report(
    pool        = Depends(get_db_pool_dependency),
    current_user: dict = Depends(get_current_user),
):
    """
    Generate a 2-page Estrus Prediction PDF report for the current user's farm.

    **Page 1:** Summary cards + full prediction table (all cattle)
    **Page 2:** Next estrus countdown cards + IB scheduling table (HIGH risk only)

    Auth: Bearer token required (same as other /api endpoints).
    """

    user_id = int(current_user["id"])

    async with pool.acquire() as conn:
        # 1. Fetch predictions joined with cattle names
        rows = await conn.fetch("""
            SELECT 
                ap.cow_id, 
                h.nama AS cow_name,
                ap.confidence_score,
                ap.prediction_ts,
                ap.model_version,
                ap.prediction_type
            FROM ai_predictions ap
            LEFT JOIN hewan h ON h.id = ap.cow_id
            WHERE h.owner_id = $1
            ORDER BY ap.prediction_ts DESC
            LIMIT 200
        """, user_id)
        db_predictions = [dict(r) for r in rows]

        # 2. Fetch farm name
        farm_row = await conn.fetchrow(
            "SELECT farm_name FROM farm_settings WHERE user_id = $1",
            user_id
        )
        farm_name = farm_row["farm_name"] if farm_row and farm_row["farm_name"] else ""

    # 3. Build template context
    context = _build_template_context(db_predictions, farm_name)

    # ── 3. Render Jinja2 template ─────────────────────────────────────────────
    try:
        from jinja2 import Environment, FileSystemLoader
        env      = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
        template = env.get_template("estrus_report_template.html")
        html     = template.render(**context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template render failed: {e}")

    # ── 4. HTML → PDF via Playwright ──────────────────────────────────────────
    try:
        pdf_bytes = await _html_to_pdf(html)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    # ── 5. Stream PDF to client ───────────────────────────────────────────────
    wita_now = datetime.now(timezone(timedelta(hours=8)))
    filename = f"laporan_prediksi_estrus_{wita_now.strftime('%Y%m%d_%H%M')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


# ══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE: HTML PREVIEW (no Playwright needed — just open in browser)
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/report/estrus-prediction/preview",
    summary="Preview report as HTML using sample data",
)
async def preview_estrus_report():
    """
    Renders the report with dummy sample data so you can preview
    the template in the browser without running a full prediction.

    Open: GET http://localhost:5000/api/report/estrus-prediction/preview
    """
    sample_predictions = [
        {"cow_id": "C670AE03", "cow_name": "Hery",    "confidence_score": 0.89, "prediction_ts": "2024-03-10T08:30:00", "model_version": "hybrid_v1", "prediction_type": "estrus"},
        {"cow_id": "CAB13805", "cow_name": "Lim Dim", "confidence_score": 0.61, "prediction_ts": "2024-03-10T08:30:00", "model_version": "hybrid_v1", "prediction_type": "estrus"},
        {"cow_id": "C008",     "cow_name": "Gendhis", "confidence_score": 0.32, "prediction_ts": "2024-03-10T08:30:00", "model_version": "hybrid_v1", "prediction_type": "estrus"},
    ]
    context = _build_template_context(sample_predictions, "Peternakan Makmur Jaya")

    try:
        from jinja2 import Environment, FileSystemLoader
        env      = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
        template = env.get_template("estrus_report_template.html")
        html     = template.render(**context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template render failed: {e}")

    return Response(content=html, media_type="text/html")