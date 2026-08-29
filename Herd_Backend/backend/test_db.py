import asyncio
import os
import asyncpg

async def main():
    pool = await asyncpg.create_pool(os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres"))
    async with pool.acquire() as conn:
        cols = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = 'reproduksi_ternak';")
        print([c['column_name'] for c in cols])
        
if __name__ == '__main__':
    asyncio.run(main())
