-- Database schema for Stock Analysis Pro

-- Create database if not exists
-- CREATE DATABASE stock_analysis;

-- Create tables
CREATE TABLE IF NOT EXISTS scans (
    id SERIAL PRIMARY KEY,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    total_stocks INTEGER DEFAULT 0,
    qualified_stocks INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'running',
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS stocks (
    id SERIAL PRIMARY KEY,
    scan_id INTEGER REFERENCES scans(id),
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    current_price DECIMAL(10,2),
    market_cap BIGINT,
    volume BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_analysis (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    scan_id INTEGER REFERENCES scans(id),
    qualified BOOLEAN DEFAULT FALSE,
    score DECIMAL(5,2) DEFAULT 0,
    failed_at INTEGER DEFAULT 0,
    reason TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS selected_stocks (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    scan_id INTEGER REFERENCES scans(id),
    entry_price DECIMAL(10,2),
    stop_loss DECIMAL(10,2),
    target1 DECIMAL(10,2),
    target2 DECIMAL(10,2),
    target3 DECIMAL(10,2),
    position_size INTEGER,
    position_value DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stocks_scan_id ON stocks(scan_id);
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_analysis_stock_id ON stock_analysis(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_analysis_scan_id ON stock_analysis(scan_id);
CREATE INDEX IF NOT EXISTS idx_selected_stocks_stock_id ON selected_stocks(stock_id);
CREATE INDEX IF NOT EXISTS idx_selected_stocks_scan_id ON selected_stocks(scan_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_positions_symbol ON portfolio_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_portfolio_positions_status ON portfolio_positions(status);