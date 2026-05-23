import os
import requests
import urllib.parse
import logging

logger = logging.getLogger(__name__)

def send_whatsapp(to_number: str, message: str) -> bool:
    """
    Sends a WhatsApp message using the Unofficial CallMeBot API.
    Aman dan gampang untuk project/FYP, tapi diperuntukkan bagi admin/personal notes.
    """
    # Mengambil API key dan phone number admin dari .env
    # CallMeBot butuh API Key spesifik untuk setiap nomor penerima.
    api_key = os.getenv("CALLMEBOT_API_KEY")
    phone = os.getenv("CALLMEBOT_PHONE")
    
    if not api_key or not phone:
        logger.warning("CallMeBot credentials missing (CALLMEBOT_API_KEY or CALLMEBOT_PHONE). Cannot send WA.")
        return False
        
    # Pastikan to_number sesuai dengan yang didaftarkan di CallMeBot
    # Jika parameter to_number beda dengan CALLMEBOT_PHONE, kita override 
    # demi keamanan (karena API Key hanya berlaku untuk 1 nomor itu)
    target_phone = phone.replace("+", "").replace("-", "").replace(" ", "")
    
    encoded_message = urllib.parse.quote(message)
    url = f"https://api.callmebot.com/whatsapp.php?phone={target_phone}&text={encoded_message}&apikey={api_key}"
    
    try:
        response = requests.get(url, timeout=10)
        
        # CallMeBot kadang mereturn 200 tapi isinya teks error. Asumsi aman jika status code = 200.
        if response.status_code == 200 and "Error" not in response.text:
            logger.info(f"✅ WhatsApp via CallMeBot sent successfully to {target_phone}!")
            return True
        else:
            logger.error(f"❌ CallMeBot API Error: {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Failed to send WhatsApp message via CallMeBot: {str(e)}")
        return False
