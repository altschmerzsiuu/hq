"""
handlers/flow_register.py
Flow: ➕ Tambah Hewan (multi-step setelah scan RFID baru)
"""

import httpx
import os
from datetime import date
from telegram import Update, ReplyKeyboardMarkup
from telegram.ext import ContextTypes

from telegram_bot.state import set_user_state, get_user_state, update_user_state, clear_user_state
from telegram_bot.helpers import is_valid_tanggal, hitung_usia_bulan, format_usia, to_db_date
from telegram_bot.db_client import get_available_collars, get_headers

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:5000")
BACK_KEYBOARD = ReplyKeyboardMarkup([["🔙 Kembali"]], resize_keyboard=True)


async def handle_tambah_hewan(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    state   = await get_user_state(chat_id)

    if not state or not state.get("uid"):
        await update.message.reply_text("⚠️ Mohon scan RFID terlebih dahulu.")
        return

    await set_user_state(chat_id, {"mode": "register", "step": "nama", "uid": state["uid"]})
    await update.message.reply_text(
        "✏️ Silakan ketik nama hewan yang ingin didaftarkan:",
        reply_markup=BACK_KEYBOARD,
    )


async def handle_register_steps(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    text    = update.message.text.strip()
    state   = await get_user_state(chat_id)
    step    = state.get("step")

    # ── Nama ──
    if step == "nama":
        await update_user_state(chat_id, {"step": "jenis", "nama": text})
        await update.message.reply_text("✏️ Silakan ketik jenis hewan:", reply_markup=BACK_KEYBOARD)

    # ── Jenis ──
    elif step == "jenis":
        await update_user_state(chat_id, {"step": "lahir", "jenis": text})
        await update.message.reply_text(
            "📌 Masukkan tanggal lahir hewan (dd/mm/yyyy):",
            reply_markup=BACK_KEYBOARD,
        )

    # ── Tanggal Lahir ──
    elif step == "lahir":
        parts = text.split("/")
        if len(parts) != 3:
            await update.message.reply_text("❌ Format salah! Gunakan dd/mm/yyyy (contoh: 10/05/2020).")
            return
        try:
            dd, mm, yyyy = int(parts[0]), int(parts[1]), int(parts[2])
        except ValueError:
            await update.message.reply_text("❌ Input tidak valid. Gunakan angka.")
            return

        if not (1 <= dd <= 31 and 1 <= mm <= 12 and 2000 <= yyyy <= date.today().year):
            await update.message.reply_text(
                "❌ Input tidak valid.\n- Tanggal 1-31\n- Bulan 1-12\n- Tahun 2000-sekarang"
            )
            return
        if not is_valid_tanggal(text):
            await update.message.reply_text("❌ Tanggal tidak valid (misal 30 Februari tidak ada).")
            return

        await update_user_state(chat_id, {"step": "kesehatan", "bulan_tahun_lahir": text})
        await update.message.reply_text(
            "📌 Pilih status kesehatan:",
            reply_markup=ReplyKeyboardMarkup(
                [["✅ Sehat", "⚠️ Sakit"], ["🏥 Butuh Perawatan", "Hamil"]],
                resize_keyboard=True,
            ),
        )

    # ── Kesehatan → Simpan ke DB ──
    elif step == "kesehatan":
        uid = state["uid"]
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{BACKEND_URL}/api/scanner/profil",
                    json={
                        "id": uid,
                        "nama": state["nama"],
                        "jenis": state["jenis"],
                        "bulan_tahun_lahir": to_db_date(state["bulan_tahun_lahir"]),
                        "status_kesehatan": text,
                    },
                    headers=get_headers(chat_id),
                )
                resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            detail = e.response.json().get("detail", str(e))
            await update.message.reply_text(f"❌ Gagal menyimpan: {detail}")
            return
        except Exception as e:
            await update.message.reply_text(f"❌ Gagal menyimpan data: {e}")
            return

        usia_bulan = hitung_usia_bulan(state["bulan_tahun_lahir"])
        await update.message.reply_text(
            "✅ Hewan berhasil didaftarkan!\n\n"
            "<pre>"
            f"📌 Nama        : {state['nama']}\n"
            f"🆔 RFID        : {uid}\n"
            f"⚖️ Jenis       : {state['jenis']}\n"
            f"💉 Lahir       : {state['bulan_tahun_lahir']}\n"
            f"💉 Usia        : {format_usia(usia_bulan)}\n"
            f"🩺 Kesehatan   : {text}"
            "</pre>",
            parse_mode="HTML",
        )

        collars = await get_available_collars()
        if collars:
            collar_buttons = [[f"Pair: {c['collar_id']}"] for c in collars]
            collar_buttons.append(["❌ Nggak, Ah!"])
            await set_user_state(chat_id, {
                "mode": "register", "step": "pairing",
                "uid": uid, "nama": state["nama"],
            })
            await update.message.reply_text(
                "🐮 Mau sekalian pasang kalung sensornya?",
                reply_markup=ReplyKeyboardMarkup(
                    collar_buttons, resize_keyboard=True, one_time_keyboard=True
                ),
            )
        else:
            await update.message.reply_text(
                "✅ Data disimpan! Mau tambah data reproduksi sekarang?",
                reply_markup=ReplyKeyboardMarkup(
                    [["➕ Tambah Reproduksi", "❌ Nggak, Ah!"]],
                    resize_keyboard=True, one_time_keyboard=True,
                ),
            )
            await set_user_state(chat_id, {"mode": "repro_ready", "id_hewan": uid})

    # ── Pairing Kalung ──
    elif step == "pairing":
        uid  = state.get("uid")
        nama = state.get("nama", "")

        if text.startswith("Pair: "):
            collar = text.replace("Pair: ", "").strip()
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.patch(
                        f"{BACKEND_URL}/api/scanner/hewan/{uid}/collar",
                        json={"collar_id": collar},
                        headers=get_headers(chat_id),
                    )
                    resp.raise_for_status()
                await update.message.reply_text(
                    f"🎉 Sapi <b>{nama}</b> terhubung dengan kalung <b>{collar}</b>.",
                    parse_mode="HTML",
                )
            except Exception as e:
                await update.message.reply_text(f"❌ Gagal mendaftarkan kalung: {e}")
        else:
            await update.message.reply_text("👍 Sapi didaftarkan tanpa kalung sensor.")

        await update.message.reply_text(
            "Mau sekalian tambah data reproduksinya?",
            reply_markup=ReplyKeyboardMarkup(
                [["➕ Tambah Reproduksi", "❌ Nggak, Ah!"]],
                resize_keyboard=True, one_time_keyboard=True,
            ),
        )
        await set_user_state(chat_id, {"mode": "repro_ready", "id_hewan": uid})