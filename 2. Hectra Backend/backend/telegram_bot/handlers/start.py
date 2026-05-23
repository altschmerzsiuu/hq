import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup
from telegram.ext import ContextTypes

from telegram_bot.state import clear_user_state
from telegram_bot.helpers import is_allowed
from telegram_bot.db_client import get_hewan_by_query, get_riwayat_count


# ──────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────

async def show_main_menu(update: Update):
    await update.message.reply_text(
        "⚡️ Pilih tindakan:",
        reply_markup=ReplyKeyboardMarkup(
            [["📡 Scan RFID", "🔽 Opsi Tambahan"]],
            resize_keyboard=True,
        ),
    )


# ──────────────────────────────────────────────
# Command handlers (sudah ada sebelumnya)
# ──────────────────────────────────────────────

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    if not is_allowed(chat_id):
        await update.message.reply_text("Maaf, Anda tidak memiliki akses.")
        return
    await update.message.reply_text(
        "Selamat datang! 👋 Tekan tombol Start untuk melanjutkan.",
        reply_markup=ReplyKeyboardMarkup(
            [["▶ Start"]], resize_keyboard=True, one_time_keyboard=True
        ),
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    if not is_allowed(chat_id):
        await update.message.reply_text("Maaf, Anda tidak memiliki akses.")
        return

    help_text = (
        "🐮 <b>Bot Pencatatan Ternak</b> — <i>v1.3.0</i>\n\n"
        "📋 <b>Manajemen Data</b>\n"
        "• <code>/mm</code> atau <code>/back</code> — Kembali ke menu utama\n"
        "• <code>/database</code> — Link ke Google Sheet database\n"
        "• <code>/template</code> — Format input lengkap untuk salin/edit\n"
        "• <code>/rh &lt;nama atau ID&gt;</code> — Hapus semua riwayat reproduksi hewan\n\n"
        "💡 <b>Tips:</b>\n"
        "• Bot ini hanya bisa digunakan oleh user yang diizinkan.\n"
        "• Untuk edit data, salin /template, ubah, lalu kirim kembali ke bot."
    )
    await update.message.reply_text(
        help_text,
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(
                "📊 Buka Database",
                url="https://docs.google.com/spreadsheets/d/11qQVDvy1UCch54Ri-4vd826FxnWm4nduLSSfp5EfXc4/edit?usp=sharing",
            )],
            [InlineKeyboardButton("🛠 Cek Versi", callback_data="show_version")],
        ]),
    )


async def mm_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    if not is_allowed(chat_id):
        await update.message.reply_text("Maaf, Anda tidak memiliki akses.")
        return
    await clear_user_state(chat_id)
    await show_main_menu(update)


# ──────────────────────────────────────────────
# Command handlers BARU
# ──────────────────────────────────────────────

async def database_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    if not is_allowed(chat_id):
        await update.message.reply_text("Maaf, Anda tidak memiliki akses.")
        return
    await update.message.reply_text(
        "📊 Ini link ke database hewan kamu:\n\n"
        "https://docs.google.com/spreadsheets/d/11qQVDvy1UCch54Ri-4vd826FxnWm4nduLSSfp5EfXc4/edit?usp=sharing"
    )


async def template_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    if not is_allowed(chat_id):
        await update.message.reply_text("Maaf, Anda tidak memiliki akses.")
        return
    await update.message.reply_text(
        "📝 Copy format input berikut untuk mengedit semua data:\n\n"
        "```\n"
        "Nama: \n"
        "Jenis: \n"
        "Lahir: \n"
        "Kesehatan: \n"
        "Tanggal IB: \n"
        "Pemberi IB: \n"
        "Jumlah IB: \n"
        "Bunting: \n"
        "HPL: \n"
        "Sapih: \n"
        "Birahi: \n"
        "Catatan: \n"
        "```\n\n"
        "ℹ️ *Catatan Penting*:\n"
        "• Jika *Tanggal Birahi* diisi, *Bunting* dan *HPL* dihitung otomatis\\.\n"
        "• Untuk mengosongkan data, gunakan tanda strip: `-`",
        parse_mode="MarkdownV2",
    )


async def rh_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/rh <nama atau RFID> — hapus semua riwayat reproduksi hewan."""
    chat_id = str(update.message.chat_id)
    if not is_allowed(chat_id):
        await update.message.reply_text("Maaf, Anda tidak memiliki akses.")
        return

    if not context.args:
        await update.message.reply_text("⚠️ Gunakan format: /rh <nama atau RFID>")
        return

    query = " ".join(context.args).strip()
    results = await get_hewan_by_query(query)

    if not results:
        await update.message.reply_text("❌ Hewan tidak ditemukan.")
        return

    if len(results) == 1:
        hewan = results[0]
        count = await get_riwayat_count(hewan["id"])

        if count == 0:
            await update.message.reply_text("📭 Tidak ada riwayat reproduksi untuk hewan ini.")
            return

        from telegram_bot.state import set_user_state
        await set_user_state(chat_id, {"mode": "delete_repro", "rfid": hewan["id"]})

        await update.message.reply_text(
            f"⚠️ Ditemukan {count} riwayat reproduksi untuk:\n\n"
            f"<pre>📌 Nama: {hewan['nama']}\n🆔 RFID: {hewan['id']}</pre>\n"
            "Apakah kamu yakin ingin <b>menghapus semua riwayat</b> ini?\n"
            "<i>Data profil tidak akan terhapus.</i>",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("✅ Ya Deh, Hapus Aja!", callback_data=f"rmv_repro_{hewan['id']}")],
                [InlineKeyboardButton("❌ Gak Dulu", callback_data="cancel_rmvhistory")],
            ]),
        )
    else:
        buttons = [
            [InlineKeyboardButton(f"{h['nama']} - {h['id']}", callback_data=f"rmv_repro_{h['id']}")]
            for h in results
        ]
        await update.message.reply_text(
            "🔍 Ditemukan beberapa hewan dengan nama serupa. Pilih salah satu:",
            reply_markup=InlineKeyboardMarkup(buttons),
        )