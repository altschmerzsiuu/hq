-- ============================================================================
-- Gendhis AI – DB Migration
-- Run this ONCE manually in pgAdmin before restarting the containers.
-- ============================================================================

-- 1. Enable pgvector extension (needed for RAG knowledge base)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Knowledge Base table for RAG (farm management guides, SOPs, etc.)
--    embedding dimension = 768 (Google text-embedding-004)
CREATE TABLE IF NOT EXISTS knowledge_base (
    id         SERIAL PRIMARY KEY,
    title      TEXT        NOT NULL,
    content    TEXT        NOT NULL,
    embedding  vector(768),
    created_at TIMESTAMP   DEFAULT NOW(),
    updated_at TIMESTAMP   DEFAULT NOW()
);

-- Index for fast cosine-similarity search
CREATE INDEX IF NOT EXISTS idx_kb_embedding
    ON knowledge_base USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 3. chat_sessions table (JSONB) – already exists in most setups.
--    Only creates if NOT EXISTS so it is safe to re-run.
CREATE TABLE IF NOT EXISTS chat_sessions (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT        NOT NULL,
    title      TEXT,
    messages   JSONB       DEFAULT '[]'::jsonb,
    created_at TIMESTAMP   DEFAULT NOW(),
    updated_at TIMESTAMP   DEFAULT NOW(),
    UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user
    ON chat_sessions(user_id, updated_at DESC);

-- ============================================================================
-- Example: Seed a knowledge base article (optional – remove if not needed)
-- ============================================================================
-- INSERT INTO knowledge_base (title, content) VALUES (
--   'Deteksi Estrus pada Sapi',
--   'Estrus (birahi) pada sapi berlangsung 12-18 jam. Tanda utama: sapi gelisah, menaiki sapi lain, produksi susu turun. Inseminasi optimal dilakukan 12 jam setelah tanda pertama.'
-- );
