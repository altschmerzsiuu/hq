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
