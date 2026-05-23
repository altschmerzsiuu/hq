-- 1. Add missing columns to sensor_data
ALTER TABLE sensor_data 
ADD COLUMN IF NOT EXISTS estrus_detected INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS activity_state VARCHAR(20) DEFAULT 'IDLE';

-- 2. Add cow_id mapping to collar_registry
-- Assuming hewan table uses 'kode_eartag_nasional' as primary key or unique identifier
ALTER TABLE collar_registry 
ADD COLUMN IF NOT EXISTS cow_id VARCHAR(50);

-- OPTIONAL: Add Foreign Key constraint if you want strict referential integrity
-- ALTER TABLE collar_registry 
-- ADD CONSTRAINT fk_cow_id FOREIGN KEY (cow_id) REFERENCES hewan (kode_eartag_nasional);

-- 3. Create ai_predictions table for advanced analysis results
CREATE TABLE IF NOT EXISTS ai_predictions (
    id SERIAL PRIMARY KEY,
    collar_id VARCHAR(50) NOT NULL,
    cow_id VARCHAR(50),
    prediction_type VARCHAR(50) NOT NULL, -- 'ESTRUS', 'HEALTH', 'PREGNANCY'
    confidence_score FLOAT,
    prediction_result VARCHAR(50), -- 'HIGH', 'LOW', 'POSITIVE', 'NEGATIVE'
    prediction_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_version VARCHAR(50),
    metadata JSONB
);

-- 4. Initial Data Mapping (Example for user's request)
-- Update specific collar to map to specific cow if they verify the keys match
UPDATE collar_registry 
SET cow_id = 'C670AE03' 
WHERE collar_id = 'SAPI_A01';

-- 5. Add notification preferences to user_preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS notif_estrus   BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notif_anomaly  BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notif_daily    BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notif_breeding BOOLEAN DEFAULT FALSE;
