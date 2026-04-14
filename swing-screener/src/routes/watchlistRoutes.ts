// src/routes/watchlistRoutes.ts

import { Router, Request, Response } from 'express';
import { WatchlistService } from '../services/WatchlistService';

export function createWatchlistRoutes(watchlistService: WatchlistService): Router {
  const router = Router();

  // POST /api/watchlist/add
  router.post('/add', (req: Request, res: Response) => {
    try {
      const { userId, symbol } = req.body;
      if (!symbol) { res.status(400).json({ success: false, error: 'Required: symbol' }); return; }
      const entry = watchlistService.addStock(userId || 'default', symbol);
      res.json({ success: true, data: entry });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/watchlist/:userId/:symbol
  router.delete('/:userId/:symbol', (req: Request, res: Response) => {
    const removed = watchlistService.removeStock(req.params.userId, req.params.symbol);
    res.json({ success: true, removed });
  });

  // GET /api/watchlist/:userId/summary
  router.get('/:userId/summary', async (req: Request, res: Response) => {
    try {
      const result = await watchlistService.getDailySummary(req.params.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
