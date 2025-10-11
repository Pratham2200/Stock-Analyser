// src/services/ScraperService.ts - Web scraping service

import { BaseService } from './BaseService';
import { ScraperResult, StockData } from '../types';
import * as puppeteer from 'puppeteer';

export class ScraperService extends BaseService {
  private readonly CHARTINK_BASE_URL = 'https://chartink.com/screener/shakeout-reversal?src=wassup';

  constructor() {
    super('ScraperService');
  }

  async scrapeAllStocks(date?: string): Promise<ScraperResult> {
    const startTime = Date.now();
    let browser: puppeteer.Browser | null = null;

    try {
      this.logger.info('Starting stock scraping process...');
      
      browser = await this.launchBrowser();
      const page = await browser.newPage();
      
      await this.setupPage(page);
      await this.navigateToUrl(page, date);
      
      const totalStocks = await this.getTotalStockCount(page);
      this.logger.info(`Total stocks detected: ${totalStocks}`);

      if (totalStocks === 0) {
        return {
          stocks: [],
          totalCount: 0,
          duration: Date.now() - startTime
        };
      }

      const stocks = await this.extractAllStocks(page, totalStocks);
      
      this.logger.info(`Scraping completed! Total unique stocks: ${stocks.length}`);
      
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

  private async navigateToUrl(page: puppeteer.Page, date?: string): Promise<void> {
    let url = this.CHARTINK_BASE_URL;
    if (date) url += `&date=${date}`;

    this.logger.info(`Navigating to: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 120000 
    });

    await page.waitForTimeout(10000);
    this.logger.info('Page loaded, starting stock collection...');
  }

  private async getTotalStockCount(page: puppeteer.Page): Promise<number> {
    return await page.evaluate(() => {
      // Look for text that contains "X stocks" or "X total"
      const allText = document.body.textContent || '';
      
      // Try to find patterns like "50 stocks" or "50 total"
      const patterns = [
        /(\d+)\s+stocks/i,
        /(\d+)\s+total/i,
        /showing.*?(\d+)/i,
        /of\s+(\d+)/i
      ];
      
      for (const pattern of patterns) {
        const match = allText.match(pattern);
        if (match) {
          const count = parseInt(match[1]);
          if (count > 0) {
            return count;
          }
        }
      }
      
      // If no pattern found, count the rows directly
      const rows = document.querySelectorAll('table tbody tr');
      return rows.length;
    });
  }

  private async extractAllStocks(page: puppeteer.Page, totalStocks: number): Promise<StockData[]> {
    const allStocks: StockData[] = [];
    const seenSymbols = new Set<string>();
    let currentPage = 1;
    let maxPages = Math.ceil(totalStocks / 20);
    
    // If we couldn't determine total count, set a reasonable limit
    if (totalStocks === 0 || totalStocks < 20) {
      maxPages = 10; // Process up to 10 pages (200 stocks max)
      this.logger.info('Total count unknown, will process up to 10 pages');
    } else {
      this.logger.info(`Will process ${maxPages} pages`);
    }

    while (currentPage <= maxPages) {
      this.logger.info(`Processing page ${currentPage}/${maxPages}...`);

      const pageStocks = await this.extractPageStocks(page);
      
      // If no stocks found on this page, we've reached the end
      if (pageStocks.length === 0) {
        this.logger.info('No stocks found on this page, stopping pagination');
        break;
      }
      
      // Add unique stocks
      pageStocks.forEach((stock: StockData) => {
        if (!seenSymbols.has(stock.symbol)) {
          seenSymbols.add(stock.symbol);
          allStocks.push(stock);
        }
      });

      this.logger.info(`Page ${currentPage}: Found ${pageStocks.length} stocks, Total unique: ${allStocks.length}`);

      // Navigate to next page if not the last page
      if (currentPage < maxPages) {
        const hasNextPage = await this.navigateToNextPage(page);
        if (!hasNextPage) {
          this.logger.info('No next page available, stopping pagination');
          break;
        }
      }

      currentPage++;
    }

    return allStocks;
  }

  private async extractPageStocks(page: puppeteer.Page): Promise<StockData[]> {
    return await page.evaluate(() => {
      const stocks: StockData[] = [];
      const rows = document.querySelectorAll('table tbody tr');
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          // Based on the table structure:
          // Column 0: Row number
          // Column 1: Company name  
          // Column 2: Stock symbol
          const name = cells[1]?.textContent?.trim() || '';
          const symbol = cells[2]?.textContent?.trim() || '';
          
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
      // Use page.evaluate to find and click the next button
      const success = await page.evaluate(() => {
        // Look for buttons or links containing "Next"
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const nextButton = buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          return text.includes('next') || ariaLabel.includes('next');
        });
        
        if (nextButton && !nextButton.classList.contains('disabled')) {
          (nextButton as HTMLElement).click();
          return true;
        }
        
        return false;
      });
      
      if (success) {
        await page.waitForTimeout(3000);
        await page.waitForNetworkIdle({ timeout: 10000 });
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
