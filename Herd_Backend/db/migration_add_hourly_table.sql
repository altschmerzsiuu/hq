-- Migration: Add sensor_data_hourly table for time-series downsampling
-- Run this once against the live PostgreSQL database

-- Archive/Summary table: 1 row per collar per hour
CREATE TABLE IF NOT EXISTS sensor_data_hourly (
    id              SERIAL PRIMARY KEY,
    collar_id       VARCHAR(50),
    kandang_id      VARCHAR(50),
    hour_bucket     TIMESTAMP NOT NULL,    -- Truncated to the hour e.g. 2026-03-01 14:00:00
    avg_rms_z       FLOAT,
    avg_temperature FLOAT,
    max_rms_z       FLOAT,
    max_temperature FLOAT,
    min_temperature FLOAT,
    estrus_count    INTEGER DEFAULT 0,     -- How many estrus=1 readings in this hour
    sample_count    INTEGER DEFAULT 0,     -- How many raw rows were compressed
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast range queries from the dashboard
CREATE INDEX IF NOT EXISTS idx_hourly_collar ON sensor_data_hourly(collar_id);
CREATE INDEX IF NOT EXISTS idx_hourly_bucket ON sensor_data_hourly(hour_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_hourly_collar_bucket ON sensor_data_hourly(collar_id, hour_bucket DESC);

-- Grant access
GRANT ALL PRIVILEGES ON sensor_data_hourly TO postgres;
GRANT USAGE, SELECT ON SEQUENCE sensor_data_hourly_id_seq TO postgres;
