// src/services/ScraperService.ts - Web scraping service

import { BaseService } from './BaseService';
import { ScraperResult, StockData } from '../types';
import * as puppeteer from 'puppeteer';

export class ScraperService extends BaseService {
  // Two scanner URLs as specified by user
  private readonly SCANNER_URLS = [
    'https://chartink.com/screener/shakeout-reversal?src=wassup',
    'https://chartink.com/screener/copy-r2-bear-squeeze-setup-bss-13'
  ];

  constructor() {
    super('ScraperService');
  }

  /**
   * Scrape stocks from all configured URLs and return deduplicated list
   */
  async scrapeFromMultipleUrls(date?: string): Promise<ScraperResult> {
    const startTime = Date.now();
    const allStocks: StockData[] = [];
    const seenSymbols = new Set<string>();

    this.logger.info(`Starting multi-URL scraping from ${this.SCANNER_URLS.length} sources...`);

    for (const url of this.SCANNER_URLS) {
      try {
        this.logger.info(`Scraping from: ${url}`);
        const result = await this.scrapeFromUrl(url, date);

        // Deduplicate stocks
        for (const stock of result.stocks) {
          if (!seenSymbols.has(stock.symbol)) {
            seenSymbols.add(stock.symbol);
            allStocks.push(stock);
          }
        }

        this.logger.info(`Found ${result.stocks.length} stocks from URL, ${allStocks.length} unique total`);
      } catch (error) {
        this.logger.error(`Failed to scrape from ${url}:`, error);
        // Continue with other URLs
      }
    }

    this.logger.info(`Multi-URL scraping completed! Total unique stocks: ${allStocks.length}`);

    return {
      stocks: allStocks,
      totalCount: allStocks.length,
      duration: Date.now() - startTime
    };
  }

  /**
   * Scrape stocks from a single URL (legacy method for backward compatibility)
   */
  async scrapeAllStocks(date?: string): Promise<ScraperResult> {
    return this.scrapeFromUrl(this.SCANNER_URLS[0], date);
  }

  /**
   * Scrape stocks from a specific URL
   */
  private async scrapeFromUrl(baseUrl: string, date?: string): Promise<ScraperResult> {
    const startTime = Date.now();
    let browser: puppeteer.Browser | null = null;

    try {
      this.logger.info('Starting stock scraping process...');

      browser = await this.launchBrowser();
      const page = await browser.newPage();

      await this.setupPage(page);
      await this.navigateToUrl(page, baseUrl, date);

      // Get total count from the page text (e.g., "90 stocks (1 to 20)")
      const totalStocks = await this.getTotalStockCount(page);
      this.logger.info(`Total stocks on page: ${totalStocks}`);

      if (totalStocks === 0) {
        return {
          stocks: [],
          totalCount: 0,
          duration: Date.now() - startTime
        };
      }

      const stocks = await this.extractAllStocks(page, totalStocks);

      this.logger.info(`Scraping completed! Total stocks scraped: ${stocks.length}`);

      return {
        stocks,
        totalCount: stocks.length,
        duration: Date.now() - startTime
      };

    } catch (error) {
      this.handleError(error, 'Stock scraping failed');
      return {
        stocks: [],
        totalCount: 0,
        duration: Date.now() - startTime
      };
    } finally {
      if (browser) {
        await browser.close();
        this.logger.info('Browser closed');
      }
    }
  }

