"""
handlers/flow_repro.py
Flow: ➕ Tambah Reproduksi + 📂 Lihat Riwayat Reproduksi
"""

import httpx
import os
from telegram import Update, ReplyKeyboardMarkup
from telegram.ext import ContextTypes

from telegram_bot.state import set_user_state, get_user_state, clear_user_state, update_user_state
from telegram_bot.helpers import (
    is_valid_tanggal, format_tanggal, hitung_bunting_hpl,
    to_db_date, FORMAT_KOSONG,
)
from telegram_bot.db_client import check_hewan_exists, get_riwayat_reproduksi, get_headers

BACKEND_URL  = os.getenv("BACKEND_URL", "http://backend:5000")
BACK_KEYBOARD = ReplyKeyboardMarkup([["🔙 Kembali"]], resize_keyboard=True)


# ──────────────────────────────────────────────
# Lihat Riwayat
# ──────────────────────────────────────────────

async def handle_lihat_riwayat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id  = str(update.message.chat_id)
    state    = await get_user_state(chat_id)
    id_hewan = (state or {}).get("id_hewan")

    if not id_hewan:
        await update.message.reply_text("⚠️ Belum ada hewan terdeteksi. Silahkan scan kartunya terlebih dahulu.")
        return

    if not await check_hewan_exists(id_hewan):
        await clear_user_state(chat_id)
        await update.message.reply_text("📭 Data hewan tidak ditemukan. Silakan scan ulang kartu hewan yang valid.")
        return

    rows = await get_riwayat_reproduksi(id_hewan, limit=3)
    if not rows:
        await update.message.reply_text("📭 Belum ada riwayat reproduksi untuk hewan ini.")
        return

    text = "📋 <b>Riwayat Reproduksi:</b>\n\n\n"
    for i, row in enumerate(rows, 1):
        text += (
            f"<b>🧾 Riwayat {i}</b>\n<pre>"
            f"🗓️ Tanggal IB : {format_tanggal(row.get('tanggal_ib')) or '-'}\n"
            f"👤 Pemberi IB : {row.get('pemberi_ib') or '-'}\n"
            f"🔁 Jumlah IB  : {'Inseminasi Buatan ke-' + str(row['jumlah_ib']) if row.get('jumlah_ib') else '-'}\n"
            f"♻️ Birahi     : {format_tanggal(row.get('birahi')) or '-'}\n"
            f"🐄 Bunting    : {format_tanggal(row.get('bunting')) or '-'}\n"
            f"📅 HPL        : {format_tanggal(row.get('hpl')) or '-'}\n"
            f"🍼 Sapih      : {format_tanggal(row.get('sapih')) or '-'}\n"
            f"📝 Catatan    : {row.get('catatan') or '-'}\n\n"
            "</pre>\n\n"
        )

    await update.message.reply_text(text, parse_mode="HTML", reply_markup=BACK_KEYBOARD)
    await update_user_state(chat_id, {"mode": "scan"})


# ──────────────────────────────────────────────
# Tambah Reproduksi — Entry
# ──────────────────────────────────────────────

