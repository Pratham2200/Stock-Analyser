// src/routes/earningsRoutes.ts — REST API for Earnings Whisper Engine

import { Router, Request, Response } from 'express';
import { EarningsWhisperService } from '../services/EarningsWhisperService';

export function createEarningsRoutes(
  earningsService: EarningsWhisperService
): Router {
  const router = Router();

  // POST /api/earnings/whisper — Generate AI earnings prediction
  router.post('/whisper', async (req: Request, res: Response) => {
    try {
      const { symbol, peers } = req.body;

      if (!symbol) {
        res.status(400).json({
          success: false,
          error: 'Required: symbol',
        });
        return;
      }

      const peerList = Array.isArray(peers) ? peers : [];
      const result = await earningsService.predictEarnings(symbol, peerList);
      
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
