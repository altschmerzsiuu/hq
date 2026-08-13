import asyncio
import asyncpg
import os
import random
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

async def main():
    conn = await asyncpg.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=5432
    )

    print("Fetching cows for owner 3...")
    cows = await conn.fetch("SELECT id FROM hewan WHERE owner_id = 3")
    cow_ids = [c['id'] for c in cows]

    if not cow_ids:
        print("No cows found for owner 3!")
        return

    print("Inserting mock notifications...")
    await conn.execute("DELETE FROM notifications WHERE cow_id = ANY($1)", cow_ids)
    
    types = ['estrus_alert', 'health_warning', 'system']
    severities = ['HIGH', 'MEDIUM', 'LOW']
    messages = [
        "Sapi menunjukkan tanda-tanda birahi.",
        "Suhu tubuh sapi sedikit meningkat.",
        "Sapi kurang aktif hari ini.",
        "Aktivitas sapi sangat tinggi."
    ]

    for cow_id in random.sample(cow_ids, min(5, len(cow_ids))):
        await conn.execute("""
            INSERT INTO notifications (cow_id, type, message, severity, timestamp)
            VALUES ($1, $2, $3, $4, NOW())
        """, cow_id, random.choice(types), random.choice(messages), random.choice(severities))

    print("Inserting mock ai_predictions...")
    await conn.execute("DELETE FROM ai_predictions WHERE cow_id = ANY($1)", cow_ids)
    
    for cow_id in random.sample(cow_ids, min(5, len(cow_ids))):
        await conn.execute("""
            INSERT INTO ai_predictions (cow_id, collar_id, prediction_type, prediction_result, confidence_score, prediction_ts)
            VALUES ($1, 'mock-col', 'ESTRUS', 'HIGH', $2, NOW())
        """, cow_id, random.uniform(0.7, 0.95))

    print("Done!")
    await conn.close()

asyncio.run(main())
