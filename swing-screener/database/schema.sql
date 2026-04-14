-- Database schema for Stock Analysis Pro
-- Updated to match StockRepository.ts usage perfectly

-- 1. Scans Table
CREATE TABLE IF NOT EXISTS scans (
    id SERIAL PRIMARY KEY,
    scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_stocks_scraped INTEGER,
    stocks_analyzed INTEGER,
    stocks_passed INTEGER,
    scan_duration_seconds INTEGER
);

-- 2. Stocks Table (All scraped stocks)
CREATE TABLE IF NOT EXISTS stocks (
    id SERIAL PRIMARY KEY,
    scan_id INTEGER REFERENCES scans(id),
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.1. Stock Daily Bars (Historical OHLCV + Calculated Indicators)
CREATE TABLE IF NOT EXISTS stock_daily_bars (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
    date TIMESTAMP NOT NULL,
    open DECIMAL(10,2),
    high DECIMAL(10,2),
    low DECIMAL(10,2),
    close DECIMAL(10,2),
    adjclose DECIMAL(10,2),
    volume BIGINT,
    ema10 DECIMAL(10,2),
    ema20 DECIMAL(10,2),
    volume_20bar_avg BIGINT,
    volume_ratio DECIMAL(6,2),
    UNIQUE(stock_id, date)
);

-- 2.2. Stock Metadata (Yahoo Finance Quote Data)
CREATE TABLE IF NOT EXISTS stock_metadata (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
    scan_id INTEGER REFERENCES scans(id),
    
    -- 52-week data
    fifty_two_week_low DECIMAL(10,2),
    fifty_two_week_high DECIMAL(10,2),
    
    -- Moving averages
    fifty_day_average DECIMAL(10,2),
    two_hundred_day_average DECIMAL(10,2),
    
    -- Volume metrics
    avg_volume_3month BIGINT,
    avg_volume_10day BIGINT,
    
    -- Valuation metrics
    market_cap BIGINT,
    trailing_pe DECIMAL(8,2),
    price_to_book DECIMAL(8,2),
    eps_trailing_twelve_months DECIMAL(8,2),
    
    -- Company info
    currency VARCHAR(10),
    exchange VARCHAR(20),
    long_name VARCHAR(255),
    market_state VARCHAR(20),
    
    -- Full API response (for future use)
    raw_quote_data JSONB,
    raw_chart_meta JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stock_id, scan_id)
);

-- 2.3. Stock Zones (Consolidation Zone Analysis)
CREATE TABLE IF NOT EXISTS stock_zones (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
    scan_id INTEGER REFERENCES scans(id),
    zone_number INTEGER,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    zone_low DECIMAL(10,2),
    bar_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Stock Analysis Table (Technical analysis results)
CREATE TABLE IF NOT EXISTS stock_analysis (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    scan_id INTEGER REFERENCES scans(id),
    qualified BOOLEAN DEFAULT FALSE,
    fail_step INTEGER DEFAULT 0,
    fail_reason TEXT,
    current_price DECIMAL(10,2),
    ema10 DECIMAL(10,2),
    ema20 DECIMAL(10,2),
    strategy_details JSONB,
    analysis_duration_ms INTEGER,
    data_points_daily INTEGER,
    data_points_intraday INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Selected Stocks Table (Qualified stocks with trade params)
CREATE TABLE IF NOT EXISTS selected_stocks (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    scan_id INTEGER REFERENCES scans(id),
    entry_price DECIMAL(10,2),
    stop_loss DECIMAL(10,2),
    target_1 DECIMAL(10,2),
    target_2 DECIMAL(10,2),
    target_3 DECIMAL(10,2),
    position_size INTEGER,
    position_value DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Portfolio Positions (For future portfolio management)
CREATE TABLE IF NOT EXISTS portfolio_positions (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    entry_price DECIMAL(10,2),
    current_price DECIMAL(10,2),
    quantity INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Stock Performance (For historical tracking if needed later)
CREATE TABLE IF NOT EXISTS stock_performance (
    id SERIAL PRIMARY KEY,
    selected_stock_id INTEGER REFERENCES selected_stocks(id),
    entry_date DATE NOT NULL,
    entry_price DECIMAL(10,2),
    current_price DECIMAL(10,2),
    highest_price DECIMAL(10,2),
    lowest_price DECIMAL(10,2),
    change_percent DECIMAL(8,4),
    t1_reached BOOLEAN DEFAULT FALSE,
    t2_reached BOOLEAN DEFAULT FALSE,
    t3_reached BOOLEAN DEFAULT FALSE,
    stoploss_hit BOOLEAN DEFAULT FALSE,
    trailing_stoploss DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stocks_scan_id ON stocks(scan_id);
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_analysis_stock_id ON stock_analysis(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_analysis_scan_id ON stock_analysis(scan_id);
CREATE INDEX IF NOT EXISTS idx_selected_stocks_scan_id ON selected_stocks(scan_id);

-- ==========================================
-- PHASE D: Premium Feature Persistence
-- ==========================================

-- 7. System Logs (Phase D)
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    service VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    meta JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Paper Trading Portfolios (Phase 13)
CREATE TABLE IF NOT EXISTS paper_portfolios (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) DEFAULT 'default_user',
    cash DECIMAL(15,2) DEFAULT 1000000.00,
    total_value DECIMAL(15,2) DEFAULT 1000000.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Paper Trading Positions (Phase 13)
CREATE TABLE IF NOT EXISTS paper_positions (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES paper_portfolios(id),
    symbol VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    average_price DECIMAL(10,2) NOT NULL,
    current_price DECIMAL(10,2),
    pnl DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portfolio_id, symbol)
);

-- 10. Paper Trade History (Phase 13)
CREATE TABLE IF NOT EXISTS paper_trade_history (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES paper_portfolios(id),
    symbol VARCHAR(20) NOT NULL,
    type VARCHAR(10) NOT NULL, -- 'BUY' or 'SELL'
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. AI Trade Journal (Phase 9)
CREATE TABLE IF NOT EXISTS trade_journals (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) DEFAULT 'default_user',
    symbol VARCHAR(20) NOT NULL,
    type VARCHAR(10) NOT NULL,
    pnl DECIMAL(12,2),
    ai_insight TEXT,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. AI Watchlist (Phase 20)
CREATE TABLE IF NOT EXISTS ai_watchlists (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) DEFAULT 'default_user',
    symbol VARCHAR(20) NOT NULL,
    target_price DECIMAL(10,2),
    stop_loss DECIMAL(10,2),
    notes TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. AI Trade Ideas (Phase 21)
CREATE TABLE IF NOT EXISTS ai_trade_ideas (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    bias VARCHAR(20),
    timeframe VARCHAR(20),
    rationale TEXT,
    conviction_score INTEGER,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);