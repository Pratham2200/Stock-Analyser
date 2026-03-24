// src/routes/insiderRoutes.ts — REST API for Insider tracking and institutional flows

import { Router, Request, Response } from 'express';
import { InsiderTrackingService } from '../services/InsiderTrackingService';
import { FiiDiiService } from '../services/FiiDiiService';

export function createInsiderRoutes(
  insiderService: InsiderTrackingService,
  fiidiiService: FiiDiiService,
): Router {
  const router = Router();

  // GET /api/insider/activity/:symbol — Get bulk/block deals for a stock
  router.get('/activity/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const result = await insiderService.getInsiderActivity(symbol);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/insider/market-flow — Get top smart money activity market-wide
  router.get('/market-flow', async (req: Request, res: Response) => {
    try {
      const result = await insiderService.getMarketWideSmartMoneyFlow();
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/insider/fii-dii — Get institutional flow
  router.get('/fii-dii', async (req: Request, res: Response) => {
    try {
      const result = await fiidiiService.getRecentFlows();
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
