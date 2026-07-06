"""
handlers/callbacks.py
Semua handler InlineKeyboardButton callback_data.
"""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup
from telegram.ext import ContextTypes

from telegram_bot.state import get_user_state, clear_user_state, update_user_state
from telegram_bot.helpers import build_profil_text
from telegram_bot.db_client import get_hewan_by_id, get_repro_latest
from telegram_bot.handlers.flow_edit   import start_edit, cb_konfirmasi_edit, cb_batal_edit
from telegram_bot.handlers.flow_delete import cb_delete_hewan, cb_delete_repro


async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query   = update.callback_query
    chat_id = str(query.message.chat_id)
    data    = query.data

    await query.answer()

    # ── Pilih hewan dari list pencarian ──
    if data.startswith("select_"):
        hewan_id = data.split("_", 1)[1]
        await _show_selected_hewan(chat_id, hewan_id, context)

    # ── Edit data ──
    elif data.startswith("edit_"):
        hewan_id = data.split("_", 1)[1]
        await start_edit(chat_id, hewan_id, context)

    # ── Konfirmasi simpan edit ──
    elif data in ("konfirmasi", "konfirmasi_edit"):
        await cb_konfirmasi_edit(chat_id, context)

    # ── Batal edit ──
    elif data == "batal_edit":
        await cb_batal_edit(chat_id, context)

    # ── Hapus profil hewan ──
    elif data.startswith("delete_"):
        rfid = data.split("_", 1)[1]
        await cb_delete_hewan(chat_id, rfid, context)

    elif data == "cancel_delete":
        await context.bot.send_message(chat_id, "🚫 Penghapusan data dibatalkan.")

    # ── Hapus riwayat reproduksi ──
    elif data.startswith("rmv_repro_"):
        rfid = data.split("_")[2]
        await cb_delete_repro(chat_id, rfid, context)

    elif data == "cancel_rmvhistory":
        await context.bot.send_message(chat_id, "❎ Penghapusan riwayat dibatalkan.")
        await clear_user_state(chat_id)

    # ── Info versi bot ──
    elif data == "show_version":
        await context.bot.send_message(
            chat_id,
            "🛠 <b>Versi Bot</b>: v1.3.0 (last updated: 22 Mei 2025)\n\n"
            "📝 <b>Changelog</b>\n\n"
            "<pre>"
            "• 📥 Sinkronisasi data ke Google Sheets\n"
            "• 🐞 Tombol Scan hanya aktif saat ditekan\n"
            "• 🔒 Validasi UID diperketat\n"
            "• ⚡️ Kecepatan query ke database ditingkatkan"
            "</pre>",
            parse_mode="HTML",
        )


async def _show_selected_hewan(chat_id: str, hewan_id: str,
                                context: ContextTypes.DEFAULT_TYPE):
    hewan = await get_hewan_by_id(hewan_id)
    repro = await get_repro_latest(hewan_id)

    if not hewan:
        await context.bot.send_message(chat_id, "❌ Hewan tidak ditemukan.")
        return

    text = build_profil_text(hewan, repro or {}, judul="✅ <b>DATA TERPILIH!</b>")

    await context.bot.send_message(
        chat_id, text,
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("✏ Edit Data",  callback_data=f"edit_{hewan['id']}")],
            [InlineKeyboardButton("🗑 Hapus Data", callback_data=f"delete_{hewan['id']}")],
        ]),
    )
    await context.bot.send_message(
        chat_id, "💭 Pilih menu dulu, yuk!",
        reply_markup=ReplyKeyboardMarkup(
            [["➕ Tambah Reproduksi", "📂 Lihat Riwayat Reproduksi"], ["🔙 Kembali"]],
            resize_keyboard=True, one_time_keyboard=True,
        ),
    )
    await update_user_state(chat_id, {"mode": "repro_ready", "id_hewan": hewan_id})