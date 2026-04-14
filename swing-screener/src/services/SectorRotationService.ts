// src/services/SectorRotationService.ts — Tracks money flow across Nifty sectors

import { BaseService } from './BaseService';
import { NseDataService } from './NseDataService';

export interface SectorPerformance {
  sectorName: string;
  currentValue: number;
  change: number;
  changePercent: number;
  advances: number;
  declines: number;
  unchanged: number;
  relativeStrength1D: number; // vs Nifty 50
  momentumState: 'Leading' | 'Weakening' | 'Lagging' | 'Improving';
}

export interface SectorRotationAnalysis {
  timestamp: string;
  benchmark: {
    name: string;
    changePercent: number;
  };
  leadingSectors: SectorPerformance[];
  laggingSectors: SectorPerformance[];
  allSectors: SectorPerformance[];
}

export class SectorRotationService extends BaseService {
  private nseDataService: NseDataService;

  // Major sectoral indices on NSE
  private readonly MAJOR_SECTORS = [
    'NIFTY BANK',
    'NIFTY AUTO',
    'NIFTY FIN SERVICE',
    'NIFTY FMCG',
    'NIFTY IT',
    'NIFTY MEDIA',
    'NIFTY METAL',
    'NIFTY PHARMA',
    'NIFTY PSU BANK',
    'NIFTY REALTY',
    'NIFTY CONSUMPTION',
    'NIFTY ENERGY',
    'NIFTY INFRA'
  ];

  constructor(nseDataService: NseDataService) {
    super('SectorRotationService');
    this.nseDataService = nseDataService;
  }

  /**
   * Generates a snapshot of the current sector rotation map based on live index data
   */
  async getRotationMap(): Promise<SectorRotationAnalysis> {
    try {
      // 1. Fetch live data for all indices
      const indicesData = await this.nseDataService.fetchAdvanceDecline();
      if (!indicesData || !indicesData.data) {
        throw new Error('Failed to fetch indices data from NSE');
      }

      const allData: any[] = indicesData.data;

      // 2. Extract NIFTY 50 as the benchmark
      const benchmarkData = allData.find(idx => idx.indexSymbol === 'NIFTY 50' || idx.index === 'NIFTY 50');
      const benchmarkReturn = benchmarkData ? parseFloat(benchmarkData.percentChange || benchmarkData.pChange || '0') : 0;

      // 3. Process the major sectors
      const sectors: SectorPerformance[] = [];

      for (const sectorName of this.MAJOR_SECTORS) {
        const sectorData = allData.find(idx => idx.indexSymbol === sectorName || idx.index === sectorName);
        if (!sectorData) continue;

        const changePercent = parseFloat(sectorData.percentChange || sectorData.pChange || '0');
        
        // Relative Strength: Sector Return - Benchmark Return
        const relativeStrength1D = Math.round((changePercent - benchmarkReturn) * 100) / 100;

        // Determine Momentum State (Simplified implementation for 1D)
        // Leading = Positive absolute AND Positive Relative
        // Weakening = Positive absolute BUT Negative Relative
        // Lagging = Negative absolute AND Negative Relative
        // Improving = Negative absolute BUT Positive Relative
        let momentumState: SectorPerformance['momentumState'] = 'Lagging';
        if (changePercent > 0 && relativeStrength1D > 0) momentumState = 'Leading';
        if (changePercent > 0 && relativeStrength1D <= 0) momentumState = 'Weakening';
        if (changePercent <= 0 && relativeStrength1D <= 0) momentumState = 'Lagging';
        if (changePercent <= 0 && relativeStrength1D > 0) momentumState = 'Improving';

        sectors.push({
          sectorName,
          currentValue: parseFloat(sectorData.last || sectorData.lastPrice || '0'),
          change: parseFloat(sectorData.change || '0'),
          changePercent,
          advances: parseInt(sectorData.advances || '0', 10),
          declines: parseInt(sectorData.declines || '0', 10),
          unchanged: parseInt(sectorData.unchanged || '0', 10),
          relativeStrength1D,
          momentumState
        });
      }

      // 4. Sort and classify
      sectors.sort((a, b) => b.relativeStrength1D - a.relativeStrength1D);
      const leadingSectors = sectors.filter(s => s.momentumState === 'Leading' || s.momentumState === 'Improving');
      const laggingSectors = sectors.filter(s => s.momentumState === 'Lagging' || s.momentumState === 'Weakening');

      return {
        timestamp: new Date().toISOString(),
        benchmark: {
          name: 'NIFTY 50',
          changePercent: benchmarkReturn,
        },
        leadingSectors,
        laggingSectors,
        allSectors: sectors
      };
    } catch (error) {
      this.logger.error('Error generating Sector Rotation map', error);
      throw error;
    }
  }
}
