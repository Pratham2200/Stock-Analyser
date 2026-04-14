// src/services/InsiderTrackingService.ts — Tracks bulk/block deals and promoter shareholding changes

import { BaseService } from './BaseService';
import { NseDataService } from './NseDataService';

export interface InsiderActivity {
  symbol: string;
  clientName: string;
  dealType: 'BULK' | 'BLOCK' | 'PROMOTER';
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalValue: number; // Value in INR
  date: string;
}

export interface InsiderSummary {
  symbol: string;
  netPromoterBuying: number; // Positive means promoters bought net shares
  recentDeals: InsiderActivity[];
  smartMoneySignal: 'bullish' | 'bearish' | 'neutral'; // Bullish if heavy FII/DII/Promoter BUY
}

export interface NseDeal {
  symbol: string;
  clientName: string;
  buyOrSell: string;
  quantity: number;
  tradePrice: number;
  date: string;
}

export class InsiderTrackingService extends BaseService {
  private nseData: NseDataService;

  constructor(nseData: NseDataService) {
    super('InsiderTrackingService');
    this.nseData = nseData;
  }

  /**
   * Get recent insider activity for a specific symbol
   */
  async getInsiderActivity(symbol: string): Promise<InsiderSummary> {
    const symbolUpper = symbol.toUpperCase();
    const recentDeals: InsiderActivity[] = [];

    // 1. Fetch Bulk Deals
    try {
      const bulkDeals = await this.nseData.fetchBulkDeals();
      const symbolDeals = bulkDeals.filter((d: NseDeal) => d.symbol === symbolUpper);

      for (const d of symbolDeals) {
        recentDeals.push({
          symbol: symbolUpper,
          clientName: d.clientName,
          dealType: 'BULK',
          action: d.buyOrSell.toUpperCase() as 'BUY' | 'SELL',
          quantity: d.quantity,
          price: d.tradePrice,
          totalValue: d.quantity * d.tradePrice,
          date: d.date,
        });
      }
    } catch (error) {
      this.logger.debug(`Could not fetch bulk deals for ${symbolUpper}`);
    }

    // 2. Fetch Block Deals
    try {
      const blockDeals = await this.nseData.fetchBlockDeals();
      const symbolDeals = blockDeals.filter((d: any) => d.symbol === symbolUpper);

      for (const d of symbolDeals) {
        recentDeals.push({
          symbol: symbolUpper,
          clientName: d.clientName,
          dealType: 'BLOCK',
          action: d.buyOrSell.toUpperCase() as 'BUY' | 'SELL',
          quantity: d.quantity,
          price: d.tradePrice,
          totalValue: d.quantity * d.tradePrice,
          date: d.date,
        });
      }
    } catch (error) {
      this.logger.debug(`Could not fetch block deals for ${symbolUpper}`);
    }

    // Sort by date (newest first)
    recentDeals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 3. Aggregate net Smart Money Flow
    let netBuyingValue = 0;
    
    // List of known large institutions / smart money identifiers
    const smartMoneyKeywords = ['FUND', 'CAPITAL', 'INVESTMENT', 'MANAGEMENT', 'SECURITIES', 'TRUST', 'BANK', 'FINANCIAL'];

    for (const deal of recentDeals) {
      const isSmartMoney = smartMoneyKeywords.some(kw => deal.clientName.toUpperCase().includes(kw));
      if (isSmartMoney) {
        if (deal.action === 'BUY') netBuyingValue += deal.totalValue;
        else netBuyingValue -= deal.totalValue;
      }
    }

    let smartMoneySignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    // Threshold: > 10 Cr INR net flow (10,000,000)
    if (netBuyingValue > 100000000) smartMoneySignal = 'bullish';
    else if (netBuyingValue < -100000000) smartMoneySignal = 'bearish';

    return {
      symbol: symbolUpper,
      netPromoterBuying: 0, // In future, wire Shareholding API here
      recentDeals,
      smartMoneySignal,
    };
  }

  /**
   * Get all smart money activity across the market today
   */
  async getMarketWideSmartMoneyFlow(): Promise<{ overallSignal: string, topBuySymbols: string[], topSellSymbols: string[] }> {
    const buyMap = new Map<string, number>();
    const sellMap = new Map<string, number>();

    try {
      const [bulkDeals, blockDeals] = await Promise.all([
        this.nseData.fetchBulkDeals(),
        this.nseData.fetchBlockDeals()
      ]);

      const allDeals = [...bulkDeals, ...blockDeals];
      const smartMoneyKeywords = ['FUND', 'CAPITAL', 'INVESTMENT', 'MANAGEMENT', 'SECURITIES', 'TRUST', 'BANK', 'FINANCIAL'];

      for (const d of allDeals) {
        const isSmartMoney = smartMoneyKeywords.some(kw => d.clientName.toUpperCase().includes(kw));
        if (isSmartMoney) {
          const value = d.quantity * d.tradePrice;
          if (d.buyOrSell.toUpperCase() === 'BUY') {
            buyMap.set(d.symbol, (buyMap.get(d.symbol) || 0) + value);
          } else {
            sellMap.set(d.symbol, (sellMap.get(d.symbol) || 0) + value);
          }
        }
      }

    } catch (error) {
      this.logger.error('Failed to calculate market wide smart money flow', error);
    }

    // Sort to find top buys/sells
    const topBuys = Array.from(buyMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
    const topSells = Array.from(sellMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);

    // Calculate overall flow direction
    const totalBuyValue = Array.from(buyMap.values()).reduce((sum, v) => sum + v, 0);
    const totalSellValue = Array.from(sellMap.values()).reduce((sum, v) => sum + v, 0);
    const netFlow = totalBuyValue - totalSellValue;
    // Threshold: ₹50 Cr net flow (500000000)
    const overallSignal = netFlow > 500000000 ? 'bullish' : netFlow < -500000000 ? 'bearish' : 'neutral';

    return {
      overallSignal,
      topBuySymbols: topBuys,
      topSellSymbols: topSells
    };
  }
}
