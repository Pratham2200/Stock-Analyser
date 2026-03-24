-- ============================================
-- AI LAYERS DATABASE MIGRATION
-- Run this after your existing schema.sql
-- ============================================

-- 1. AI Configuration Table
CREATE TABLE IF NOT EXISTS ai_analysis_config (
    id SERIAL PRIMARY KEY,
    layer_type VARCHAR(20) NOT NULL CHECK (layer_type IN ('rejection_review', 'selection_validation')),
    provider VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    api_endpoint TEXT,
    prompt_template TEXT NOT NULL,
    temperature DECIMAL(3,2) DEFAULT 0.3,
    max_tokens INTEGER DEFAULT 2000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. AI Analysis Results Table
CREATE TABLE IF NOT EXISTS ai_analysis_results (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
    scan_id INTEGER REFERENCES scans(id),
    config_id INTEGER REFERENCES ai_analysis_config(id),
    layer_type VARCHAR(20) NOT NULL CHECK (layer_type IN ('rejection_review', 'selection_validation')),
    source_decision VARCHAR(20) NOT NULL,
    ai_decision VARCHAR(20) NOT NULL CHECK (ai_decision IN ('passed', 'rejected', 'uncertain')),
    confidence_score DECIMAL(5,2),
    reasoning TEXT,
    key_factors JSONB,
    final_status VARCHAR(20) NOT NULL CHECK (final_status IN ('selected', 'observation', 'rejected')),
    tokens_used INTEGER,
    processing_time_ms INTEGER,
    raw_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stock_id, scan_id, layer_type)
);

-- 3. Observation Queue Table
CREATE TABLE IF NOT EXISTS observation_queue (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
    scan_id INTEGER REFERENCES scans(id),
    ai_analysis_id INTEGER REFERENCES ai_analysis_results(id),
    source VARCHAR(30) NOT NULL,
    priority INTEGER DEFAULT 5,
    user_decision VARCHAR(20) CHECK (user_decision IN ('approved', 'rejected', 'pending')),
    user_notes TEXT,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'completed', 'expired')),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stock_id, scan_id)
);

-- 4. AI Analysis History Table
CREATE TABLE IF NOT EXISTS ai_analysis_history (
    id SERIAL PRIMARY KEY,
    stock_symbol VARCHAR(20) NOT NULL,
    scan_date DATE NOT NULL,
    code_decision VARCHAR(20),
    ai_layer_1_decision VARCHAR(20),
    ai_layer_2_decision VARCHAR(20),
    user_decision VARCHAR(20),
    final_outcome VARCHAR(20),
    actual_performance JSONB,
    was_prediction_correct BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. AI API Logs Table (Request/Response Tracking)
CREATE TABLE IF NOT EXISTS ai_api_logs (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
    scan_id INTEGER REFERENCES scans(id),
    ai_result_id INTEGER REFERENCES ai_analysis_results(id),
    request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    endpoint TEXT,
    request_payload JSONB NOT NULL,
    prompt_tokens INTEGER,
    response_timestamp TIMESTAMP,
    response_status INTEGER,
    response_payload JSONB,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    latency_ms INTEGER,
    estimated_cost DECIMAL(10,6),
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_results_stock_id ON ai_analysis_results(stock_id);
CREATE INDEX IF NOT EXISTS idx_ai_results_scan_id ON ai_analysis_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_results_layer_type ON ai_analysis_results(layer_type);
CREATE INDEX IF NOT EXISTS idx_observation_status ON observation_queue(status);
CREATE INDEX IF NOT EXISTS idx_observation_stock ON observation_queue(stock_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_stock_id ON ai_api_logs(stock_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_scan_id ON ai_api_logs(scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_timestamp ON ai_api_logs(request_timestamp);

-- 7. Persistent AI Rate Limit State Table
-- Tracks per-provider rate limit windows across restarts.
CREATE TABLE IF NOT EXISTS ai_rate_limits (
    id                    SERIAL PRIMARY KEY,
    provider              VARCHAR(50) NOT NULL UNIQUE,
    blocked_until         TIMESTAMP,
    last_429_at           TIMESTAMP,
    daily_quota_resets_at TIMESTAMP,
    daily_requests_used   INTEGER DEFAULT 0,
    daily_tokens_used     INTEGER DEFAULT 0,
    consecutive_429s      INTEGER DEFAULT 0,
    notes                 TEXT,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_provider ON ai_rate_limits(provider);

-- ============================================
-- SEED DATA (safe to re-run — uses ON CONFLICT)
-- ============================================

-- Seed ai_analysis_config (required for ai_analysis_results FK)
INSERT INTO ai_analysis_config (id, layer_type, provider, model_name, prompt_template, temperature, max_tokens, is_active)
VALUES
  (1, 'rejection_review',     'gemini-2.0-flash', 'gemini-2.0-flash', 'Default rejection review prompt',    0.20, 1024, true),
  (2, 'selection_validation', 'gemini-2.0-flash', 'gemini-2.0-flash', 'Default selection validation prompt', 0.20, 1024, true)
ON CONFLICT (id) DO UPDATE
  SET is_active  = EXCLUDED.is_active,
      updated_at = CURRENT_TIMESTAMP;

-- Seed ai_rate_limits rows for all known providers
INSERT INTO ai_rate_limits (provider)
VALUES ('gemini'), ('groq'), ('openrouter')
ON CONFLICT (provider) DO NOTHING;
