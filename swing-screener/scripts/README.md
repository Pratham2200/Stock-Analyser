# Price Analysis Backfill Scripts

This directory contains scripts to backfill price analysis data for existing selected stocks.

## Overview

After running the database migration to add the new price analysis columns (`buy_initiated`, `highest_price_after_selection`, `lowest_price_after_selection`, `price_analysis_period`), you need to populate these columns for existing selected stocks.

## Prerequisites

1. **Run the database migration first:**
   ```bash
   psql -d stock_analysis -f database/migration_add_price_analysis_columns.sql
   ```

2. **Ensure your `.env` file is configured** with database credentials.

## Scripts

### 1. TypeScript Backfill Script (Recommended)

**File:** `backfill-price-analysis.ts`

This script:
- Fetches all selected stocks from the database
- For each stock, fetches price history from Yahoo Finance API
- Calculates:
  - Buy initiation status (if price reached entry price after selection)
  - Highest price after selection
  - Lowest price after selection
  - Analysis period (days since selection)
- Updates the database with calculated values
- Skips stocks that already have valid data

**Usage:**
```bash
npm run backfill:price-analysis
```

**Features:**
- ✅ Fetches real price data from Yahoo Finance
- ✅ Calculates accurate highest/lowest prices
- ✅ Handles errors gracefully
- ✅ Shows progress and summary
- ✅ Skips stocks that already have data
- ✅ Rate limiting protection (500ms delay between stocks)

**Output:**
```
🚀 Starting price analysis backfill...
✅ Database connection established
📊 Fetching all selected stocks...
📈 Found 25 selected stocks to process
[1/25] Processing RELIANCE...
[1/25] RELIANCE: ✅ Updated - buyInitiated=true, high=₹2450.50, low=₹2380.25, period=5 days
...
📊 Backfill Summary:
   ✅ Successfully updated: 20
   ⏭️  Skipped (already has data): 3
   ❌ Errors: 2
   📈 Total processed: 25
✨ Backfill completed!
```

### 2. SQL Update Script (Basic)

**File:** `../database/update_existing_price_analysis.sql`

This is a simple SQL script that:
- Sets default values for `buy_initiated` and `price_analysis_period`
- Calculates analysis period from selection date
- **Note:** Does NOT calculate highest/lowest prices (requires API calls)

**Usage:**
```bash
psql -d stock_analysis -f database/update_existing_price_analysis.sql
```

**Limitations:**
- ❌ Cannot calculate highest/lowest prices (requires API calls)
- ✅ Can set basic defaults quickly
- ✅ Useful for initial setup before running full backfill

## When to Use

### Use TypeScript Backfill Script When:
- ✅ You want accurate highest/lowest prices
- ✅ You have existing selected stocks that need analysis
- ✅ You want to update all stocks at once
- ✅ You have time to wait for API calls (may take several minutes)

### Use SQL Script When:
- ✅ You just want to set basic defaults quickly
- ✅ You'll run the TypeScript script later for accurate data
- ✅ You want to initialize columns before first use

## Troubleshooting

### Script fails with database connection error
- Check your `.env` file has correct database credentials
- Ensure PostgreSQL is running
- Verify database name matches your configuration

### Script fails with API rate limit errors
- The script includes 500ms delays between stocks
- If you have many stocks, it may take time
- Yahoo Finance API has rate limits - if errors persist, wait and retry

### Some stocks show "No price data available"
- Stock symbol might be incorrect
- Stock might be delisted or not available on Yahoo Finance
- Check the symbol format (e.g., "RELIANCE.NS" for NSE stocks)

### Prices are still showing as ₹0.00
- Ensure the migration was run successfully
- Check that the backfill script completed without errors
- Verify the database columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'selected_stocks' AND column_name LIKE '%price%';`

## Next Steps

After running the backfill:
1. ✅ Verify data in database: `SELECT symbol, buy_initiated, highest_price_after_selection, lowest_price_after_selection, price_analysis_period FROM selected_stocks LIMIT 10;`
2. ✅ Check the frontend - prices should now display correctly
3. ✅ Future scans will automatically populate this data

## Notes

- The backfill script respects existing data - it won't overwrite stocks that already have valid analysis
- New stocks selected after the migration will automatically have this data calculated during selection
- The script is idempotent - safe to run multiple times

