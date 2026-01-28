-- Migration: Add price analysis columns to selected_stocks table
-- Date: 2025-12-02
-- Description: Adds columns to cache buy initiation status and price ranges after stock selection

-- Add buy_initiated column (boolean flag indicating if buy price was reached after selection)
ALTER TABLE selected_stocks 
ADD COLUMN IF NOT EXISTS buy_initiated BOOLEAN DEFAULT false;

-- Add highest_price_after_selection column (highest price reached after selection date)
ALTER TABLE selected_stocks 
ADD COLUMN IF NOT EXISTS highest_price_after_selection DECIMAL(10,2);

-- Add lowest_price_after_selection column (lowest price reached after selection date)
ALTER TABLE selected_stocks 
ADD COLUMN IF NOT EXISTS lowest_price_after_selection DECIMAL(10,2);

-- Add price_analysis_period column (number of days since selection for analysis)
ALTER TABLE selected_stocks 
ADD COLUMN IF NOT EXISTS price_analysis_period INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN selected_stocks.buy_initiated IS 'Indicates if stock price reached or exceeded entry price after selection date';
COMMENT ON COLUMN selected_stocks.highest_price_after_selection IS 'Highest price reached after stock selection (only set when buy not initiated)';
COMMENT ON COLUMN selected_stocks.lowest_price_after_selection IS 'Lowest price reached after stock selection (only set when buy not initiated)';
COMMENT ON COLUMN selected_stocks.price_analysis_period IS 'Number of days since selection date used for price analysis';

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'selected_stocks' 
AND column_name IN ('buy_initiated', 'highest_price_after_selection', 'lowest_price_after_selection', 'price_analysis_period')
ORDER BY column_name;

