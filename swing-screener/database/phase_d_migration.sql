-- ============================================================================
-- PHASE D: Comprehensive Database Restructuring
-- Stock Analysis Pro — Full Persistence Layer
-- ============================================================================
-- Design Principles:
--   1. ACID Compliance: Entire migration runs in a single transaction
--   2. Normalization (3NF): No redundant data, proper foreign keys
--   3. Referential Integrity: CASCADE deletes where parent owns child
--   4. Constraints: CHECK constraints on enums, NOT NULL on required fields
--   5. Performance: Targeted indexes on query-hot columns
--   6. Audit Trail: created_at/updated_at on every mutable table
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 0: CLEANUP — Drop legacy/incomplete tables before re-creating
-- ============================================================================

-- Drop incomplete Phase D tables from earlier migration attempt (if any)
DROP TABLE IF EXISTS alert_trigger_history CASCADE;
DROP TABLE IF EXISTS compound_alerts CASCADE;
DROP TABLE IF EXISTS trade_cards CASCADE;
DROP TABLE IF EXISTS ai_trade_ideas CASCADE;
DROP TABLE IF EXISTS ai_watchlists CASCADE;
DROP TABLE IF EXISTS trade_journal_entries CASCADE;
DROP TABLE IF EXISTS ai_conversations CASCADE;
DROP TABLE IF EXISTS paper_trade_history CASCADE;
DROP TABLE IF EXISTS paper_positions CASCADE;
DROP TABLE IF EXISTS paper_portfolios CASCADE;
DROP TABLE IF EXISTS trade_journals CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;

-- Drop superseded legacy tables
DROP TABLE IF EXISTS stock_performance CASCADE;
DROP TABLE IF EXISTS portfolio_positions CASCADE;

-- ============================================================================
-- GROUP 1: PAPER TRADING SYSTEM (3NF Normalized)
-- Relationship: user → portfolio (1:1) → positions (1:N) + trade_history (1:N)
-- ============================================================================

-- 1.1 Paper Trading Portfolios (One per user — 1:1 enforced by UNIQUE)
CREATE TABLE paper_portfolios (
    id              SERIAL PRIMARY KEY,
    user_id         VARCHAR(50) NOT NULL UNIQUE,
    initial_cash    DECIMAL(15,2) NOT NULL DEFAULT 1000000.00,
    cash            DECIMAL(15,2) NOT NULL DEFAULT 1000000.00,
    invested        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_value     DECIMAL(15,2) NOT NULL DEFAULT 1000000.00,
    total_pnl       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_pnl_pct   DECIMAL(8,4)  NOT NULL DEFAULT 0.00,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_cash_non_negative CHECK (cash >= 0),
    CONSTRAINT chk_initial_positive CHECK (initial_cash > 0)
);

-- 1.2 Paper Positions (Many per portfolio — FK to paper_portfolios)
CREATE TABLE paper_positions (
    id              SERIAL PRIMARY KEY,
    portfolio_id    INTEGER NOT NULL REFERENCES paper_portfolios(id) ON DELETE CASCADE,
    symbol          VARCHAR(20) NOT NULL,
    quantity        INTEGER NOT NULL,
    average_price   DECIMAL(10,2) NOT NULL,
    current_price   DECIMAL(10,2),
    unrealized_pnl  DECIMAL(12,2) DEFAULT 0.00,
    status          VARCHAR(10) NOT NULL DEFAULT 'OPEN',
    opened_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at       TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_pos_qty CHECK (quantity > 0),
    CONSTRAINT chk_pos_avg_price CHECK (average_price > 0),
    CONSTRAINT chk_pos_status CHECK (status IN ('OPEN', 'CLOSED'))
);

-- Allow only ONE open position per (portfolio, symbol)
CREATE UNIQUE INDEX uq_open_position
    ON paper_positions(portfolio_id, symbol) WHERE status = 'OPEN';

