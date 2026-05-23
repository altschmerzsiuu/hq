-- Database initialization script for historical data (scanner app)
-- Creates tables for animal management and reproduction tracking

-- Table: hewan (Master data ternak)
CREATE TABLE IF NOT EXISTS hewan (
    id VARCHAR(50) PRIMARY KEY,           -- RFID tag
    nama VARCHAR(100) NOT NULL,
    jenis VARCHAR(50) NOT NULL,
    bulan_tahun_lahir VARCHAR(20) NOT NULL, -- Format: dd/mm/yyyy
    usia INTEGER,                         -- Usia dalam bulan
    status_kesehatan VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: reproduksi_ternak (Current/latest reproduction data)
CREATE TABLE IF NOT EXISTS reproduksi_ternak (
    id SERIAL PRIMARY KEY,
    rfid VARCHAR(50) REFERENCES hewan(id) ON DELETE CASCADE,
    tanggal_ib DATE,
    pemberi_ib VARCHAR(100),
    jumlah_ib INTEGER,
    bunting DATE,
    hpl DATE,                              -- Hari Perkiraan Lahir
    sapih DATE,
    birahi DATE,
    catatan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rfid)                          -- Only one active record per animal
);

-- Table: riwayat_reproduksi (Historical reproduction data - last 3 records)
CREATE TABLE IF NOT EXISTS riwayat_reproduksi (
    id SERIAL PRIMARY KEY,
    rfid VARCHAR(50) REFERENCES hewan(id) ON DELETE CASCADE,
    tanggal_ib DATE,
    pemberi_ib VARCHAR(100),
    jumlah_ib INTEGER,
    bunting DATE,
    hpl DATE,
    sapih DATE,
    birahi DATE,
    catatan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: feed_ai (Log data for AI analysis)
CREATE TABLE IF NOT EXISTS feed_ai (
    id SERIAL PRIMARY KEY,
    rfid VARCHAR(50) REFERENCES hewan(id) ON DELETE CASCADE,
    tanggal_ib DATE,
    pemberi_ib VARCHAR(100),
    jumlah_ib INTEGER,
    birahi DATE,
    bunting DATE,
    hpl DATE,
    sapih DATE,
    catatan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: collar_registry (Device management and security)
CREATE TABLE IF NOT EXISTS collar_registry (
    collar_id VARCHAR(50) PRIMARY KEY,
    device_secret_hash TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    kandang_id VARCHAR(50),
    cow_id VARCHAR(50) REFERENCES hewan(id) ON DELETE SET NULL -- [NEW] Mapping to Cow/Hewan
);

-- Table: sensor_data (High-frequency IoT Data)
CREATE TABLE IF NOT EXISTS sensor_data (
    id SERIAL PRIMARY KEY,
    kandang_id VARCHAR(50),
    collar_id VARCHAR(50) REFERENCES collar_registry(collar_id),
    mean_z FLOAT,
    rms_z FLOAT,
    max_z FLOAT,
    activity_state VARCHAR(20),     -- [NEW] EATING, RESTING, RUMINATING
    estrus_detected INTEGER,        -- [NEW] 1 = Estrus Signs, 0 = Normal
    temperature FLOAT,
    battery_voltage FLOAT,
    battery_percent INTEGER,
    batch_ts TIMESTAMP WITH TIME ZONE, -- [NEW] Device Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: ai_predictions (Stored analysis results)
CREATE TABLE IF NOT EXISTS ai_predictions (
    id SERIAL PRIMARY KEY,
    collar_id VARCHAR(50) NOT NULL REFERENCES collar_registry(collar_id),
    cow_id VARCHAR(50) REFERENCES hewan(id),
    prediction_type VARCHAR(50) NOT NULL, -- 'ESTRUS', 'HEALTH', 'PREGNANCY'
    confidence_score FLOAT,
    prediction_result VARCHAR(50), -- 'HIGH', 'LOW', 'POSITIVE', 'NEGATIVE'
    prediction_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_version VARCHAR(50),
    metadata JSONB
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_hewan_nama ON hewan(nama);
CREATE INDEX IF NOT EXISTS idx_reproduksi_rfid ON reproduksi_ternak(rfid);
CREATE INDEX IF NOT EXISTS idx_riwayat_rfid ON riwayat_reproduksi(rfid);
CREATE INDEX IF NOT EXISTS idx_riwayat_tanggal ON riwayat_reproduksi(tanggal_ib DESC);
CREATE INDEX IF NOT EXISTS idx_feed_ai_rfid ON feed_ai(rfid);

-- [NEW] Sensor & AI Indexes
CREATE INDEX IF NOT EXISTS idx_sensor_collar ON sensor_data(collar_id);
CREATE INDEX IF NOT EXISTS idx_sensor_ts ON sensor_data(batch_ts DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cow ON ai_predictions(cow_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for hewan table
CREATE TRIGGER update_hewan_updated_at BEFORE UPDATE ON hewan
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for reproduksi_ternak table
CREATE TRIGGER update_reproduksi_updated_at BEFORE UPDATE ON reproduksi_ternak
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust if using different user)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;
