import asyncio
import asyncpg

async def main():
    pool = await asyncpg.create_pool("postgresql://postgres:postgres@localhost:5432/Collar_to_Gateway")
    async with pool.acquire() as conn:
        records = await conn.fetch("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'prediksi_birahi'")
        for r in records:
            print(f"{r['column_name']}: {r['data_type']}")
        
        print("\nChecking for id 87:")
        r = await conn.fetchrow("SELECT * FROM prediksi_birahi WHERE id = 87")
        print(r)

if __name__ == '__main__':
    asyncio.run(main())
