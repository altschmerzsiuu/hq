"""
handlers/flow_delete.py
Flow: 🗑 Hapus Data (profil hewan) + callback hapus riwayat reproduksi
"""

import httpx
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup
from telegram.ext import ContextTypes

from telegram_bot.state import set_user_state, clear_user_state
from telegram_bot.helpers import build_profil_text
from telegram_bot.db_client import get_hewan_by_query, get_repro_latest, get_headers

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:5000")

REPRO_KEYBOARD = ReplyKeyboardMarkup(
    [["➕ Tambah Reproduksi", "📂 Lihat Riwayat Reproduksi"], ["🔙 Kembali"]],
    resize_keyboard=True,
    one_time_keyboard=True,
)


# ──────────────────────────────────────────────
# Flow Hapus Profil
# ──────────────────────────────────────────────

async def handle_hapus_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    await set_user_state(chat_id, {"mode": "delete", "step": "waiting_input"})
    await update.message.reply_text("⚠️ Masukkan RFID atau Nama hewan yang ingin dihapus:")


async def handle_delete_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    text    = update.message.text.strip()

    results = await get_hewan_by_query(text)

    if not results:
        await update.message.reply_text("❌ Hewan dengan identitas tersebut tidak ditemukan.")
        await clear_user_state(chat_id)
        return

    if len(results) == 1:
        hewan = results[0]
        repro = await get_repro_latest(hewan["id"])

        profil_text = build_profil_text(hewan, repro or {}, judul="🔴 Anda yakin ingin menghapus data ini?\n")
        profil_text += "\n📋 Silakan pilih opsi di bawah ini:"

        await update.message.reply_text(
            profil_text,
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("✅ Ya, Hapus", callback_data=f"delete_{hewan['id']}")],
                [InlineKeyboardButton("❌ Batal",     callback_data="cancel_delete")],
            ]),
        )
        await update.message.reply_text("💭 Pilih menu dulu, yuk!", reply_markup=REPRO_KEYBOARD)
        await set_user_state(chat_id, {"mode": "repro_ready", "id_hewan": hewan["id"]})

    else:
        buttons = [
            [InlineKeyboardButton(
                f"{h['nama']} - {h['id']} - {h.get('jenis', '')}",
                callback_data=f"delete_{h['id']}"
            )]
            for h in results
        ]
        await update.message.reply_text(
            "⚠️ Ditemukan beberapa hewan dengan nama yang sama. Pilih hewan yang ingin dihapus:",
            reply_markup=InlineKeyboardMarkup(buttons),
        )
        await clear_user_state(chat_id)


# ──────────────────────────────────────────────
# Callback: eksekusi hapus
# ──────────────────────────────────────────────

async def cb_delete_hewan(chat_id: str, rfid: str, context: ContextTypes.DEFAULT_TYPE):
    """DELETE /api/scanner/hewan/{rfid}"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{BACKEND_URL}/api/scanner/hewan/{rfid}",
                headers=get_headers(chat_id),
            )
            resp.raise_for_status()
        await context.bot.send_message(chat_id, f"✅ Data hewan dengan RFID {rfid} telah dihapus.")
    except Exception as e:
        await context.bot.send_message(chat_id, f"❌ Gagal menghapus data via API: {e}")


async def cb_delete_repro(chat_id: str, rfid: str, context: ContextTypes.DEFAULT_TYPE):
    """DELETE /api/scanner/reproduksi/{rfid}"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{BACKEND_URL}/api/scanner/reproduksi/{rfid}",
                headers=get_headers(chat_id),
            )
            resp.raise_for_status()
        await context.bot.send_message(chat_id, "✅ Semua riwayat reproduksi untuk hewan ini telah dihapus.")
    except Exception as e:
        await context.bot.send_message(chat_id, f"⚠️ Gagal menghapus data via API: {e}")
    finally:
        await clear_user_state(chat_id)