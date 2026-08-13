import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    conn = await asyncpg.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=5432
    )
    tables = ['hewan', 'sensor_data', 'reproduksi_ternak', 'prediksi_birahi', 'collar_registry', 'kandang']
    for table in tables:
        print(f"\n--- {table} ---")
        rows = await conn.fetch(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'")
        for row in rows:
            print(f"{row['column_name']}: {row['data_type']}")
        
    await conn.close()

asyncio.run(main())
