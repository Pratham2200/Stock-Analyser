// src/services/LeaderboardService.ts — Paper Trading Leaderboard with ranking
// PHASE D: Directly queries PostgreSQL for rankings

import { Pool } from 'pg';
import { BaseService } from './BaseService';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  totalPnl: number;
  totalPnlPercent: number;
  totalTrades: number;
  winRate: number;
  currentValue: number;
}

export interface LeaderboardData {
  timestamp: string;
  topTraders: LeaderboardEntry[];
  totalParticipants: number;
}

export class LeaderboardService extends BaseService {
  private pool: Pool;

  constructor(pool: Pool) {
    super('LeaderboardService');
    this.pool = pool;
  }

  async getLeaderboard(limit: number = 20): Promise<LeaderboardData> {
    // Single efficient SQL query with aggregation — no N+1 problem
    const res = await this.pool.query(
      `SELECT
         pp.user_id,
         pp.total_pnl,
         pp.total_pnl_pct,
         pp.total_value,
         COUNT(pth.id) FILTER (WHERE pth.trade_type = 'SELL') as total_trades,
         COUNT(pth.id) FILTER (WHERE pth.trade_type = 'SELL' AND pth.realized_pnl > 0) as winning_trades
       FROM paper_portfolios pp
       LEFT JOIN paper_trade_history pth ON pp.id = pth.portfolio_id
       GROUP BY pp.id, pp.user_id, pp.total_pnl, pp.total_pnl_pct, pp.total_value
       ORDER BY pp.total_pnl_pct DESC
       LIMIT $1`,
      [limit]
    );

    const entries: LeaderboardEntry[] = res.rows.map((row: any, idx: number) => {
      const totalTrades = parseInt(row.total_trades) || 0;
      const winningTrades = parseInt(row.winning_trades) || 0;
      return {
        rank: idx + 1,
        userId: row.user_id,
        totalPnl: Math.round(parseFloat(row.total_pnl) * 100) / 100,
        totalPnlPercent: Math.round(parseFloat(row.total_pnl_pct) * 100) / 100,
        totalTrades,
        winRate: totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0,
        currentValue: Math.round(parseFloat(row.total_value) * 100) / 100,
      };
    });

    // Get total count
    const countRes = await this.pool.query('SELECT COUNT(*) FROM paper_portfolios');

    return {
      timestamp: new Date().toISOString(),
      topTraders: entries,
      totalParticipants: parseInt(countRes.rows[0].count) || 0,
    };
  }
}
