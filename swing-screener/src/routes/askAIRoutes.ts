// src/routes/askAIRoutes.ts — REST API for Ask AI feature

import { Router, Request, Response } from 'express';
import { AskAIService } from '../services/AskAIService';
import { SentimentService } from '../services/SentimentService';

export function createAskAIRoutes(
  askAIService: AskAIService,
  sentimentService: SentimentService,
): Router {
  const router = Router();

  // POST /api/ask-ai — Ask a natural language question
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { prompt, conversationHistory } = req.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Required: prompt (non-empty string)',
        });
        return;
      }

      if (prompt.length > 2000) {
        res.status(400).json({
          success: false,
          error: 'Prompt too long (max 2000 characters)',
        });
        return;
      }

      const result = await askAIService.ask({
        prompt: prompt.trim(),
        conversationHistory: conversationHistory || [],
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/ask-ai/sentiment/:symbol — Get sentiment for a symbol
  router.get('/sentiment/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const result = await sentimentService.scrapeSentiment(symbol);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
