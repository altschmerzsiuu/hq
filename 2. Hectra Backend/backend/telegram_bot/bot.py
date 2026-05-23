import os
import logging
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    CallbackQueryHandler, filters
)

# Commands
from telegram_bot.handlers.start import start_command, help_command, mm_command
from telegram_bot.handlers.start import rh_command, template_command, database_command

# Message & Callback router
from telegram_bot.handlers.menu import handle_text_menus
from telegram_bot.handlers.callbacks import handle_callback

logger = logging.getLogger(__name__)
bot_application: Application | None = None


async def start_telegram_bot():
    global bot_application
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        print("⚠️ [TELEGRAM] TELEGRAM_BOT_TOKEN not set. Bot will not start.")
        return

    try:
        print("📡 [TELEGRAM] Starting Telegram Bot initialization...")
        bot_application = Application.builder().token(token).build()

        # ── Slash commands ──
        bot_application.add_handler(CommandHandler("start",    start_command))
        bot_application.add_handler(CommandHandler("help",     help_command))
        bot_application.add_handler(CommandHandler("mm",       mm_command))
        bot_application.add_handler(CommandHandler("back",     mm_command))
        bot_application.add_handler(CommandHandler("rh",       rh_command))
        bot_application.add_handler(CommandHandler("template", template_command))
        bot_application.add_handler(CommandHandler("database", database_command))

        # ── Inline keyboard callbacks ──
        bot_application.add_handler(CallbackQueryHandler(handle_callback))

        # ── Semua pesan teks (keyboard button & input user) ──
        bot_application.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_menus)
        )

        await bot_application.initialize()
        await bot_application.start()
        await bot_application.updater.start_polling()
        print("✅ [TELEGRAM] Telegram Bot started successfully via FastAPI.")

    except Exception as e:
        print(f"❌ [TELEGRAM ERROR] Failed to start Telegram Bot: {e}")


async def stop_telegram_bot():
    global bot_application
    if bot_application:
        await bot_application.updater.stop()
        await bot_application.stop()
        await bot_application.shutdown()
        logger.info("Telegram Bot stopped.")