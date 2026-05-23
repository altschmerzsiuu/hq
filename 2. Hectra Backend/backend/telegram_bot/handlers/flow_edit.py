"""
handlers/flow_edit.py
Flow: ✏️ Edit Data — per field via keyboard ATAU bulk via template
"""

import httpx
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup
from telegram.ext import ContextTypes

from telegram_bot.state import set_user_state, get_user_state, clear_user_state, update_user_state
from telegram_bot.helpers import (
    is_valid_tanggal, format_tanggal, format_usia, hitung_usia_bulan,
    to_db_date, hitung_bunting_hpl, FORMAT_KOSONG,
)
from telegram_bot.db_client import get_hewan_by_id, get_repro_latest, get_headers

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:5000")

FIELD_LABELS = [
    "Nama", "Jenis", "Tanggal Lahir", "Status Kesehatan",
    "Tanggal IB", "Pemberi IB", "Jumlah IB", "Bunting",
    "HPL", "Sapih", "Birahi", "Catatan",
]
FIELD_MAP = {
    "Nama": "nama", "Jenis": "jenis",
    "Tanggal Lahir": "bulan_tahun_lahir", "Status Kesehatan": "status_kesehatan",
    "Tanggal IB": "tanggal_ib", "Pemberi IB": "pemberi_ib",
    "Jumlah IB": "jumlah_ib", "Bunting": "bunting",
    "HPL": "hpl", "Sapih": "sapih", "Birahi": "birahi", "Catatan": "catatan",
}
DATE_FIELDS = {"tanggal_ib", "bunting", "hpl", "sapih", "birahi"}

EDIT_KEYBOARD = ReplyKeyboardMarkup(
    [
        ["Nama", "Jenis", "Tanggal Lahir", "Status Kesehatan"],
        ["Tanggal IB", "Pemberi IB", "Jumlah IB", "Bunting"],
        ["HPL", "Sapih", "Birahi", "Catatan"],
        ["🔙 Kembali"],
    ],
    resize_keyboard=True,
)


# ──────────────────────────────────────────────
# Entry (dipanggil dari callbacks.py)
# ──────────────────────────────────────────────

async def start_edit(chat_id: str, hewan_id: str, context: ContextTypes.DEFAULT_TYPE):
    hewan = await get_hewan_by_id(hewan_id)
    repro = await get_repro_latest(hewan_id) or {}

    if not hewan:
        await context.bot.send_message(chat_id, "❌ Data tidak ditemukan.")
        return

    usia_bulan = hitung_usia_bulan(hewan.get("bulan_tahun_lahir", ""))

    await set_user_state(chat_id, {
        "mode":     "edit",
        "hewan_id": hewan_id,
        "editing_field": None,
        # snapshot profil
        "nama":              hewan.get("nama"),
        "jenis":             hewan.get("jenis"),
        "bulan_tahun_lahir": hewan.get("bulan_tahun_lahir"),
        "status_kesehatan":  hewan.get("status_kesehatan"),
        # snapshot reproduksi
        "tanggal_ib": str(repro.get("tanggal_ib") or ""),
        "pemberi_ib": repro.get("pemberi_ib") or "",
        "jumlah_ib":  repro.get("jumlah_ib"),
        "bunting":    str(repro.get("bunting") or ""),
        "hpl":        str(repro.get("hpl") or ""),
        "sapih":      str(repro.get("sapih") or ""),
        "birahi":     str(repro.get("birahi") or ""),
        "catatan":    repro.get("catatan") or "",
    })

    await context.bot.send_message(
        chat_id,
        _build_preview(hewan_id, hewan, repro, usia_bulan),
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ Konfirmasi",    callback_data="konfirmasi_edit")],
            [InlineKeyboardButton("❌ Batal edit deh!", callback_data="batal_edit")],
        ]),
    )
    await context.bot.send_message(
        chat_id,
        "Pilih field yang ingin diedit, atau kirim semua sekaligus pakai /template:",
        reply_markup=EDIT_KEYBOARD,
    )


# ──────────────────────────────────────────────
# Handler teks saat mode edit aktif
# ──────────────────────────────────────────────

