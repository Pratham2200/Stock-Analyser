// src/routes/whatIfRoutes.ts — REST API for the "What If" Options Simulator

import { Router, Request, Response } from 'express';
import { WhatIfSimulator } from '../services/WhatIfSimulator';

export function createWhatIfRoutes(whatIfSimulator: WhatIfSimulator): Router {
  const router = Router();

  // POST /api/what-if/simulate — Run a full multi-leg strategy simulation
  router.post('/simulate', async (req: Request, res: Response) => {
    try {
      const { 
        symbol, 
        legs, 
        currentSpot, 
        targetDate, 
        targetIVChangePercent, 
        priceRangePercent, 
        steps 
      } = req.body;

      // Basic validation
      if (!symbol || !legs || !Array.isArray(legs) || legs.length === 0 || !currentSpot || !targetDate) {
        res.status(400).json({
          success: false,
          error: 'Required: symbol, legs array, currentSpot, targetDate',
        });
        return;
      }

      const result = await whatIfSimulator.simulateStrategy({
        symbol,
        legs,
        currentSpot,
        targetDate,
        targetIVChangePercent: targetIVChangePercent || 0,
        priceRangePercent: priceRangePercent || 10,
        steps: steps || 50,
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
