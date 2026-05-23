# =============================================================================
# calendar_reminder.py — Step 6: ICS Generator for Breeding & Birth Reminders
# Taruh di: docker-iot-system/backend/calendar_reminder.py
# =============================================================================

from datetime import datetime, timedelta, timezone

def generate_ib_reminder_ics(cow_name: str, collar_id: str, kandang_id: str, 
                             estrus_detected_at: datetime, probability: float) -> bytes:
    """
    Generate .ics file for Optimal Insemination (15 hours after detection).
    """
    # Waktu optimal: 15 jam setelah deteksi (range standar 12-24 jam)
    start_time = estrus_detected_at + timedelta(hours=15)
    end_time   = start_time + timedelta(hours=1)
    
    # Format RFC5545 (YYYYMMDDTHHMMSSZ)
    dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dtstart = start_time.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dtend   = end_time.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    
    uid = f"estrus-{collar_id}-{start_time.strftime('%Y%H%M%S')}@estrus.ai"
    
    summary     = f"Jadwal IB: {cow_name} ({kandang_id})"
    description = (
        f"Sapi: {cow_name}\\n"
        f"Collar: {collar_id}\\n"
        f"Probabilitas: {probability:.0f}%\\n\\n"
        f"Waktu deteksi estrus: {estrus_detected_at.strftime('%Y-%m-%d %H:%M')}\\n"
        f"Lakukan Inseminasi sekarang (Jendela Optimal)."
    )
    
    ics_content = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Gendhis AI//Estrus AI//EN",
        "BEGIN:VEVENT",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{dtstart}",
        f"DTEND:{dtend}",
        f"UID:{uid}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{description}",
        f"LOCATION:Kandang {kandang_id}",
        "BEGIN:VALARM",
        "TRIGGER:-PT30M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Reminder Inseminasi",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR"
    ]
    
    return "\r\n".join(ics_content).encode("utf-8")

def generate_monthly_checkup_ics(cow_name: str, collar_id: str, hpl: datetime) -> bytes:
    """
    Generate .ics for birth preparation (30 days before HPL).
    """
    start_time = hpl - timedelta(days=30)
    end_time   = start_time + timedelta(hours=2)
    
    dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dtstart = start_time.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dtend   = end_time.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    
    uid = f"birth-{collar_id}-{hpl.strftime('%Y%m%d')}@estrus.ai"
    summary = f"Persiapan Kelahiran: {cow_name}"
    description = (
        f"Sapi: {cow_name}\\n"
        f"Perkiraan Lahir (HPL): {hpl.strftime('%d %b %Y')}\\n\\n"
        f"Mulai persiapan kandang karantina dan pantau suhu harian."
    )
    
    ics_content = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Gendhis AI//Estrus AI//EN",
        "BEGIN:VEVENT",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{dtstart}",
        f"DTEND:{dtend}",
        f"UID:{uid}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{description}",
        "BEGIN:VALARM",
        "TRIGGER:-P1D",
        "ACTION:DISPLAY",
        "DESCRIPTION:Persiapan Kelahiran",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR"
    ]
    
    return "\r\n".join(ics_content).encode("utf-8")