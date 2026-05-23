"""
handlers/menu.py
Router utama semua pesan teks dari keyboard Telegram.
Menggantikan file menu.py lama yang hanya punya skeleton 4 tombol.
"""

from telegram import Update, ReplyKeyboardMarkup
from telegram.ext import ContextTypes

from telegram_bot.state import get_user_state, clear_user_state, set_user_state
from telegram_bot.helpers import is_allowed

# Flow handlers
from telegram_bot.handlers.flow_search   import handle_cari_data, handle_search_input
from telegram_bot.handlers.flow_delete   import handle_hapus_data, handle_delete_input
from telegram_bot.handlers.flow_register import handle_tambah_hewan, handle_register_steps
from telegram_bot.handlers.flow_repro    import (
    handle_tambah_repro, handle_lihat_riwayat,
    handle_repro_steps, handle_tidak_repro,
)
from telegram_bot.handlers.flow_edit     import handle_edit_text


# ──────────────────────────────────────────────
# Tombol statis yang selalu diproses duluan
# ──────────────────────────────────────────────
STATIC_BUTTONS = {
    "▶ Start", "📡 Scan RFID", "🔙 Kembali", "🔽 Opsi Tambahan",
    "🔍 Cari Data", "🗑 Hapus Data",
    "➕ Tambah Hewan", "➕ Tambah Sapi Baru", "➕ Tambah Reproduksi",
    "📂 Lihat Riwayat Reproduksi", "❌ Nggak, Ah!",
    # Konfirmasi birahi
    "✅ Ya, Gunakan", "❌ Koreksi Manual",
    # Pilihan kesehatan saat registrasi
    "✅ Sehat", "⚠️ Sakit", "🏥 Butuh Perawatan", "Hamil",
}


async def show_main_menu(update: Update):
    await update.message.reply_text(
        "⚡️ Pilih tindakan:",
        reply_markup=ReplyKeyboardMarkup(
            [["📡 Scan RFID", "🔽 Opsi Tambahan"]],
            resize_keyboard=True,
        ),
    )


# ──────────────────────────────────────────────
# Entry point — dipanggil oleh bot.py
# ──────────────────────────────────────────────

async def handle_text_menus(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return

    chat_id = str(update.message.chat_id)
    text    = update.message.text.strip()

    if not is_allowed(chat_id):
        await update.message.reply_text("Maaf, Anda tidak memiliki akses.")
        return

    print(f"📡 [TELEGRAM] '{text}' from chat_id={chat_id}")

    # ── 1. Tombol statis — selalu diproses duluan ──
    if text in STATIC_BUTTONS or text.startswith("Pair: "):
        await _route_static(update, context, chat_id, text)
        return

    # ── 2. Routing berdasarkan state aktif ──
    state = await get_user_state(chat_id)
    mode  = (state or {}).get("mode", "")

    if mode == "edit":
        await handle_edit_text(update, context)

    elif mode == "register":
        await handle_register_steps(update, context)

    elif mode == "repro":
        await handle_repro_steps(update, context)

    elif mode == "search" and (state or {}).get("step") == "waiting_input":
        await handle_search_input(update, context)

    elif mode == "delete" and (state or {}).get("step") == "waiting_input":
        await handle_delete_input(update, context)

    else:
        await show_main_menu(update)


# ──────────────────────────────────────────────
# Router tombol statis
# ──────────────────────────────────────────────

async def _route_static(update: Update, context: ContextTypes.DEFAULT_TYPE,
                        chat_id: str, text: str):

    if text == "▶ Start":
        await show_main_menu(update)

    elif text == "📡 Scan RFID":
        await set_user_state(chat_id, {"mode": "scan"})
        await update.message.reply_text(
            "🔷 Silahkan scan kartu Anda...",
            reply_markup=ReplyKeyboardMarkup([["🔙 Kembali"]], resize_keyboard=True),
        )

    elif text == "🔙 Kembali":
        state = await get_user_state(chat_id)
        mode  = (state or {}).get("mode", "")
        if mode == "register":
            await set_user_state(chat_id, {"mode": "scan"})
            await update.message.reply_text(
                "🔷 Silahkan scan kartu Anda...",
                reply_markup=ReplyKeyboardMarkup([["🔙 Kembali"]], resize_keyboard=True),
            )
        else:
            await clear_user_state(chat_id)
            await show_main_menu(update)

    elif text == "🔽 Opsi Tambahan":
        await update.message.reply_text(
            "⚙️ Pilih tindakan:",
            reply_markup=ReplyKeyboardMarkup(
                [["🔍 Cari Data", "🗑 Hapus Data"], ["🔙 Kembali"]],
                resize_keyboard=True,
            ),
        )

    elif text == "🔍 Cari Data":
        await handle_cari_data(update, context)

    elif text == "🗑 Hapus Data":
        await handle_hapus_data(update, context)

    elif text in ("➕ Tambah Hewan", "➕ Tambah Sapi Baru"):
        await handle_tambah_hewan(update, context)

    elif text == "➕ Tambah Reproduksi":
        await handle_tambah_repro(update, context)

    elif text == "📂 Lihat Riwayat Reproduksi":
        await handle_lihat_riwayat(update, context)

    elif text == "❌ Nggak, Ah!":
        state = await get_user_state(chat_id)
        if (state or {}).get("step") == "pairing":
            await handle_register_steps(update, context)
        else:
            await handle_tidak_repro(update, context)

    elif text in ("✅ Ya, Gunakan", "❌ Koreksi Manual"):
        await handle_repro_steps(update, context)

    elif text in ("✅ Sehat", "⚠️ Sakit", "🏥 Butuh Perawatan", "Hamil"):
        state = await get_user_state(chat_id)
        if (state or {}).get("mode") == "register":
            await handle_register_steps(update, context)
        else:
            await show_main_menu(update)

    elif text.startswith("Pair: "):
        state = await get_user_state(chat_id)
        if (state or {}).get("step") == "pairing":
            await handle_register_steps(update, context)