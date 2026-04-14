// src/routes/correlationRoutes.ts — REST API for Correlation Matrix

import { Router, Request, Response } from 'express';
import { CorrelationMatrixService } from '../services/CorrelationMatrixService';

export function createCorrelationRoutes(correlationService: CorrelationMatrixService): Router {
  const router = Router();

  // POST /api/correlation/matrix — Compute correlation between symbols
  router.post('/matrix', async (req: Request, res: Response) => {
    try {
      const { symbols, days } = req.body;
      if (!symbols || !Array.isArray(symbols) || symbols.length < 2) {
        res.status(400).json({ success: false, error: 'Required: symbols (array of at least 2)' });
        return;
      }
      const result = await correlationService.computeMatrix(symbols, days || 60);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