async def handle_edit_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    text    = update.message.text.strip()
    state   = await get_user_state(chat_id)

    # User klik tombol field
    if text in FIELD_LABELS:
        await update_user_state(chat_id, {"editing_field": FIELD_MAP[text]})
        await update.message.reply_text(f"📝 Silahkan masukkan {text} baru:")
        return

    # User input nilai baru untuk satu field
    editing_field = state.get("editing_field")
    if editing_field:
        err = await _apply_single_field(chat_id, editing_field, text)
        if err:
            await update.message.reply_text(err)
            return
        await update_user_state(chat_id, {"editing_field": None})
        state = await get_user_state(chat_id)
        await _send_preview(update, state)
        return

    # Bulk template
    if ":" in text:
        err = await _apply_bulk(chat_id, text)
        if err:
            await update.message.reply_text(err)
            return
        state = await get_user_state(chat_id)
        await _send_preview(update, state)


async def _apply_single_field(chat_id, field, value) -> str | None:
    kosong = ["-", ".", "–"]
    updates = {}

    if field in DATE_FIELDS:
        if value not in kosong:
            if not is_valid_tanggal(value):
                return "⚠️ Format tanggal salah. Gunakan dd/mm/yyyy"
            value = to_db_date(value)
        else:
            value = None
        updates[field] = value
        if field == "birahi" and value:
            b, h = hitung_bunting_hpl(value)
            updates["bunting"] = b
            updates["hpl"]     = h

    elif field == "bulan_tahun_lahir":
        if not is_valid_tanggal(value):
            return "⚠️ Format salah. Gunakan dd/mm/yyyy, misalnya: 15/02/2020"
        updates[field] = to_db_date(value)

    else:
        updates[field] = value

    await update_user_state(chat_id, updates)
    return None


async def _apply_bulk(chat_id, text) -> str | None:
    lines  = [l for l in text.split("\n") if l.strip()]
    fields = {}
    kosong = ["-", ".", "–"]

    for line in lines:
        if ":" not in line:
            continue
        key_raw, *val_parts = line.split(":")
        key = key_raw.strip().lower().replace(" ", "_")
        val = ":".join(val_parts).strip()
        fields[key] = val

    required = ["nama","jenis","lahir","kesehatan","tanggal_ib",
                 "pemberi_ib","jumlah_ib","bunting","hpl","sapih","birahi","catatan"]
    if not all(k in fields for k in required):
        return "⚠️ Format tidak lengkap. Pastikan semua 12 kolom diisi minimal dengan tanda -"

    def clean(v): return "" if (v or "").strip() in kosong else (v or "").strip()
    def parse_date(v):
        v = clean(v)
        return to_db_date(v) if v and is_valid_tanggal(v) else None

    for label, key in [("tanggal_ib","tanggal_ib"),("sapih","sapih"),("birahi","birahi"),("lahir","lahir")]:
        raw = clean(fields.get(key,""))
        if raw and not is_valid_tanggal(raw):
            return f"⚠️ Format tanggal salah untuk '{label}'. Gunakan dd/mm/yyyy."

    birahi_db = parse_date(fields.get("birahi",""))
    bunting_db, hpl_db = hitung_bunting_hpl(birahi_db) if birahi_db else (None, None)

    await update_user_state(chat_id, {
        "nama":              clean(fields.get("nama","")),
        "jenis":             clean(fields.get("jenis","")),
        "bulan_tahun_lahir": parse_date(fields.get("lahir","")),
        "status_kesehatan":  clean(fields.get("kesehatan","")),
        "tanggal_ib":        parse_date(fields.get("tanggal_ib","")),
        "pemberi_ib":        clean(fields.get("pemberi_ib","")),
        "jumlah_ib":         clean(fields.get("jumlah_ib","")) or None,
        "bunting":           bunting_db,
        "hpl":               hpl_db,
        "sapih":             parse_date(fields.get("sapih","")),
        "birahi":            birahi_db,
        "catatan":           clean(fields.get("catatan","")),
        "editing_field":     None,
    })
    return None


async def _send_preview(update, state):
    hewan_id   = state.get("hewan_id")
    usia_bulan = hitung_usia_bulan(state.get("bulan_tahun_lahir",""))
    hewan = {k: state.get(k) for k in ("nama","jenis","bulan_tahun_lahir","status_kesehatan")}
    repro = {k: state.get(k) for k in ("tanggal_ib","pemberi_ib","jumlah_ib","bunting","hpl","sapih","birahi","catatan")}

    await update.message.reply_text(
        _build_preview(hewan_id, hewan, repro, usia_bulan) + "\nYakin gak ada yang mau di edit lagi?",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ Yakin dong!", callback_data="konfirmasi")],
            [InlineKeyboardButton("❌ Cancel Deh",  callback_data="batal_edit")],
        ]),
    )


