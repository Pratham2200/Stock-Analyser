// src/routes/leaderboardRoutes.ts — REST API for Paper Trading Leaderboard

import { Router, Request, Response } from 'express';
import { LeaderboardService } from '../services/LeaderboardService';

export function createLeaderboardRoutes(leaderboardService: LeaderboardService): Router {
  const router = Router();

  // GET /api/leaderboard — Get top traders
  router.get('/', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await leaderboardService.getLeaderboard(limit);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
