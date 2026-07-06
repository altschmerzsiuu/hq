-- ============================================================================
-- ENTERPRISE AUTHENTICATION SYSTEM - DATABASE SCHEMA
-- ============================================================================
-- This migration adds user authentication tables for the Estrus AI Dashboard

-- Table: users
-- Stores all user accounts (email/password and OAuth)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    password_hash TEXT,                     -- NULL for OAuth users
    
    -- OAuth Fields
    oauth_provider VARCHAR(50),             -- 'google', 'email', NULL
    oauth_id VARCHAR(255),                  -- Google user ID
    profile_picture_url TEXT,               -- From OAuth profile
    
    -- Roles & Permissions
    role VARCHAR(50) DEFAULT 'viewer',      -- 'admin', 'vet', 'staff', 'viewer'
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: refresh_tokens
-- Stores JWT refresh tokens for session management
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- Trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_users_updated_at();

-- Create first admin user (email: admin@farm.com, password: Admin123!)
-- Password hash generated with bcrypt rounds=12
INSERT INTO users (email, full_name, password_hash, oauth_provider, role, is_active)
VALUES (
    'admin@farm.com',
    'Admin User',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5UprcZvY0EwTK',  -- Admin123!
    'email',
    'admin',
    true
)
ON CONFLICT (email) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE users TO postgres;
GRANT ALL PRIVILEGES ON TABLE refresh_tokens TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;
