// src/routes/tradeCardRoutes.ts — REST API for Shareable Trade Cards

import { Router, Request, Response } from 'express';
import { TradeCardService } from '../services/TradeCardService';

export function createTradeCardRoutes(tradeCardService: TradeCardService): Router {
  const router = Router();

  // POST /api/cards/generate — Generate a shareable trade card
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      const { symbol, userId } = req.body;
      if (!symbol) {
        res.status(400).json({ success: false, error: 'Required: symbol' });
        return;
      }
      const card = await tradeCardService.generateCard(symbol, userId || 'anonymous');
      res.json({ success: true, data: card });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
