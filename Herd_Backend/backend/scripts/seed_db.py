import psycopg2  # type: ignore
import bcrypt
import os

db_config = {
    "dbname": os.getenv('DB_NAME', 'Collar_to_Gateway'),
    "user": os.getenv('DB_USER', 'postgres'),
    "password": os.getenv('DB_PASSWORD', 'postgre'),
    "host": os.getenv('DB_HOST', 'db'),
    "port": os.getenv('DB_PORT', '5432')
}

def init_db():
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        # Create tables
        print("Creating tables...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS collar_registry (
                collar_id VARCHAR(50) PRIMARY KEY,
                device_secret_hash TEXT NOT NULL,
                device_secret VARCHAR(100),
                status VARCHAR(20) DEFAULT 'ACTIVE',
                kandang_id VARCHAR(50)
            );
        """)
        
        # Ensure column exists if table was already created
        cur.execute("ALTER TABLE collar_registry ADD COLUMN IF NOT EXISTS device_secret VARCHAR(100);")
        cur.execute("ALTER TABLE reproduksi_ternak ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
        cur.execute("ALTER TABLE hewan ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
        cur.execute("ALTER TABLE hewan ADD COLUMN IF NOT EXISTS kelamin VARCHAR(20) DEFAULT 'betina';")
        cur.execute("ALTER TABLE hewan ADD COLUMN IF NOT EXISTS berat_badan FLOAT;")
        cur.execute("ALTER TABLE hewan ADD COLUMN IF NOT EXISTS estrus_probability FLOAT DEFAULT 0.0;")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES users(id);")
        
        # Ensure observation_logs table exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS observation_logs (
                id SERIAL PRIMARY KEY,
                cow_id VARCHAR(50) NOT NULL REFERENCES hewan(id) ON DELETE CASCADE,
                activity_type VARCHAR(50) NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Drop and recreate sensor_data to ensure latest schema (since it's empty)
        cur.execute("DROP TABLE IF EXISTS sensor_data;")
        cur.execute("""
            CREATE TABLE sensor_data (
                id SERIAL PRIMARY KEY,
                kandang_id VARCHAR(50),
                collar_id VARCHAR(50) REFERENCES collar_registry(collar_id),
                mean_z FLOAT,
                rms_z FLOAT,
                max_z FLOAT,
                activity_state VARCHAR(20),
                estrus_detected INTEGER,
                temperature FLOAT,
                battery_voltage FLOAT,
                battery_percent INTEGER,
                batch_ts TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Ensure vector extension and knowledge_base table exists for RAG
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_base (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                embedding vector(768)
            );
        """)
        
        # Seed dummy RAG data
        dummy_sops = [
            ("SOP Penanganan Sapi Terindikasi Penyakit Mulut dan Kuku (PMK)", "Langkah pertama saat menemukan sapi dengan gejala PMK (hipersalivasi, lepuh pada mulut/kuku): 1. Segera pisahkan sapi dari kandang utama ke kandang isolasi Blok C. 2. Hubungi drh. Budi di 0812-345-6789. 3. Semprot kandang lama dengan desinfektan klorin 2% selama 3 hari berturut-turut. Jangan memberi makan konsentrat keras."),
            ("SOP Pemberian Pakan Laktasi", "Sapi pada fase laktasi (menyusui) harus diberikan ransum pakan dengan protein kasar minimal 16%. Jadwal pemberian pakan: Pukul 06:00 (Hijauan 15kg), Pukul 10:00 (Konsentrat 5kg), Pukul 15:00 (Hijauan 15kg). Air minum harus tersedia ad libitum (tanpa batas)."),
            ("SOP Deteksi Birahi dan Inseminasi Buatan (IB)", "Jika sapi terdeteksi birahi oleh sensor Herd (Notifikasi ESTRUS_ALERT > 75%), peternak wajib melakukan pengecekan visual (vulva bengkak, lendir bening). Waktu paling optimal untuk Inseminasi Buatan (IB) adalah 12-18 jam setelah tanda birahi pertama muncul. Teknisi IB (Bapak Eko) harus dihubungi segera.")
        ]
        
        for title, content in dummy_sops:
            cur.execute("""
                INSERT INTO knowledge_base (title, content) 
                SELECT %s, %s 
                WHERE NOT EXISTS (SELECT 1 FROM knowledge_base WHERE title = %s);
            """, (title, content, title))

        
        # Insert test devices
        devices = [
            {"id": "COLLAR_001", "secret": "secret123", "kandang": "KANDANG_A"},
            {"id": "SAPI_A01", "secret": "Kp92!Dq_7XkL0@v", "kandang": "KANDANG_A"}
        ]
        
        for dev in devices:
            print(f"Registering/Updating device: {dev['id']}...")
            hashed = bcrypt.hashpw(dev['secret'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            cur.execute("""
                INSERT INTO collar_registry (collar_id, device_secret_hash, device_secret, status, kandang_id)
                VALUES (%s, %s, %s, 'ACTIVE', %s)
                ON CONFLICT (collar_id) DO UPDATE 
                SET device_secret_hash = EXCLUDED.device_secret_hash,
                    device_secret = EXCLUDED.device_secret;
            """, (dev['id'], hashed, dev['secret'], dev['kandang']))
        
        conn.commit()
        cur.close()
        conn.close()
        print("✅ Database initialized and devices registered.")
    except Exception as e:
        print(f"❌ Error initializing database: {e}")

if __name__ == "__main__":
    init_db()
