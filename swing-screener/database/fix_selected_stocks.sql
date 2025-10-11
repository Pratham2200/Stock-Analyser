-- Fix selected_stocks table schema
-- Add missing columns if they don't exist

-- Add target columns if they don't exist
ALTER TABLE selected_stocks 
ADD COLUMN IF NOT EXISTS target1 DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS target2 DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS target3 DECIMAL(10,2);

-- Add other missing columns that might be needed
ALTER TABLE selected_stocks 
ADD COLUMN IF NOT EXISTS entry_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS stop_loss DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS position_size INTEGER,
ADD COLUMN IF NOT EXISTS position_value DECIMAL(12,2);

-- Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'selected_stocks' 
ORDER BY ordinal_position;
