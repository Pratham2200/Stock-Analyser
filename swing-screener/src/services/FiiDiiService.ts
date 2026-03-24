// src/services/FiiDiiService.ts - Track FII/DII institutional flows

import { BaseService } from './BaseService';
import { NseDataService } from './NseDataService';

export interface FiiDiiData {
  date: string;
  category: 'FII' | 'DII';
  buyValue: number;
  sellValue: number;
  netValue: number;
}

export interface FlowAnalysis {
  recentData: FiiDiiData[];
  fiiNetTrend: 'bullish' | 'bearish' | 'neutral';
  diiNetTrend: 'bullish' | 'bearish' | 'neutral';
  overallLiquidity: 'positive' | 'negative' | 'neutral';
  fiiNetLast5Days: number;
  diiNetLast5Days: number;
}

export class FiiDiiService extends BaseService {
  private nseData: NseDataService;

  constructor(nseData: NseDataService) {
    super('FiiDiiService');
    this.nseData = nseData;
  }

  /**
   * Note: The NseIndiaApi currently doesn't expose a direct FII/DII endpoint in the python
   * equivalent we translated. For the scope of this implementation, we will stub this
   * using the NseIndiaApi's expected endpoint structure or mock it if the endpoint
   * changes. In production we would fetch from `/api/fiidiiTradeReact`.
   */
  async getRecentFlows(): Promise<FlowAnalysis> {
    try {
      const data = await this.nseData.fetchFiiDiiTrade();
      const flows: FiiDiiData[] = [];
      
      // Parse NSE JSON (Example structure)
      if (data && Array.isArray(data)) {
        for (const item of data) {
          flows.push({
            date: item.date,
            category: item.category,
            buyValue: parseFloat(item.buyValue || '0'),
            sellValue: parseFloat(item.sellValue || '0'),
            netValue: parseFloat(item.netValue || '0'),
          });
        }
      }

      // If NSE API structure doesn't match or fails, fallback to empty
      return this.analyzeFlows(flows);
    } catch (error) {
      this.logger.warn('Could not fetch real FII/DII data, returning empty analysis', error);
      return this.analyzeFlows([]);
    }
  }

  private analyzeFlows(data: FiiDiiData[]): FlowAnalysis {
    if (!data || data.length === 0) {
      return {
        recentData: [],
        fiiNetTrend: 'neutral',
        diiNetTrend: 'neutral',
        overallLiquidity: 'neutral',
        fiiNetLast5Days: 0,
        diiNetLast5Days: 0
      };
    }

    // Sort by date descending
    const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Sum last 5 days
    let fiiNet = 0;
    let diiNet = 0;

    let fiiCount = 0;
    let diiCount = 0;

    for (const row of sorted) {
      if (row.category === 'FII' && fiiCount < 5) {
        fiiNet += row.netValue;
        fiiCount++;
      } else if (row.category === 'DII' && diiCount < 5) {
        diiNet += row.netValue;
        diiCount++;
      }
    }

    const fiiNetTrend = fiiNet > 1500 ? 'bullish' : fiiNet < -1500 ? 'bearish' : 'neutral';
    const diiNetTrend = diiNet > 1500 ? 'bullish' : diiNet < -1500 ? 'bearish' : 'neutral';
    
    const totalLiquidity = fiiNet + diiNet;
    const overallLiquidity = totalLiquidity > 2000 ? 'positive' : totalLiquidity < -2000 ? 'negative' : 'neutral';

    return {
      recentData: sorted.slice(0, 10), // Return last 10 records
      fiiNetTrend,
      diiNetTrend,
      overallLiquidity,
      fiiNetLast5Days: fiiNet,
      diiNetLast5Days: diiNet
    };
  }
}
