// src/routes/paperTradingRoutes.ts — REST API for Paper Trading

import { Router, Request, Response } from 'express';
import { PaperTradingService } from '../services/PaperTradingService';

export function createPaperTradingRoutes(
  paperTradingService: PaperTradingService
): Router {
  const router = Router();

  // GET /api/paper-trading/portfolio/:userId — Get a user's portfolio and live MTM
  router.get('/portfolio/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const result = await paperTradingService.getPortfolio(userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/paper-trading/trade — Execute a virtual trade
  router.post('/trade', async (req: Request, res: Response) => {
    try {
      const { userId, symbol, quantity, type } = req.body;
      
      if (!userId || !symbol || !quantity || !type) {
        res.status(400).json({
          success: false,
          error: 'Required: userId, symbol, quantity, type (BUY/SELL)',
        });
        return;
      }

      const result = await paperTradingService.executeTrade(userId, symbol, quantity, type);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
