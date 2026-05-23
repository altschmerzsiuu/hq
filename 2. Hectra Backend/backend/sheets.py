import os
import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '11qQVDvy1UCch54Ri-4vd826FxnWm4nduLSSfp5EfXc4'

def _get_sheets_service():
    """Returns an authenticated Google Sheets v4 API service."""
    try:
        creds_json = {
            "type": os.getenv("GS_TYPE"),
            "project_id": os.getenv("GS_PROJECT_ID"),
            "private_key_id": os.getenv("GS_PRIVATE_KEY_ID"),
            "private_key": os.getenv("GS_PRIVATE_KEY", "").replace("\\n", "\n").replace('\\\\n', '\n'),
            "client_email": os.getenv("GS_CLIENT_EMAIL"),
            "client_id": os.getenv("GS_CLIENT_ID"),
            "auth_uri": os.getenv("GS_AUTH_URI"),
            "token_uri": os.getenv("GS_TOKEN_URI"),
            "auth_provider_x509_cert_url": os.getenv("GS_AUTH_PROVIDER_CERT_URL"),
            "client_x509_cert_url": os.getenv("GS_CLIENT_CERT_URL"),
        }
        
        # If credentials are not properly set in the env, return None
        if not creds_json["private_key"] or not creds_json["client_email"]:
            print("⚠️ [Sheets Sync] Google Sheets credentials missing in environment variables.")
            return None

        creds = service_account.Credentials.from_service_account_info(creds_json, scopes=SCOPES)
        return build('sheets', 'v4', credentials=creds)
    except Exception as e:
        print(f"❌ [Sheets Sync] Error initializing service: {e}")
        return None

def hitung_usia_bulan(tgl_lahir: str) -> int:
    try:
        tgl = datetime.datetime.strptime(tgl_lahir, "%d/%m/%Y")
        now = datetime.datetime.now()
        bulan = (now.year - tgl.year) * 12 + now.month - tgl.month
        if now.day < tgl.day:
            bulan -= 1
        return max(0, bulan)
    except Exception:
        return 0

def format_usia(usia_bulan: int) -> str:
    if usia_bulan < 0:
        return "Usia tidak valid"
    tahun = usia_bulan // 12
    bulan = usia_bulan % 12
    if tahun == 0:
        return f"{bulan} bulan"
    if bulan == 0:
        return f"{tahun} tahun"
    return f"{tahun} tahun {bulan} bulan"


async def sync_to_sheet(data: dict, sync_type: str):
    service = _get_sheets_service()
    if not service:
        return

    sheet = service.spreadsheets()
    now_str = datetime.datetime.now().strftime("%d-%m-%Y %H:%M:%S")

    if sync_type == "profil":
        usia_text = ""
        if data.get("bulan_tahun_lahir"):
            usia_text = format_usia(hitung_usia_bulan(data.get("bulan_tahun_lahir")))

        values = [[
            data.get("rfid", ""),
            data.get("nama", ""),
            data.get("jenis", ""),
            data.get("bulan_tahun_lahir", ""),
            usia_text,
            data.get("kesehatan", "")
        ]]
        body = {'values': values}
        sheet.values().append(
            spreadsheetId=SPREADSHEET_ID,
            range="Sheet1!A:F",
            valueInputOption="USER_ENTERED",
            body=body
        ).execute()
        print("✅ Data profil berhasil disinkronkan ke Google Sheets.")

    elif sync_type == "reproduksi":
        row_index = _find_row_by_rfid(service, data.get("rfid"))
        if row_index == -1:
            print("❌ RFID tidak ditemukan. Data reproduksi tidak disimpan.")
            return

        values = [[
            data.get("tanggal_ib", ""),
            data.get("pemberi_ib", ""),
            f"IB ke-{data.get('jumlah_ib')}" if data.get('jumlah_ib') else "",
            data.get("birahi", ""),
            data.get("bunting", ""),
            data.get("hpl", ""),
            data.get("sapih", ""),
            data.get("catatan", ""),
            now_str
        ]]
        body = {'values': values}
        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f"Sheet1!G{row_index}:O{row_index}",
            valueInputOption="USER_ENTERED",
            body=body
        ).execute()
        print("✅ Data reproduksi berhasil disinkronkan ke Google Sheets.")


async def edit_row_by_rfid(data: dict):
    service = _get_sheets_service()
    if not service:
        return

    sheet = service.spreadsheets()
    now_str = datetime.datetime.now().strftime("%d-%m-%Y %H:%M:%S")

    usia_text = "Usia tidak valid"
    if data.get("bulan_tahun_lahir"):
        usia_text = format_usia(hitung_usia_bulan(data.get("bulan_tahun_lahir")))

    row_index = _find_row_by_rfid(service, data.get("rfid"))
    if row_index == -1:
        print(f"⚠️ Data dengan RFID {data.get('rfid')} tidak ditemukan di Google Sheets.")
        return

    values = [[
        data.get("rfid", ""),
        data.get("nama", ""),
        data.get("jenis", ""),
        data.get("bulan_tahun_lahir", ""),
        usia_text,
        data.get("kesehatan", ""),
        data.get("tanggal_ib", ""),
        data.get("pemberi_ib", ""),
        f"IB ke-{data.get('jumlah_ib')}" if data.get('jumlah_ib') else "",
        data.get("birahi", ""),
        data.get("bunting", ""),
        data.get("hpl", ""),
        data.get("sapih", ""),
        data.get("catatan", ""),
        now_str
    ]]
    body = {'values': values}
    sheet.values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f"Sheet1!A{row_index}:O{row_index}",
        valueInputOption="USER_ENTERED",
        body=body
    ).execute()
    print(f"✅ Data RFID {data.get('rfid')} berhasil diperbarui di Google Sheets.")


async def delete_row_by_rfid(rfid: str):
    service = _get_sheets_service()
    if not service:
        return

    row_index = _find_row_by_rfid(service, rfid)
    if row_index == -1:
        print(f"⚠️ Tidak ada data dengan RFID {rfid}.")
        return

    try:
        # Row index in _find_row_by_rfid is 1-based, sheet API delete requires 0-based
        sheet_id = 0 # Default sheet id for the first sheet
        request_body = {
            "requests": [
                {
                    "deleteDimension": {
                        "range": {
                            "sheetId": sheet_id,
                            "dimension": "ROWS",
                            "startIndex": row_index - 1,
                            "endIndex": row_index
                        }
                    }
                }
            ]
        }
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body=request_body
        ).execute()
        print(f"✅ Data dengan RFID {rfid} berhasil dihapus dari spreadsheet.")
    except Exception as e:
        print(f"❌ Gagal hapus data dari spreadsheet: {str(e)}")


def _find_row_by_rfid(service, rfid: str) -> int:
    """Helper: returns 1-based row index, or -1 if not found."""
    if not rfid:
        return -1
    rfid = str(rfid).strip()
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Sheet1!A:A"
    ).execute()
    
    rows = result.get('values', [])
    for i, row in enumerate(rows):
        if row and str(row[0]).strip() == rfid:
            return i + 1
    return -1
