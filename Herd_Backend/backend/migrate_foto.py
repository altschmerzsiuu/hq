import asyncio
import os
from dotenv import load_dotenv
import asyncpg # type: ignore

load_dotenv()

async def main():
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=5433, # Exposing port 5433 from docker-compose
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'postgre'),
        database=os.getenv('DB_NAME', 'Collar_to_Gateway')
    )
    await conn.execute("ALTER TABLE hewan ADD COLUMN IF NOT EXISTS foto VARCHAR(255);")
    print("Migration successful")
    await conn.close()

asyncio.run(main())
