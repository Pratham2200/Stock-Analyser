-- Fix target values for existing selected_stocks records
-- This script updates NULL or zero target values based on entry_price

-- Update target1 if NULL or 0
UPDATE selected_stocks ss
SET target1 = ss.entry_price * 1.15
WHERE (ss.target1 IS NULL OR ss.target1 = 0) 
  AND ss.entry_price IS NOT NULL 
  AND ss.entry_price > 0;

-- Update target2 if NULL or 0
UPDATE selected_stocks ss
SET target2 = ss.entry_price * 1.30
WHERE (ss.target2 IS NULL OR ss.target2 = 0) 
  AND ss.entry_price IS NOT NULL 
  AND ss.entry_price > 0;

-- Update target3 if NULL or 0
UPDATE selected_stocks ss
SET target3 = ss.entry_price * 1.50
WHERE (ss.target3 IS NULL OR ss.target3 = 0) 
  AND ss.entry_price IS NOT NULL 
  AND ss.entry_price > 0;

-- Update stop_loss if NULL or 0
UPDATE selected_stocks ss
SET stop_loss = ss.entry_price * 0.95
WHERE (ss.stop_loss IS NULL OR ss.stop_loss = 0) 
  AND ss.entry_price IS NOT NULL 
  AND ss.entry_price > 0;

-- For stocks without entry_price, try to get from stock_analysis table
UPDATE selected_stocks ss
SET 
  entry_price = COALESCE(
    (SELECT sa.current_price FROM stock_analysis sa WHERE sa.stock_id = ss.stock_id LIMIT 1),
    ss.entry_price
  )
WHERE ss.entry_price IS NULL OR ss.entry_price = 0;

-- Then update targets again for newly updated entry prices
UPDATE selected_stocks ss
SET target1 = ss.entry_price * 1.15
WHERE (ss.target1 IS NULL OR ss.target1 = 0) 
  AND ss.entry_price IS NOT NULL 
  AND ss.entry_price > 0;

UPDATE selected_stocks ss
SET target2 = ss.entry_price * 1.30
WHERE (ss.target2 IS NULL OR ss.target2 = 0) 
  AND ss.entry_price IS NOT NULL 
  AND ss.entry_price > 0;

UPDATE selected_stocks ss
SET target3 = ss.entry_price * 1.50
WHERE (ss.target3 IS NULL OR ss.target3 = 0) 
  AND ss.entry_price IS NOT NULL 
  AND ss.entry_price > 0;

UPDATE selected_stocks ss
SET stop_loss = ss.entry_price * 0.95
WHERE (ss.stop_loss IS NULL OR ss.stop_loss = 0) 
  AND ss.entry_price IS NOT NULL 
  AND ss.entry_price > 0;

-- Verify the updates
SELECT 
  COUNT(*) as total_stocks,
  COUNT(CASE WHEN entry_price IS NOT NULL AND entry_price > 0 THEN 1 END) as stocks_with_entry_price,
  COUNT(CASE WHEN target1 IS NOT NULL AND target1 > 0 THEN 1 END) as stocks_with_target1,
  COUNT(CASE WHEN target2 IS NOT NULL AND target2 > 0 THEN 1 END) as stocks_with_target2,
  COUNT(CASE WHEN target3 IS NOT NULL AND target3 > 0 THEN 1 END) as stocks_with_target3,
  COUNT(CASE WHEN stop_loss IS NOT NULL AND stop_loss > 0 THEN 1 END) as stocks_with_stop_loss
FROM selected_stocks;

