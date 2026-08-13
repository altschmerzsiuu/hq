-- ============================================================================
-- MIGRATION: Add parent_id to users table for team management
-- Run this once on the production database.
-- ============================================================================

-- Add parent_id column to link team members to their farm owner
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Index for fast lookup of all members under an owner
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parent_id);

-- For the default 'admin@farm.com' account (seeded in auth_migration.sql),
-- ensure it has role 'owner' so it can manage teams.
UPDATE users SET role = 'owner' WHERE email = 'admin@farm.com' AND role = 'admin';
