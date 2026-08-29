import asyncio
import os
import sys
import asyncpg
from datetime import date, timedelta

async def setup_history(rfid: str, owner_id: int):
    pool = await asyncpg.create_pool("postgresql://postgres:postgres@localhost:5432/postgres")
    async with pool.acquire() as conn:
        # Periksa apakah sapi ada
        cow = await conn.fetchrow("SELECT id FROM hewan WHERE id = $1", rfid)
        if not cow:
            print(f"❌ Sapi dengan RFID {rfid} tidak ditemukan. Silakan tambahkan lewat UI terlebih dahulu.")
            return

        today = date.today()

        # Hapus riwayat reproduksi sebelumnya untuk sapi ini
        await conn.execute("DELETE FROM reproduksi_ternak WHERE rfid = $1", rfid)
        
        records = []
        
        # --- SIKLUS 1 (Berhasil setelah 6x) ---
        lahir_date = today - timedelta(days=150)
        c1_success = lahir_date - timedelta(days=283) # 283 hari masa bunting
        
        for i in range(1, 6):
            t_ib = c1_success - timedelta(days=21 * (6 - i))
            records.append((rfid, t_ib, f"Siklus 1 - Suntik {i}", i, None, None, None))
        
        # Ke-6 berhasil
        records.append((rfid, c1_success, "Siklus 1 - Suntik 6 (Berhasil)", 6, c1_success, c1_success + timedelta(days=283), lahir_date))

        # --- SIKLUS 2 (Sudah 4x gagal, hari ini tepat siklus ke-5) ---
        c2_ib4 = today - timedelta(days=21)
        for i in range(1, 5):
            t_ib = c2_ib4 - timedelta(days=21 * (4 - i))
            records.append((rfid, t_ib, f"Siklus 2 - Suntik {i}", i, None, None, None))

        # Insert semua
        for r in records:
            await conn.execute("""
                INSERT INTO reproduksi_ternak (rfid, tanggal_ib, catatan, jumlah_ib, bunting, hpl, sapih)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """, *r)

        print(f"✅ Berhasil membuat riwayat reproduksi untuk {rfid}!")
        print("Siklus 1: 6x IB -> Berhasil -> Lahir 5 bulan lalu.")
        print(f"Siklus 2: 4x IB -> IB terakhir {c2_ib4.strftime('%d %b %Y')} (Tepat 21 hari yang lalu).")
        print("💡 SIAP DEMO: Coba goyangkan collar sekarang, sistem akan memprediksi estrus sangat tinggi karena tepat siklus 21 hari!")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Penggunaan: python3 setup_demo.py <RFID_SAPI>")
        sys.exit(1)
    asyncio.run(setup_history(sys.argv[1], 1))
