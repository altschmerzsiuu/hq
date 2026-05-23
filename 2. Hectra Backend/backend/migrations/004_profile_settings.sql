-- Profile & Settings Schema Migration
-- Creates tables for farm settings and user preferences

-- Farm Settings Table
CREATE TABLE IF NOT EXISTS farm_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    farm_name VARCHAR(255),
    farm_location TEXT,
    farm_contact VARCHAR(100),
    total_cattle_capacity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    telegram_bot_token VARCHAR(255),
    telegram_chat_id VARCHAR(100),
    email_notifications BOOLEAN DEFAULT true,
    telegram_notifications BOOLEAN DEFAULT true,
    theme VARCHAR(20) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'en',
    alert_threshold_estrus INTEGER DEFAULT 80,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_farm_settings_user_id ON farm_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_farm_settings_updated_at ON farm_settings;
CREATE TRIGGER update_farm_settings_updated_at
    BEFORE UPDATE ON farm_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default preferences for existing users
INSERT INTO user_preferences (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_preferences)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO farm_settings (user_id, farm_name)
SELECT id, 'My Farm' FROM users
WHERE id NOT IN (SELECT user_id FROM farm_settings)
ON CONFLICT (user_id) DO NOTHING;
