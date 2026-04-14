// src/routes/unusualActivityRoutes.ts — REST API for Unusual Activity Detector

import { Router, Request, Response } from 'express';
import { UnusualActivityService } from '../services/UnusualActivityService';

export function createUnusualActivityRoutes(unusualService: UnusualActivityService): Router {
  const router = Router();

  // GET /api/unusual/:symbol — Scan single symbol
  router.get('/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const alerts = await unusualService.scanSymbol(symbol);
      res.json({ success: true, data: alerts });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/unusual/scan — Scan multiple symbols
  router.post('/scan', async (req: Request, res: Response) => {
    try {
      const { symbols } = req.body;
      if (!symbols || !Array.isArray(symbols)) {
        res.status(400).json({ success: false, error: 'Required: symbols (array)' });
        return;
      }
      const alerts = await unusualService.scanMarket(symbols);
      res.json({ success: true, data: alerts });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
