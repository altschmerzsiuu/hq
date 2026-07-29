-- Rollback SQL: Drop user_pins and trusted_devices tables
-- File: rollback_pin_devices.sql

DROP INDEX IF EXISTS idx_trusted_devices_uuid;
DROP INDEX IF EXISTS idx_trusted_devices_user;
DROP TABLE IF EXISTS trusted_devices;

DROP INDEX IF EXISTS idx_user_pins_user_id;
DROP TABLE IF EXISTS user_pins;
