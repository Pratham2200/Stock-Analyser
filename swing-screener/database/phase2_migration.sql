-- 7. Options Analysis Data
CREATE TABLE IF NOT EXISTS options_analysis (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    expiry_date DATE NOT NULL,
    current_spot DECIMAL(10,2),
    pcr_ratio DECIMAL(8,4),
    max_pain_strike INTEGER,
    support_level INTEGER,
    resistance_level INTEGER,
    iv_level VARCHAR(20),
    trend VARCHAR(20),
    raw_chain_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. AI Conversation History
CREATE TABLE IF NOT EXISTS ai_conversations (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'user' | 'assistant'
    content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    processing_time_ms INTEGER DEFAULT 0,
    data_used JSONB, -- Record of what data (quote, news, etc) was pulled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additional Indexes
CREATE INDEX IF NOT EXISTS idx_options_analysis_symbol ON options_analysis(symbol);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session_id ON ai_conversations(session_id);
