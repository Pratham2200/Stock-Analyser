-- Price tracking schema for selected stocks
-- Stores daily price data for selected stocks from their selection date onwards

CREATE TABLE IF NOT EXISTS selected_stock_price_tracking (
    id SERIAL PRIMARY KEY,
    selected_stock_id INTEGER REFERENCES selected_stocks(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    price_date DATE NOT NULL,
    open_price DECIMAL(10,2),
    high_price DECIMAL(10,2),
    low_price DECIMAL(10,2),
    close_price DECIMAL(10,2),
    volume BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(selected_stock_id, price_date)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_price_tracking_selected_stock_id ON selected_stock_price_tracking(selected_stock_id);
CREATE INDEX IF NOT EXISTS idx_price_tracking_symbol ON selected_stock_price_tracking(symbol);
CREATE INDEX IF NOT EXISTS idx_price_tracking_date ON selected_stock_price_tracking(price_date);
CREATE INDEX IF NOT EXISTS idx_price_tracking_symbol_date ON selected_stock_price_tracking(symbol, price_date);

-- Table to track which targets/stoploss have been hit
CREATE TABLE IF NOT EXISTS selected_stock_targets_hit (
    id SERIAL PRIMARY KEY,
    selected_stock_id INTEGER REFERENCES selected_stocks(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    target_type VARCHAR(20) NOT NULL, -- 'target1', 'target2', 'target3', 'stoploss'
    hit_date DATE NOT NULL,
    hit_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(selected_stock_id, target_type)
);

-- Indexes for targets hit
CREATE INDEX IF NOT EXISTS idx_targets_hit_selected_stock_id ON selected_stock_targets_hit(selected_stock_id);
CREATE INDEX IF NOT EXISTS idx_targets_hit_symbol ON selected_stock_targets_hit(symbol);
CREATE INDEX IF NOT EXISTS idx_targets_hit_date ON selected_stock_targets_hit(hit_date);

