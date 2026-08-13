import asyncio
import asyncpg
import os
import random
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

COW_PHOTOS = [
    "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=500&q=80",
    "https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=500&q=80",
    "https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?w=500&q=80",
    "https://images.unsplash.com/photo-1596733430284-f7437764b1a9?w=500&q=80",
    "https://images.unsplash.com/photo-1627885408990-bc4f95d4ed79?w=500&q=80",
    "https://images.unsplash.com/photo-1601614051052-b88bf9098bc8?w=500&q=80",
]

COW_NAMES = ["Bessie", "Daisy", "Gendhis", "Cici", "Moo", "Luna", "Siti", "Bella", "Sukma", "Tini", "Wulan", "Ayu", "Juminten", "Lestari", "Marni"]
STATUS_KESEHATAN = ["Sehat", "Sehat", "Sehat", "Normal", "Butuh Perawatan", "Sakit Ringan"]

async def seed_data():
    conn = await asyncpg.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=5432
    )

    print("Clearing old mockup data...")
    await conn.execute("DELETE FROM sensor_data")
    await conn.execute("DELETE FROM prediksi_birahi")
    await conn.execute("DELETE FROM reproduksi_ternak")
    await conn.execute("DELETE FROM collar_registry")
    await conn.execute("DELETE FROM hewan")
    await conn.execute("DELETE FROM kandang")

    print("Seeding Kandang...")
    await conn.execute("""
        INSERT INTO kandang (id, nama, lokasi, kapasitas, owner_id, created_at)
        VALUES ('K-001', 'Kandang A', 'Blok Timur', 50, 1, NOW()),
               ('K-002', 'Kandang B', 'Blok Barat', 30, 1, NOW())
    """)

    print("Seeding Hewan...")
    now_tz_naive = datetime.now()
    now_tz_aware = datetime.now(timezone.utc)
    cows = []
    for i in range(15):
        cow_id = f"C{random.randint(1000, 9999)}A"
        name = COW_NAMES[i]
        foto = random.choice(COW_PHOTOS)
        status = random.choice(STATUS_KESEHATAN)
        cows.append(cow_id)
        
        await conn.execute("""
            INSERT INTO hewan (id, nama, jenis, usia, berat_badan, kelamin, foto, status_kesehatan, owner_id, bulan_tahun_lahir, created_at)
            VALUES ($1, $2, 'Limousin', $3, $4, 'Betina', $5, $6, 1, '2020-01', NOW())
        """, cow_id, name, random.randint(24, 60), random.uniform(400, 600), foto, status)

    print("Seeding Collar Registry...")
    for i, cow_id in enumerate(cows):
        if random.random() > 0.2:
            collar_id = f"COL-{i:03d}"
            await conn.execute("""
                INSERT INTO collar_registry (collar_id, cow_id, kandang_id, status, device_secret, device_secret_hash)
                VALUES ($1, $2, 'K-001', 'active', 'secret', 'hash')
            """, collar_id, cow_id)

            for h in range(24):
                ts_naive = now_tz_naive - timedelta(hours=h)
                ts_aware = now_tz_aware - timedelta(hours=h)
                temp = random.uniform(38.0, 39.5)
                await conn.execute("""
                    INSERT INTO sensor_data (collar_id, temperature, battery_percent, activity_state, mean_z, created_at, batch_ts)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                """, collar_id, temp, random.randint(40, 100), random.choice(["Ruminasi", "Aktif", "Istirahat"]), random.uniform(0.1, 1.5), ts_naive, ts_aware)

    print("Seeding Reproduksi Ternak...")
    for cow_id in cows:
        if random.random() > 0.5:
            ib_date = now_tz_naive.date() - timedelta(days=random.randint(30, 200))
            await conn.execute("""
                INSERT INTO reproduksi_ternak (rfid, tanggal_ib, birahi, pemberi_ib, jumlah_ib, created_at)
                VALUES ($1, $2, $3, 'Inseminator Budi', 1, NOW())
            """, cow_id, ib_date, ib_date - timedelta(days=1))

    print("Seeding Prediksi Birahi...")
    for cow_id in cows:
        offset = random.randint(-5, 10)
        pred_date = now_tz_naive.date() + timedelta(days=offset)
        opt_ib = pred_date + timedelta(days=1)
        conf = random.uniform(0.4, 0.95)
        
        await conn.execute("""
            INSERT INTO prediksi_birahi (rfid, prediksi_tanggal, prediksi_ib_optimal, window_awal, window_akhir, confidence_final, status, metode, owner_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'active', 'calendar+ml', 1, NOW())
        """, cow_id, pred_date, opt_ib, pred_date, pred_date + timedelta(days=2), conf)
        
    print("Data seeded successfully!")
    await conn.close()

asyncio.run(seed_data())
