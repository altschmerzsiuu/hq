import asyncio
import asyncpg
import os
from datetime import date, timedelta

DB_CONFIG = {
    "host": os.getenv('DB_HOST', 'db'),
    "port": int(os.getenv('DB_PORT', 5432)),
    "database": os.getenv('DB_NAME', 'Collar_to_Gateway'),
    "user": os.getenv('DB_USER', 'postgres'),
    "password": os.getenv('DB_PASSWORD', 'postgre')
}

async def main():
    print("Connecting to DB...")
    # if running locally without docker, host is likely localhost
    DB_CONFIG['host'] = os.getenv('DB_HOST', 'localhost')
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
    except Exception as e:
        print(f"Failed to connect to {DB_CONFIG['host']}: {e}")
        return

    # Get the main owner_id (first user)
    owner_id = await conn.fetchval("SELECT id FROM users ORDER BY id ASC LIMIT 1")
    if not owner_id:
        print("No users found in database!")
        await conn.close()
        return

    cow_id = "COLLAR_DEMO_01"
    
    print(f"Ensuring cow {cow_id} exists...")
    # Delete if exists to recreate
    await conn.execute("DELETE FROM hewan WHERE id = $1", cow_id)
    
    # Insert Cow
    await conn.execute("""
        INSERT INTO hewan (id, nama, jenis, bulan_tahun_lahir, usia, status_kesehatan, owner_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    """, cow_id, "Sapi Demo Sidang", "Simmental", "10/05/2021", 60, "Sehat", owner_id)
    
    print("Inserting 2 reproduction cycles...")
    today = date.today()
    
    # Cycle 1: 6 attempts (last one successful)
    cycle1_start = today - timedelta(days=400)
    for i in range(6):
        is_pregnant = (i == 5)
        service_date = cycle1_start + timedelta(days=i*21)
        await conn.execute("""
            INSERT INTO reproduksi_ternak (rfid, tanggal_ib, pemberi_ib, jumlah_ib, is_pregnant, catatan)
            VALUES ($1, $2, $3, $4, $5, $6)
        """, cow_id, service_date, "Mantri Budi", i+1, is_pregnant, f"Siklus 1 - Inseminasi ke-{i+1}")
    
    # Cycle 2: 4 attempts (last one failed or pending)
    # The cow gave birth approx 280 days after cycle 1 success.
    # So cycle 2 starts after calving.
    calving_date = (cycle1_start + timedelta(days=5*21)) + timedelta(days=283)
    cycle2_start = calving_date + timedelta(days=60)
    for i in range(4):
        is_pregnant = False # all failed so far
        service_date = cycle2_start + timedelta(days=i*21)
        await conn.execute("""
            INSERT INTO reproduksi_ternak (rfid, tanggal_ib, pemberi_ib, jumlah_ib, is_pregnant, catatan)
            VALUES ($1, $2, $3, $4, $5, $6)
        """, cow_id, service_date, "Mantri Budi", i+1, is_pregnant, f"Siklus 2 - Inseminasi ke-{i+1}")

    # Register Collar
    print("Registering collar...")
    await conn.execute("DELETE FROM collar_registry WHERE collar_id = $1", cow_id)
    await conn.execute("""
        INSERT INTO collar_registry (collar_id, device_secret_hash, status, cow_id)
        VALUES ($1, 'demo_hash', 'ACTIVE', $1)
    """, cow_id)

    print("Demo data created successfully!")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