-- 1.3 Paper Trade History (Immutable append-only ledger)
CREATE TABLE paper_trade_history (
    id              SERIAL PRIMARY KEY,
    portfolio_id    INTEGER NOT NULL REFERENCES paper_portfolios(id) ON DELETE CASCADE,
    position_id     INTEGER REFERENCES paper_positions(id) ON DELETE SET NULL,
    symbol          VARCHAR(20) NOT NULL,
    trade_type      VARCHAR(4) NOT NULL,
    quantity        INTEGER NOT NULL,
    price           DECIMAL(10,2) NOT NULL,
    total_value     DECIMAL(15,2) NOT NULL,    -- Denormalized: price * quantity for audit trail
    realized_pnl    DECIMAL(12,2),             -- NULL for BUY; computed for SELL
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_trade_type CHECK (trade_type IN ('BUY', 'SELL')),
    CONSTRAINT chk_trade_qty CHECK (quantity > 0),
    CONSTRAINT chk_trade_price CHECK (price > 0),
    CONSTRAINT chk_trade_total CHECK (total_value > 0)
);

-- ============================================================================
-- GROUP 2: AI FEATURES (Normalized, no data duplication)
-- ============================================================================

-- 2.1 AI Conversations (Many messages per session, session groups a chat)
CREATE TABLE ai_conversations (
    id                SERIAL PRIMARY KEY,
    user_id           VARCHAR(50) NOT NULL DEFAULT 'default_user',
    session_id        VARCHAR(100) NOT NULL,
    role              VARCHAR(10) NOT NULL,
    content           TEXT NOT NULL,
    sources           JSONB,
    data_used         JSONB,
    tokens_used       INTEGER DEFAULT 0,
    processing_time_ms INTEGER DEFAULT 0,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_conv_role CHECK (role IN ('user', 'assistant'))
);

-- 2.2 Trade Journal Entries (Links to trade_history for traceability)
CREATE TABLE trade_journal_entries (
    id                SERIAL PRIMARY KEY,
    user_id           VARCHAR(50) NOT NULL DEFAULT 'default_user',
    trade_history_id  INTEGER REFERENCES paper_trade_history(id) ON DELETE SET NULL,
    symbol            VARCHAR(20) NOT NULL,
    trade_type        VARCHAR(4) NOT NULL,
    entry_price       DECIMAL(10,2),
    exit_price        DECIMAL(10,2),
    quantity          INTEGER,
    pnl               DECIMAL(12,2),
    pnl_percent       DECIMAL(8,4),
    setup             VARCHAR(50),
    result            VARCHAR(15),
    day_of_week       VARCHAR(10),
    ai_insight        TEXT,
    entry_date        TIMESTAMP,
    exit_date         TIMESTAMP,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_journal_type CHECK (trade_type IN ('BUY', 'SELL')),
    CONSTRAINT chk_journal_result CHECK (result IS NULL OR result IN ('WIN', 'LOSS', 'BREAKEVEN'))
);

-- 2.3 AI Watchlists (User → many symbols, unique per user+symbol)
CREATE TABLE ai_watchlists (
    id              SERIAL PRIMARY KEY,
    user_id         VARCHAR(50) NOT NULL DEFAULT 'default_user',
    symbol          VARCHAR(20) NOT NULL,
    target_price    DECIMAL(10,2),
    stop_loss       DECIMAL(10,2),
    current_price   DECIMAL(10,2),
    change_percent  DECIMAL(8,4),
    rsi             DECIMAL(6,2),
    signal_status   VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    last_checked    TIMESTAMP,
    notes           TEXT,
    added_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_wl_signal CHECK (signal_status IN ('BULLISH_TRIGGER', 'BEARISH_TRIGGER', 'NO_SIGNAL', 'PENDING')),
    CONSTRAINT uq_user_watchlist_symbol UNIQUE (user_id, symbol)
);

-- 2.4 AI Trade Ideas (Community ideas with voting)
CREATE TABLE ai_trade_ideas (
    id                SERIAL PRIMARY KEY,
    symbol            VARCHAR(20) NOT NULL,
    direction         VARCHAR(10) NOT NULL,
    confidence        INTEGER NOT NULL,
    rationale         TEXT,
    entry_zone        VARCHAR(100),
    target_price      VARCHAR(100),
    stop_loss         VARCHAR(100),
    data_points       JSONB,
    upvotes           INTEGER NOT NULL DEFAULT 0,
    downvotes         INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_idea_dir CHECK (direction IN ('LONG', 'SHORT', 'NEUTRAL')),
    CONSTRAINT chk_idea_conf CHECK (confidence BETWEEN 0 AND 100),
    CONSTRAINT chk_votes_nonneg CHECK (upvotes >= 0 AND downvotes >= 0)
);

