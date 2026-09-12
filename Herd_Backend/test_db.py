import asyncio
import asyncpg

async def main():
    try:
        conn = await asyncpg.connect('postgres://postgres:postgres@localhost:5432/herd_db')
        owner_id = 1
        status = 'active'
        limit = 50
        cow_id = 'HRD-HG0J'
        
        rows = await conn.fetch("""
            SELECT 
                pb.id,
                pb.rfid AS cow_id,
                h.nama  AS cow_name,
                h.jenis AS breed,
                pb.prediksi_tanggal,
                pb.prediksi_ib_optimal,
                pb.window_awal,
                pb.window_akhir,
                pb.confidence_layer1,
                pb.confidence_layer2,
                pb.confidence_layer3,
                pb.confidence_final,
                pb.metode,
                pb.status,
                pb.verified,
                pb.created_at,
                -- Days until next predicted estrus
                (pb.prediksi_tanggal - CURRENT_DATE)::int AS days_until,
                -- Is in window right now?
                (CURRENT_DATE BETWEEN pb.window_awal AND pb.window_akhir) AS in_window_now
            FROM prediksi_birahi pb
            LEFT JOIN hewan h ON h.id = pb.rfid
            WHERE pb.owner_id = $1
              AND ($2::text = 'all' OR pb.status = $2)
              AND ($4::text IS NULL OR pb.rfid = $4)

            ORDER BY pb.prediksi_tanggal ASC
            LIMIT $3
        """, owner_id, status, limit, cow_id)
        
        print(f"Query success. Rows: {len(rows)}")
    except Exception as e:
        print(f"DB Error: {e}")

asyncio.run(main())
