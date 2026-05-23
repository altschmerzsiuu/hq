"""
handlers/flow_search.py
Flow: 🔍 Cari Data
"""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup
from telegram.ext import ContextTypes

from telegram_bot.state import set_user_state, clear_user_state, update_user_state
from telegram_bot.helpers import build_profil_text
from telegram_bot.db_client import get_hewan_by_query, get_repro_latest


REPRO_KEYBOARD = ReplyKeyboardMarkup(
    [["➕ Tambah Reproduksi", "📂 Lihat Riwayat Reproduksi"], ["🔙 Kembali"]],
    resize_keyboard=True,
    one_time_keyboard=True,
)


async def handle_cari_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    await set_user_state(chat_id, {"mode": "search", "step": "waiting_input"})
    await update.message.reply_text("🔎 Masukkan nama atau RFID hewan terkait...")


async def handle_search_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
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
        await _show_single_result(update, chat_id, hewan, repro or {})
    else:
        buttons = [
            [InlineKeyboardButton(f"{h['nama']} - {h['id']}", callback_data=f"select_{h['id']}")]
            for h in results
        ]
        await update.message.reply_text(
            "⚠️ Ditemukan beberapa hewan dengan nama yang sama. Pilih hewan yang ingin diedit atau dihapus:",
            reply_markup=InlineKeyboardMarkup(buttons),
        )

    await clear_user_state(chat_id)


async def _show_single_result(update, chat_id: str, hewan: dict, repro: dict):
    text = build_profil_text(hewan, repro, judul="✅ <b>DATA DITEMUKAN!</b>")
    text += "\n📋 Silakan pilih opsi di bawah ini atau lanjut cari data lainnya?"

    await update.message.reply_text(
        text,
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("✏ Edit Data",  callback_data=f"edit_{hewan['id']}")],
            [InlineKeyboardButton("🗑 Hapus Data", callback_data=f"delete_{hewan['id']}")],
        ]),
    )
    await update.message.reply_text("💭 Pilih menu dulu, yuk!", reply_markup=REPRO_KEYBOARD)
    await set_user_state(chat_id, {"mode": "repro_ready", "id_hewan": hewan["id"]})