def _build_preview(hewan_id, hewan, repro, usia_bulan):
    repro = repro or {}
    return (
        "✅ <b>Data sementara diperbarui:</b>\n\n<pre>"
        f"🐄 Profil Ternak\n\n"
        f"📌 Nama       : {hewan.get('nama','-')}\n"
        f"🆔 RFID       : {hewan_id}\n"
        f"⚖️ Jenis      : {hewan.get('jenis','-')}\n"
        f"💡 Lahir      : {hewan.get('bulan_tahun_lahir','-')}\n"
        f"💉 Usia       : {format_usia(usia_bulan)}\n"
        f"🩺 Kesehatan  : {hewan.get('status_kesehatan') or '-'}\n\n\n\n"
        f"📊 Data Reproduksi Ternak\n\n"
        f"📆 Tanggal IB : {format_tanggal(repro.get('tanggal_ib')) or FORMAT_KOSONG}\n"
        f"👤 Pemberi IB : {repro.get('pemberi_ib') or FORMAT_KOSONG}\n"
        f"➕ Jumlah IB  : {'Inseminasi Buatan ke-' + str(repro['jumlah_ib']) if repro.get('jumlah_ib') else FORMAT_KOSONG}\n"
        f"🐂 Birahi     : {format_tanggal(repro.get('birahi')) or FORMAT_KOSONG}\n"
        f"🤰 Bunting    : {format_tanggal(repro.get('bunting')) or FORMAT_KOSONG}\n"
        f"🗓 HPL        : {format_tanggal(repro.get('hpl')) or FORMAT_KOSONG}\n"
        f"🐖 Sapih      : {format_tanggal(repro.get('sapih')) or FORMAT_KOSONG}\n"
        f"📝 Catatan    : {repro.get('catatan') or FORMAT_KOSONG}\n"
        "</pre>"
    )


# ──────────────────────────────────────────────
# Callbacks
# ──────────────────────────────────────────────

async def cb_konfirmasi_edit(chat_id: str, context: ContextTypes.DEFAULT_TYPE):
    state    = await get_user_state(chat_id)
    hewan_id = state.get("hewan_id")
    payload  = {
        "rfid":              hewan_id,
        "nama":              state.get("nama"),
        "jenis":             state.get("jenis"),
        "bulan_tahun_lahir": state.get("bulan_tahun_lahir"),
        "kesehatan":         state.get("status_kesehatan"),
        "tanggal_ib":        state.get("tanggal_ib") or "",
        "pemberi_ib":        state.get("pemberi_ib") or "",
        "jumlah_ib":         state.get("jumlah_ib"),
        "birahi":            state.get("birahi") or "",
        "bunting":           state.get("bunting") or "",
        "hpl":               state.get("hpl") or "",
        "sapih":             state.get("sapih") or "",
        "catatan":           state.get("catatan") or "",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                f"{BACKEND_URL}/api/scanner/hewan/{hewan_id}/edit-full",
                json=payload,
                headers=get_headers(chat_id),
            )
            resp.raise_for_status()
    except Exception as e:
        await context.bot.send_message(chat_id, f"❌ Gagal menyimpan data via API: {e}")
        return

    await context.bot.send_message(
        chat_id, "✅ Data berhasil disimpan!",
        reply_markup=ReplyKeyboardMarkup(
            [["📡 Scan RFID", "🔽 Opsi Tambahan"]], resize_keyboard=True
        ),
    )
    await clear_user_state(chat_id)


async def cb_batal_edit(chat_id: str, context: ContextTypes.DEFAULT_TYPE):
    state    = await get_user_state(chat_id)
    hewan_id = (state or {}).get("hewan_id")
    await clear_user_state(chat_id)

    if not hewan_id:
        await context.bot.send_message(chat_id, "❎ Edit dibatalkan.")
        return

    hewan = await get_hewan_by_id(hewan_id)
    repro = await get_repro_latest(hewan_id) or {}

    if not hewan:
        await context.bot.send_message(chat_id, "⚠️ Data hewan tidak ditemukan.")
        return

    usia_bulan = hitung_usia_bulan(hewan.get("bulan_tahun_lahir",""))
    await context.bot.send_message(
        chat_id,
        "❌ Edit dibatalkan. Berikut data asli:\n\n" + _build_preview(hewan_id, hewan, repro, usia_bulan),
        parse_mode="HTML",
        reply_markup=ReplyKeyboardMarkup(
            [["📡 Scan RFID", "🔽 Opsi Tambahan"]], resize_keyboard=True
        ),
    )