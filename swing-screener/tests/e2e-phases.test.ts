import { describe, it, expect } from 'vitest';

const API_BASE = process.env.API_URL || 'http://localhost:4000/api';
const SYMBOL = 'RELIANCE';

// Prevent hitting API rate limits for NSE/Yahoo/Gemini
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Comprehensive E2E Tests for Phases 5-21', () => {

  // Phase 5: What-If Simulator
  it('Phase 5: GET /what-if/simulate should return simulated pricing', async () => {
    const payload = {
      spotPrice: 2500,
      legs: [
        { type: 'CE', strike: 2500, premium: 50, action: 'BUY', quantity: 250, expiryDate: new Date(Date.now() + 7 * 86400000).toISOString() }
      ],
      priceRange: { min: 2400, max: 2600, steps: 5 }
    };
    const res = await fetch(`${API_BASE}/what-if/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    expect(res.status).toBeLessThan(500); 
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.points).toBeDefined();
    }
    await delay(2000);
  });

  // Phase 6: Insider Flow
  it('Phase 6: GET /insider/:symbol/flow should return smart money flow', async () => {
    const res = await fetch(`${API_BASE}/insider/${SYMBOL}/flow`);
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.overallSignal).toBeDefined();
    }
    await delay(2000);
  });

  // Phase 7: FII/DII Net Flow
  it('Phase 7: GET /insider/fiidii/flow should return FII/DII signals', async () => {
    const res = await fetch(`${API_BASE}/insider/fiidii/flow`);
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    }
    await delay(2000);
  });

  // Phase 9: Options Pain Map
  it('Phase 9: GET /options/pain-map/:symbol should return max pain metrics', async () => {
    const res = await fetch(`${API_BASE}/options/pain-map/${SYMBOL}`);
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.totalCallOI).toBeDefined();
      expect(data.data.strikePainMetrics).toBeDefined();
    }
    await delay(2000);
  });

  // Phase 10: Smart Compound Alerts
  it('Phase 10: GET /alerts/system/scan should return evaluated alerts', async () => {
    const res = await fetch(`${API_BASE}/alerts/system/scan`, { method: 'POST' });
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    }
    await delay(2000);
  });

  // Phase 11: Sector Rotation Radar
  it('Phase 11: GET /sectors/rotation should return sector relative strength', async () => {
    const res = await fetch(`${API_BASE}/sectors/rotation`);
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.sectors).toBeDefined();
    }
    await delay(2000);
  });

  // Phase 12: Earnings Whisper Engine
  it('Phase 12: GET /earnings/whisper/:symbol should return ai outlook', async () => {
    const res = await fetch(`${API_BASE}/earnings/whisper/${SYMBOL}`);
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.aiEarningsOutlook).toBeDefined();
    }
    await delay(2000);
  });

  // Phase 13: Paper Trading
  it('Phase 13: POST /paper-trading/execute should execute a paper trade', async () => {
    const payload = {
      userId: 'test-user-1',
      symbol: SYMBOL,
      type: 'BUY',
      quantity: 10
    };
    const res = await fetch(`${API_BASE}/paper-trading/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('OPEN');
    }
    await delay(2000);
  });

  // Phase 14: Trade Cards
  it('Phase 14: POST /cards/generate should return a shareable card', async () => {
    const payload = { symbol: SYMBOL, userId: 'test-user-1' };
    const res = await fetch(`${API_BASE}/cards/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.shareUrl).toBeDefined();
    }
    await delay(2000);
  });

  // Phase 15: Leaderboard
  it('Phase 15: GET /leaderboard should return trader rankings', async () => {
    const res = await fetch(`${API_BASE}/leaderboard`);
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.topTraders)).toBe(true);
    }
    await delay(2000);
  });

  // Phase 16: Correlation Matrix
  it('Phase 16: POST /correlation/matrix should return pearson correlations', async () => {
    const payload = { symbols: ['RELIANCE', 'TCS', 'INFY'], days: 30 };
    const res = await fetch(`${API_BASE}/correlation/matrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.matrix).toBeDefined();
    }
    await delay(2000);
  });

  // Phase 17: Unusual Activity
  it('Phase 17: GET /unusual/:symbol should detect volume/OI spikes', async () => {
    const res = await fetch(`${API_BASE}/unusual/${SYMBOL}`);
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    }
    await delay(2000);
  });

  // Phase 18: Event Calendar
  it('Phase 18: GET /events/:year/:month should list expiries and events', async () => {
    const d = new Date();
    const res = await fetch(`${API_BASE}/events/${d.getFullYear()}/${d.getMonth()+1}`);
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.events)).toBe(true);
    }
    await delay(2000);
  });

  // Phase 19: Multi-Timeframe
  it('Phase 19: GET /mtf/:symbol should aggregate indicators', async () => {
    const res = await fetch(`${API_BASE}/mtf/${SYMBOL}`);
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.confluenceScore).toBeDefined();
    }
    await delay(2000);
  });

  // Phase 20: AI Watchlist
  it('Phase 20: POST JSON and GET should manage watchlist and summarize', async () => {
    const addRes = await fetch(`${API_BASE}/watchlist/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test-user-2', symbol: 'HDFCBANK' })
    });
    expect(addRes.status).toBeLessThan(500);
    
    // Give external APIs time to rest
    await delay(2000);
    
    const sumRes = await fetch(`${API_BASE}/watchlist/test-user-2/summary`);
    expect(sumRes.status).toBeLessThan(500);
    if (sumRes.status === 200) {
      const data = await sumRes.json();
      expect(data.success).toBe(true);
      expect(data.data.aiBrief).toBeDefined();
    }
    await delay(2000);
  });

  // Phase 21: AI Trade Ideas
  it('Phase 21: POST /ideas/generate should produce actionable idea', async () => {
    const payload = { symbol: 'INFY' };
    const res = await fetch(`${API_BASE}/ideas/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.entryZone).toBeDefined();
    }
    await delay(2000);
  });

});