async def handle_tambah_repro(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id  = str(update.message.chat_id)
    state    = await get_user_state(chat_id)
    id_hewan = (state or {}).get("id_hewan")

    if not id_hewan:
        await update.message.reply_text("⚠️ Belum ada hewan terdeteksi. Silahkan scan kartunya terlebih dahulu.")
        return

    if not await check_hewan_exists(id_hewan):
        await clear_user_state(chat_id)
        await update.message.reply_text("📭 Data hewan tidak ditemukan. Silakan scan ulang kartu hewan yang valid.")
        return

    await set_user_state(chat_id, {"mode": "repro", "step": "tanggal_ib", "id_hewan": id_hewan})
    await update.message.reply_text("📆 Masukkan tanggal IB (dd/mm/yyyy):", reply_markup=BACK_KEYBOARD)


# ──────────────────────────────────────────────
# Tambah Reproduksi — Multi-step
# ──────────────────────────────────────────────

async def handle_repro_steps(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    text    = update.message.text.strip()
    state   = await get_user_state(chat_id)
    step    = state.get("step")

    if step == "tanggal_ib":
        if not is_valid_tanggal(text):
            await update.message.reply_text("❌ Format salah! Gunakan dd/mm/yyyy yang valid.")
            return
        await update_user_state(chat_id, {"step": "pemberi_ib", "tanggal_ib": to_db_date(text)})
        await update.message.reply_text("👤 Siapa yang memberi IB?")

    elif step == "pemberi_ib":
        await update_user_state(chat_id, {"step": "jumlah_ib", "pemberi_ib": text})
        await update.message.reply_text("🔢 Berapa kali IB dilakukan?")

    elif step == "jumlah_ib":
        if not text.isdigit():
            await update.message.reply_text("❌ Masukkan angka yang valid.")
            return
        await update_user_state(chat_id, {"step": "birahi", "jumlah_ib": int(text)})
        await update.message.reply_text("📆 Masukkan tanggal birahi (dd/mm/yyyy), atau ketik - jika belum tahu:")

    elif step == "birahi":
        if text != "-":
            if not is_valid_tanggal(text):
                await update.message.reply_text("❌ Format salah! Gunakan dd/mm/yyyy yang valid.")
                return
            birahi_db   = to_db_date(text)
            bunting_db, hpl_db = hitung_bunting_hpl(birahi_db)

            await update_user_state(chat_id, {
                "step": "konfirmasi_bunting_hpl",
                "birahi": birahi_db,
                "_calc_bunting": bunting_db,
                "_calc_hpl":     hpl_db,
            })
            await update.message.reply_text(
                "📊 Hasil perhitungan siklus peternakan:\n\n"
                "<pre>"
                f"🐂 Tanggal Birahi                       : {format_tanggal(birahi_db)}\n"
                f"🤰 Bunting (3 bulan setelah birahi)     : {format_tanggal(bunting_db)}\n"
                f"🗓 HPL (9 bulan 10 hari setelah bunting): {format_tanggal(hpl_db)}\n"
                "</pre>\nApakah perhitungan ini sesuai?",
                parse_mode="HTML",
                reply_markup=ReplyKeyboardMarkup(
                    [["✅ Ya, Gunakan", "❌ Koreksi Manual"]], resize_keyboard=True
                ),
            )
        else:
            await update_user_state(chat_id, {"step": "bunting", "birahi": None})
            await update.message.reply_text("📆 Masukkan tanggal bunting (dd/mm/yyyy), atau - jika belum tahu:")

    elif step == "konfirmasi_bunting_hpl":
        if text == "✅ Ya, Gunakan":
            await update_user_state(chat_id, {
                "step":    "sapih",
                "bunting": state.get("_calc_bunting"),
                "hpl":     state.get("_calc_hpl"),
                "_calc_bunting": None,
                "_calc_hpl":     None,
            })
            await update.message.reply_text("📆 Masukkan tanggal sapih (dd/mm/yyyy), atau - jika belum tahu:")
        elif text == "❌ Koreksi Manual":
            await update_user_state(chat_id, {"step": "bunting"})
            await update.message.reply_text("📆 Masukkan tanggal bunting (dd/mm/yyyy):")
        else:
            await update.message.reply_text("Pilih: ✅ Ya, Gunakan  atau  ❌ Koreksi Manual")

    elif step == "bunting":
        bunting_db = None
        if text != "-":
            if not is_valid_tanggal(text):
                await update.message.reply_text("❌ Format salah! Gunakan dd/mm/yyyy.")
                return
            bunting_db = to_db_date(text)
        await update_user_state(chat_id, {"step": "sapih", "bunting": bunting_db})
        await update.message.reply_text("📆 Masukkan tanggal sapih (dd/mm/yyyy), atau - jika belum tahu:")

    elif step == "sapih":
        sapih_db = None
        if text != "-":
            if not is_valid_tanggal(text):
                await update.message.reply_text("❌ Format salah! Gunakan dd/mm/yyyy.")
                return
            sapih_db = to_db_date(text)
        await update_user_state(chat_id, {"step": "catatan", "sapih": sapih_db})
        await update.message.reply_text("📝 Catatan tambahan, atau ketik - jika tidak ada:")

    elif step == "catatan":
        catatan = text if text != "-" else None
        state   = await get_user_state(chat_id)  # refresh state terbaru

        payload = {
            "rfid":       state["id_hewan"],
            "tanggal_ib": state.get("tanggal_ib"),
            "pemberi_ib": state.get("pemberi_ib"),
            "jumlah_ib":  state.get("jumlah_ib"),
            "bunting":    state.get("bunting"),
            "hpl":        state.get("hpl"),
            "sapih":      state.get("sapih"),
            "birahi":     state.get("birahi"),
            "catatan":    catatan,
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{BACKEND_URL}/api/scanner/reproduksi",
                    json=payload,
                    headers=get_headers(chat_id),
                )
                resp.raise_for_status()
        except Exception as e:
            await update.message.reply_text(f"❌ Gagal menyimpan: {e}")
            return

        await update.message.reply_text(
            "✅ Data reproduksi berhasil disimpan!\n\n"
            "<pre>"
            f"📆 Tanggal IB  : {format_tanggal(payload['tanggal_ib']) or FORMAT_KOSONG}\n"
            f"👤 Pemberi IB  : {payload['pemberi_ib'] or FORMAT_KOSONG}\n"
            f"➕ Jumlah IB   : {'Inseminasi Buatan ke-' + str(payload['jumlah_ib']) if payload.get('jumlah_ib') else FORMAT_KOSONG}\n"
            f"🐂 Birahi      : {format_tanggal(payload['birahi']) or FORMAT_KOSONG}\n"
            f"🤰 Bunting     : {format_tanggal(payload['bunting']) or FORMAT_KOSONG}\n"
            f"🗓 HPL         : {format_tanggal(payload['hpl']) or FORMAT_KOSONG}\n"
            f"🐖 Sapih       : {format_tanggal(payload['sapih']) or FORMAT_KOSONG}\n"
            f"📝 Catatan     : {catatan or FORMAT_KOSONG}\n"
            "</pre>\n\n"
            "🔷 Silakan lanjutkan dengan scan kartu berikutnya atau kembali ke menu.",
            parse_mode="HTML",
            reply_markup=BACK_KEYBOARD,
        )
        await clear_user_state(chat_id)


# ──────────────────────────────────────────────
# Tolak tawaran tambah reproduksi
# ──────────────────────────────────────────────

async def handle_tidak_repro(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    await clear_user_state(chat_id)
    await update.message.reply_text(
        "🔄 Oke boss! Silakan tempelkan kartu RFID lagi.",
        reply_markup=BACK_KEYBOARD,
    )