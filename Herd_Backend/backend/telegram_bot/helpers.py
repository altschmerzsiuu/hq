"""
helpers.py
Fungsi utilitas yang dipakai di seluruh modul Telegram bot.
"""

import os
import re
from datetime import date, datetime
from dateutil.relativedelta import relativedelta


def is_allowed(chat_id: str) -> bool:
    allowed = [x.strip() for x in os.getenv("TELEGRAM_CHAT_IDS", "").split(",") if x.strip()]
    return chat_id in allowed


def is_valid_tanggal(tanggal: str) -> bool:
    if not re.match(r"^\d{2}/\d{2}/\d{4}$", tanggal or ""):
        return False
    try:
        dd, mm, yyyy = tanggal.split("/")
        datetime(int(yyyy), int(mm), int(dd))
        return True
    except ValueError:
        return False


def format_tanggal(val) -> str:
    if not val:
        return ""
    if isinstance(val, (date, datetime)):
        return val.strftime("%d/%m/%Y")
    try:
        if isinstance(val, str):
            val = val.strip()
            if val in ("-", ".", "–"):
                return ""
            if re.match(r"^\d{4}-\d{2}-\d{2}", val):
                return datetime.strptime(val[:10], "%Y-%m-%d").strftime("%d/%m/%Y")
            if re.match(r"^\d{2}/\d{2}/\d{4}$", val):
                return val
    except Exception:
        pass
    return ""


def format_usia(usia_bulan: int) -> str:
    if not isinstance(usia_bulan, int) or usia_bulan < 0:
        return "Usia tidak valid"
    tahun = usia_bulan // 12
    bulan = usia_bulan % 12
    if tahun == 0:
        return f"{bulan} bulan"
    if bulan == 0:
        return f"{tahun} tahun"
    return f"{tahun} tahun {bulan} bulan"


def hitung_usia_bulan(tanggal_lahir: str) -> int:
    if not is_valid_tanggal(tanggal_lahir or ""):
        return 0
    try:
        dd, mm, yyyy = tanggal_lahir.split("/")
        lahir = date(int(yyyy), int(mm), int(dd))
        delta = relativedelta(date.today(), lahir)
        return max(0, delta.years * 12 + delta.months)
    except Exception:
        return 0


def to_db_date(tanggal: str) -> str | None:
    if not tanggal or tanggal.strip() in ("-", ".", "–", ""):
        return None
    if not is_valid_tanggal(tanggal):
        return None
    dd, mm, yyyy = tanggal.split("/")
    return f"{yyyy}-{mm}-{dd}"


def hitung_bunting_hpl(tanggal_birahi_db: str):
    try:
        birahi  = datetime.strptime(tanggal_birahi_db, "%Y-%m-%d").date()
        bunting = birahi  + relativedelta(months=3)
        hpl     = bunting + relativedelta(months=9) + relativedelta(days=10)
        return bunting.strftime("%Y-%m-%d"), hpl.strftime("%Y-%m-%d")
    except Exception:
        return None, None


FORMAT_KOSONG = "Datanya belum ada nih..."


def build_profil_text(hewan: dict, repro: dict, judul: str = "🧩 Data ditemukan!") -> str:
    repro = repro or {}
    usia_bulan = hitung_usia_bulan(hewan.get("bulan_tahun_lahir", ""))
    return (
        f"{judul}\n\n"
        "<pre>"
        f"🐄 Profil Ternak\n\n"
        f"📌 Nama        : {hewan.get('nama', '-')}\n"
        f"🆔 RFID        : {hewan.get('id', '-')}\n"
        f"⚖️ Jenis       : {hewan.get('jenis', '-')}\n"
        f"💡 Lahir       : {hewan.get('bulan_tahun_lahir', '-')}\n"
        f"💉 Usia        : {format_usia(usia_bulan)}\n"
        f"🩺 Kesehatan   : {hewan.get('status_kesehatan') or 'Tidak ada catatan'}\n\n\n\n"
        f"📊 Data Reproduksi Ternak\n\n"
        f"📆 Tanggal IB  : {format_tanggal(repro.get('tanggal_ib')) or FORMAT_KOSONG}\n"
        f"👤 Pemberi IB  : {repro.get('pemberi_ib') or FORMAT_KOSONG}\n"
        f"➕ Jumlah IB   : {'Inseminasi Buatan ke-' + str(repro['jumlah_ib']) if repro.get('jumlah_ib') else FORMAT_KOSONG}\n"
        f"🐂 Birahi      : {format_tanggal(repro.get('birahi')) or FORMAT_KOSONG}\n"
        f"🤰 Bunting     : {format_tanggal(repro.get('bunting')) or FORMAT_KOSONG}\n"
        f"🗓 HPL         : {format_tanggal(repro.get('hpl')) or FORMAT_KOSONG}\n"
        f"🐖 Sapih       : {format_tanggal(repro.get('sapih')) or FORMAT_KOSONG}\n"
        f"📝 Catatan     : {repro.get('catatan') or FORMAT_KOSONG}\n"
        "</pre>"
    )