  private async launchBrowser(): Promise<puppeteer.Browser> {
    return await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled'
      ]
    });
  }

  private async setupPage(page: puppeteer.Page): Promise<void> {
    // Set viewport to a common desktop resolution
    await page.setViewport({ width: 1366, height: 768 });
    // Use a realistic user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }

  private async navigateToUrl(page: puppeteer.Page, baseUrl: string, date?: string): Promise<void> {
    let url = baseUrl;
    if (date) url += `&date=${date}`;

    this.logger.info(`Navigating to: ${url}`);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    // Wait for initial page load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to click the "Run Scan" button if it exists (some screeners need this)
    await this.clickRunScanButton(page);

    // Wait for results to load after clicking Run Scan
    await new Promise(resolve => setTimeout(resolve, 8000));

    this.logger.info('Page loaded, starting stock collection...');
  }

  /**
   * Click the "Run Scan" button if present on the page
   */
  private async clickRunScanButton(page: puppeteer.Page): Promise<void> {
    try {
      const clicked = await page.evaluate(() => {
        // Look for "Run Scan" button or span
        const elements = Array.from(document.querySelectorAll('button, span, a'));
        const runScanBtn = elements.find(el => {
          const text = el.textContent?.trim().toLowerCase() || '';
          return text === 'run scan' || text.includes('run scan');
        });

        if (runScanBtn) {
          // Scroll into view and click
          runScanBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (runScanBtn as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (clicked) {
        this.logger.info('Clicked "Run Scan" button');
        // Wait for the scan to complete
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        this.logger.info('No "Run Scan" button found (results may auto-load)');
      }
    } catch (error) {
      this.logger.warn('Could not click Run Scan button:', (error as Error).message);
    }
  }

  /**
   * Get total stock count from page text like "90 stocks (1 to 20)"
   */
  private async getTotalStockCount(page: puppeteer.Page): Promise<number> {
    return await page.evaluate(() => {
      // Look for text containing "X stocks"
      const allText = document.body.textContent || '';

      // Pattern: "90 stocks" or "185 stocks"
      const match = allText.match(/(\d+)\s+stocks/i);
      if (match) {
        return parseInt(match[1], 10);
      }

      // Fallback: count rows in the table
      const tables = document.querySelectorAll('table');
      const stockTable = tables.length > 1 ? tables[1] : tables[0];
      if (stockTable) {
        const rows = stockTable.querySelectorAll('tbody tr');
        return rows.length;
      }

      return 0;
    });
  }

  /**
   * Extract all stocks by paginating through all pages
   */
  private async extractAllStocks(page: puppeteer.Page, totalStocks: number): Promise<StockData[]> {
    const allStocks: StockData[] = [];
    const seenSymbols = new Set<string>();
    let currentPage = 1;

    // Calculate max pages: 20 stocks per page
    const maxPages = Math.ceil(totalStocks / 20);
    this.logger.info(`Will process up to ${maxPages} pages for ${totalStocks} stocks`);

    while (currentPage <= maxPages) {
      this.logger.info(`Processing page ${currentPage}/${maxPages}...`);

      const pageStocks = await this.extractPageStocks(page);

      // Add unique stocks
      let newCount = 0;
      for (const stock of pageStocks) {
        if (!seenSymbols.has(stock.symbol)) {
          seenSymbols.add(stock.symbol);
          allStocks.push(stock);
          newCount++;
        }
      }

      this.logger.info(`Page ${currentPage}: Found ${pageStocks.length} stocks, ${newCount} new, Total: ${allStocks.length}`);

      // If we've collected all stocks, stop
      if (allStocks.length >= totalStocks) {
        this.logger.info(`Collected all ${totalStocks} stocks, stopping`);
        break;
      }

      // If this is the last page, stop
      if (currentPage >= maxPages) {
        this.logger.info('Reached last page');
        break;
      }

      // Navigate to next page
      const hasNextPage = await this.navigateToNextPage(page);
      if (!hasNextPage) {
        this.logger.info('No next page available, stopping');
        break;
      }

      currentPage++;
    }

    return allStocks;
  }

  private async extractPageStocks(page: puppeteer.Page): Promise<StockData[]> {
    return await page.evaluate(() => {
      const stocks: StockData[] = [];

      // Chartink has multiple tables - stock data is in the SECOND table (index 1)
      const tables = document.querySelectorAll('table');
      const stockTable = tables.length > 1 ? tables[1] : tables[0];

      if (!stockTable) return stocks;

      const rows = stockTable.querySelectorAll('tbody tr');

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          // Chartink table structure:
          // Column 0 (index 0): Serial Number (Sr.)
          // Column 1 (index 1): Stock Name (inside <a> tag)
          // Column 2 (index 2): Symbol (inside <a> tag)

          // Get name from column 1 - may be in an <a> tag
          const nameCell = cells[1];
          const nameLink = nameCell?.querySelector('a');
          const name = (nameLink?.textContent || nameCell?.textContent || '').trim();

          // Get symbol from column 2 - may be in an <a> tag
          const symbolCell = cells[2];
          const symbolLink = symbolCell?.querySelector('a');
          const symbol = (symbolLink?.textContent || symbolCell?.textContent || '').trim();

          if (symbol && name) {
            stocks.push({ symbol, name });
          }
        }
      });

      return stocks;
    });
  }

  private async navigateToNextPage(page: puppeteer.Page): Promise<boolean> {
    try {
      // Find and click the Next button
      const success = await page.evaluate(() => {
        // Look for buttons containing "Next" text
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextButton = buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          return text.includes('next');
        });

        if (nextButton) {
          // Check if the button is disabled
          const isDisabled = nextButton.disabled ||
            nextButton.classList.contains('disabled') ||
            nextButton.getAttribute('disabled') !== null;

          if (!isDisabled) {
            nextButton.click();
            return true;
          }
        }

        return false;
      });

      if (success) {
        // Wait for the page content to update
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Wait for network to settle
        try {
          await page.waitForNetworkIdle({ timeout: 5000 });
        } catch (e) {
          // Ignore timeout, table might have already updated
        }

        // Additional wait for DOM to update
        await new Promise(resolve => setTimeout(resolve, 1000));

        return true;
      } else {
        this.logger.warn('Next button not found or disabled');
        return false;
      }
    } catch (error) {
      this.logger.error('Error navigating to next page:', (error as Error).message);
      return false;
    }
  }
}
