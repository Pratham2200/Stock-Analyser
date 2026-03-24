// src/routes/tradeJournalRoutes.ts — REST API for AI Trade Journal

import { Router, Request, Response } from 'express';
import { AiTradeJournalService } from '../services/AiTradeJournalService';

export function createTradeJournalRoutes(
  tradeJournalService: AiTradeJournalService
): Router {
  const router = Router();

  // GET /api/journal/analysis/:userId — Get AI analysis of a user's trading journal
  router.get('/analysis/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const result = await tradeJournalService.analyzeJournal(userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