-- ============================================================================
-- GROUP 3: ALERTS & MONITORING
-- ============================================================================

-- 3.1 Compound Alerts Configuration
CREATE TABLE compound_alerts (
    id              SERIAL PRIMARY KEY,
    user_id         VARCHAR(50) NOT NULL DEFAULT 'default_user',
    symbol          VARCHAR(20) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    conditions      JSONB NOT NULL,
    logic           VARCHAR(3) NOT NULL DEFAULT 'AND',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_triggered  TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_alert_logic CHECK (logic IN ('AND', 'OR'))
);

-- 3.2 Alert Trigger History (Immutable audit trail — FK to alerts)
CREATE TABLE alert_trigger_history (
    id                  SERIAL PRIMARY KEY,
    alert_id            INTEGER NOT NULL REFERENCES compound_alerts(id) ON DELETE CASCADE,
    evaluation_results  JSONB NOT NULL,
    triggered_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3.3 Trade Cards Archive
CREATE TABLE trade_cards (
    id              SERIAL PRIMARY KEY,
    user_id         VARCHAR(50) NOT NULL DEFAULT 'default_user',
    symbol          VARCHAR(20) NOT NULL,
    card_type       VARCHAR(10) NOT NULL,
    headline        VARCHAR(500),
    metrics         JSONB NOT NULL,
    ai_summary      TEXT,
    share_url       VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_card_type CHECK (card_type IN ('BULLISH', 'BEARISH', 'NEUTRAL'))
);

-- ============================================================================
-- GROUP 4: SYSTEM OPERATIONS
-- ============================================================================

-- 4.1 System Logs (Persistent logging)
CREATE TABLE system_logs (
    id              SERIAL PRIMARY KEY,
    level           VARCHAR(10) NOT NULL,
    service         VARCHAR(100) NOT NULL,
    message         TEXT NOT NULL,
    meta            JSONB,
    request_method  VARCHAR(10),
    request_path    VARCHAR(500),
    response_status INTEGER,
    duration_ms     INTEGER,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_log_lvl CHECK (level IN ('ERROR', 'WARN', 'INFO', 'DEBUG', 'SUCCESS'))
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Group 1: Paper Trading
CREATE INDEX idx_pp_user             ON paper_portfolios(user_id);
CREATE INDEX idx_ppos_portfolio      ON paper_positions(portfolio_id);
CREATE INDEX idx_ppos_open           ON paper_positions(status) WHERE status = 'OPEN';
CREATE INDEX idx_pth_portfolio       ON paper_trade_history(portfolio_id);
CREATE INDEX idx_pth_symbol          ON paper_trade_history(symbol);
CREATE INDEX idx_pth_created         ON paper_trade_history(created_at DESC);

-- Group 2: AI Features
CREATE INDEX idx_aic_session         ON ai_conversations(session_id);
CREATE INDEX idx_aic_user            ON ai_conversations(user_id);
CREATE INDEX idx_aic_created         ON ai_conversations(created_at DESC);
CREATE INDEX idx_tje_user            ON trade_journal_entries(user_id);
CREATE INDEX idx_tje_symbol          ON trade_journal_entries(symbol);
CREATE INDEX idx_wl_user             ON ai_watchlists(user_id);
CREATE INDEX idx_ati_created         ON ai_trade_ideas(created_at DESC);
CREATE INDEX idx_ati_symbol          ON ai_trade_ideas(symbol);

-- Group 3: Alerts
CREATE INDEX idx_ca_user             ON compound_alerts(user_id);
CREATE INDEX idx_ca_active           ON compound_alerts(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_ath_alert           ON alert_trigger_history(alert_id);
CREATE INDEX idx_tc_user             ON trade_cards(user_id);
CREATE INDEX idx_tc_symbol           ON trade_cards(symbol);

-- Group 4: System Logs (partitioned-ready for future scaling)
CREATE INDEX idx_sl_created          ON system_logs(created_at DESC);
CREATE INDEX idx_sl_level            ON system_logs(level);
CREATE INDEX idx_sl_service          ON system_logs(service);

-- ============================================================================
-- SEED: Create default user portfolio
-- ============================================================================
INSERT INTO paper_portfolios (user_id, initial_cash, cash, total_value)
VALUES ('default_user', 1000000.00, 1000000.00, 1000000.00)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
