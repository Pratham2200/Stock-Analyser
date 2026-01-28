#!/usr/bin/env node
// scripts/backfill-price-analysis.ts - Backfill price analysis data for existing selected stocks

import { Pool } from 'pg';
import { createDatabaseConnection } from '../src/database/connection';
import { createConfig } from '../src/config';
import { StockRepository } from '../src/repositories/StockRepository';
import { StockDataService } from '../src/services/StockDataService';
import { Logger } from '../src/utils/logger-enhanced';

const logger = new Logger('BackfillPriceAnalysis');

interface SelectedStock {
  selected_stock_id: string;
  symbol: string;
  entry_price: number;
  scan_date: string;
  buy_initiated: boolean | null;
  highest_price_after_selection: number | null;
  lowest_price_after_selection: number | null;
  price_analysis_period: number | null;
}

async function backfillPriceAnalysis(): Promise<void> {
  let pool: Pool | null = null;

  try {
    logger.info('🚀 Starting price analysis backfill...');

    // Initialize database connection
    const config = createConfig();
    pool = createDatabaseConnection(config.database);

    // Test connection
    await pool.query('SELECT 1');
    logger.info('✅ Database connection established');

    // Initialize repositories and services
    const stockRepository = new StockRepository(pool);
    const stockDataService = new StockDataService();

    // Get all selected stocks
    logger.info('📊 Fetching all selected stocks...');
    const selectedStocks = await stockRepository.getSelectedStocks();
    
    if (selectedStocks.length === 0) {
      logger.info('ℹ️  No selected stocks found. Nothing to update.');
      return;
    }

    logger.info(`📈 Found ${selectedStocks.length} selected stocks to process`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each stock
    for (let i = 0; i < selectedStocks.length; i++) {
      const stock = selectedStocks[i] as SelectedStock;
      const progress = `[${i + 1}/${selectedStocks.length}]`;

      try {
        // Skip if already has valid data
        if (
          stock.buy_initiated !== null &&
          stock.highest_price_after_selection !== null &&
          stock.lowest_price_after_selection !== null &&
          stock.price_analysis_period !== null &&
          stock.price_analysis_period > 0
        ) {
          logger.debug(`${progress} ${stock.symbol}: Already has analysis data, skipping`);
          skippedCount++;
          continue;
        }

        logger.info(`${progress} Processing ${stock.symbol}...`);

        // Get selection date
        const selectionDate = new Date(stock.scan_date);
        selectionDate.setHours(0, 0, 0, 0);
        const selectionDateStr = selectionDate.toISOString().split('T')[0];

        // Calculate days since selection
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((todayDate.getTime() - selectionDate.getTime()) / (1000 * 60 * 60 * 24));
        const priceAnalysisPeriod = Math.max(1, daysDiff);

        // Fetch price history (fetch more days to ensure we have data)
        const daysToFetch = Math.min(priceAnalysisPeriod + 30, 365);
        logger.debug(`${progress} ${stock.symbol}: Fetching ${daysToFetch} days of price history...`);

        const dailyBars = await stockDataService.fetchDailyBars(stock.symbol, daysToFetch);

        if (!dailyBars || dailyBars.length === 0) {
          logger.warn(`${progress} ${stock.symbol}: No price data available, using fallback values`);
          
          // Use fallback: get current price
          try {
            const currentPrice = await stockDataService.fetchCurrentPrice(stock.symbol);
            if (currentPrice === null) {
              logger.warn(`${progress} ${stock.symbol}: Could not fetch current price, using entry price as fallback`);
              const buyInitiated = false;
              await updateStockAnalysis(
                pool,
                stock.selected_stock_id,
                buyInitiated,
                stock.entry_price,
                stock.entry_price,
                priceAnalysisPeriod
              );
            } else {
              const buyInitiated = currentPrice >= stock.entry_price;
              await updateStockAnalysis(
                pool,
                stock.selected_stock_id,
                buyInitiated,
                currentPrice,
                currentPrice,
                priceAnalysisPeriod
              );
            }
            
            logger.info(`${progress} ${stock.symbol}: Updated with fallback data (current price)`);
            successCount++;
          } catch (priceError) {
            logger.error(`${progress} ${stock.symbol}: Failed to get current price:`, priceError);
            errorCount++;
          }
          continue;
        }

        // Filter prices AFTER selection date (including selection day)
        const pricesAfterSelection = dailyBars.filter(bar => {
          const barDateStr = typeof bar.date === 'string' 
            ? bar.date.split('T')[0] 
            : new Date(bar.date).toISOString().split('T')[0];
          return barDateStr >= selectionDateStr;
        });

        if (pricesAfterSelection.length === 0) {
          logger.warn(`${progress} ${stock.symbol}: No prices after selection date, using fallback`);
          
          // Use last available price or current price
          const lastBar = dailyBars[dailyBars.length - 1];
          const fallbackPrice = lastBar ? lastBar.close : stock.entry_price;
          const buyInitiated = fallbackPrice >= stock.entry_price;
          
          await updateStockAnalysis(
            pool,
            stock.selected_stock_id,
            buyInitiated,
            fallbackPrice,
            fallbackPrice,
            priceAnalysisPeriod
          );
          
          logger.info(`${progress} ${stock.symbol}: Updated with fallback data`);
          successCount++;
          continue;
        }

        // Check if buy was initiated (any price >= entry price)
        const buyInitiated = pricesAfterSelection.some(bar => 
          bar.high >= stock.entry_price || bar.close >= stock.entry_price
        );

        // Calculate highest and lowest prices after selection
        const allPrices = pricesAfterSelection.flatMap(bar => [bar.high, bar.low, bar.close, bar.open]);
        const highestPriceAfterSelection = Math.max(...allPrices);
        const lowestPriceAfterSelection = Math.min(...allPrices);

        // Update database
        await updateStockAnalysis(
          pool,
          stock.selected_stock_id,
          buyInitiated,
          highestPriceAfterSelection,
          lowestPriceAfterSelection,
          priceAnalysisPeriod
        );

        logger.info(
          `${progress} ${stock.symbol}: ✅ Updated - ` +
          `buyInitiated=${buyInitiated}, ` +
          `high=₹${highestPriceAfterSelection.toFixed(2)}, ` +
          `low=₹${lowestPriceAfterSelection.toFixed(2)}, ` +
          `period=${priceAnalysisPeriod} days`
        );

        successCount++;

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        logger.error(`${progress} ${stock.symbol}: ❌ Error processing:`, error);
        errorCount++;
      }
    }

    // Summary
    logger.info('\n📊 Backfill Summary:');
    logger.info(`   ✅ Successfully updated: ${successCount}`);
    logger.info(`   ⏭️  Skipped (already has data): ${skippedCount}`);
    logger.info(`   ❌ Errors: ${errorCount}`);
    logger.info(`   📈 Total processed: ${selectedStocks.length}`);

    logger.info('\n✨ Backfill completed!');

  } catch (error) {
    logger.error('💥 Fatal error during backfill:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
      logger.info('🔌 Database connection closed');
    }
  }
}

async function updateStockAnalysis(
  pool: Pool,
  selectedStockId: string,
  buyInitiated: boolean,
  highestPrice: number,
  lowestPrice: number,
  period: number
): Promise<void> {
  const query = `
    UPDATE selected_stocks
    SET 
      buy_initiated = $1,
      highest_price_after_selection = $2,
      lowest_price_after_selection = $3,
      price_analysis_period = $4
    WHERE id = $5
  `;

  await pool.query(query, [
    buyInitiated,
    highestPrice,
    lowestPrice,
    period,
    selectedStockId
  ]);
}

// Run the script
if (require.main === module) {
  backfillPriceAnalysis()
    .then(() => {
      logger.info('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { backfillPriceAnalysis };

