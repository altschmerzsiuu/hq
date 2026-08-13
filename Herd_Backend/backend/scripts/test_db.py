import asyncio
import os
import asyncpg
from datetime import date

async def main():
    try:
        conn = await asyncpg.connect(
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'postgre'),
            database=os.getenv('DB_NAME', 'Collar_to_Gateway'),
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432')
        )
        try:
            await conn.execute("""
                INSERT INTO hewan (id, nama, jenis, bulan_tahun_lahir, status_kesehatan, owner_id)
                VALUES ($1, $2, $3, $4, $5, $6)
            """, "TMP-TEST", "Sapi Uji", "Limousin", "2020-01-01", "Sehat", 1)
            print("INSERT SUCCESS!")
            await conn.execute("DELETE FROM hewan WHERE id = 'TMP-TEST'")
        except Exception as e:
            print("INSERT ERROR:", type(e).__name__, str(e))
        finally:
            await conn.close()
    except Exception as e:
        print("CONNECTION ERROR:", type(e).__name__, str(e))

asyncio.run(main())
