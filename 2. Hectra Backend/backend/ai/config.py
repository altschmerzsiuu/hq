"""
ai/config.py
Centralized configuration for the Gendhis AI module.
"""
import os

# ── Gemini ──────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL: str   = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

# ── Database ─────────────────────────────────────────────────────────────
DB_CONFIG: dict = {
    "host"    : os.getenv("DB_HOST", "db"),
    "port"    : int(os.getenv("DB_PORT", 5432)),
    "database": os.getenv("DB_NAME", "Collar_to_Gateway"),
    "user"    : os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgre"),
}

# ── Google Calendar (leave credentials blank; user fills these in) ──────
# To enable:
#   1. Create a project in Google Cloud Console
#   2. Enable the Google Calendar API
#   3. Create OAuth2 credentials → download as credentials.json
#   4. Place credentials.json in /app/ inside the container
#   5. Set GOOGLE_CALENDAR_ID to your calendar ID (e.g. "primary")
GOOGLE_CALENDAR_CREDENTIALS_PATH: str = os.getenv(
    "GOOGLE_CALENDAR_CREDENTIALS_PATH",
    "/app/credentials.json"  # <-- place your file here
)
GOOGLE_CALENDAR_ID: str = os.getenv("GOOGLE_CALENDAR_ID", "primary")

# ── WhatsApp ──────────────────────────────────────────────────────────────
# We generate wa.me deep links – no API key required.
WHATSAPP_COUNTRY_CODE: str = os.getenv("WHATSAPP_COUNTRY_CODE", "62")  # Indonesia
