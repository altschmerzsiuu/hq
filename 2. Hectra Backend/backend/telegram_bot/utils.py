from datetime import date
from dateutil.relativedelta import relativedelta

def hitung_usia(bulan_tahun_lahir: date) -> str:
    if not bulan_tahun_lahir: return "Tidak valid"
    today = date.today()
    delta = relativedelta(today, bulan_tahun_lahir)
    if delta.years > 0:
        return f"{delta.years} tahun {delta.months} bulan"
    return f"{delta.months} bulan"

def format_tanggal(tgl: date) -> str:
    if not tgl: return "-"
    return tgl.strftime("%d/%m/%Y")
