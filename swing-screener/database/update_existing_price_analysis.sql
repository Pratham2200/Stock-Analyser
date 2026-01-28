-- Update script: Initialize price analysis columns for existing selected stocks
-- Note: This sets default values. For accurate data, use the backfill script instead.
-- Run this AFTER running the migration: migration_add_price_analysis_columns.sql

-- Set default values for existing records that have NULL values
-- This is a basic initialization - the backfill script will calculate actual values

UPDATE selected_stocks
SET 
  buy_initiated = COALESCE(buy_initiated, false),
  price_analysis_period = COALESCE(
    price_analysis_period,
    GREATEST(1, EXTRACT(DAY FROM (NOW() - COALESCE(
      (SELECT start_time FROM scans WHERE id = selected_stocks.scan_id),
      selected_stocks.created_at
    )))::INTEGER)
  )
WHERE 
  buy_initiated IS NULL 
  OR price_analysis_period IS NULL
  OR price_analysis_period = 0;

-- For highest/lowest prices, we can't calculate from SQL alone (requires API calls)
-- These will remain NULL until the backfill script runs
-- The backfill script will fetch price history and calculate accurate values

-- Show summary of updated records
SELECT 
  COUNT(*) as total_stocks,
  COUNT(CASE WHEN buy_initiated = true THEN 1 END) as buy_initiated_count,
  COUNT(CASE WHEN buy_initiated = false THEN 1 END) as buy_not_initiated_count,
  COUNT(CASE WHEN highest_price_after_selection IS NOT NULL THEN 1 END) as has_highest_price,
  COUNT(CASE WHEN lowest_price_after_selection IS NOT NULL THEN 1 END) as has_lowest_price,
  AVG(price_analysis_period)::INTEGER as avg_analysis_period
FROM selected_stocks;

-- Note: To get accurate highest/lowest prices, run the backfill script:
-- npm run backfill:price-analysis

