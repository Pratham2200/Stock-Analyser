// src/routes/optionsRoutes.ts — REST API for options features

import { Router, Request, Response } from 'express';
import { OptionsService } from '../services/OptionsService';
import { StrategyRecommender } from '../services/StrategyRecommender';
import { OptionsPainMapService } from '../services/OptionsPainMapService';

export function createOptionsRoutes(
  optionsService: OptionsService,
  strategyRecommender: StrategyRecommender,
  painMapService: OptionsPainMapService,
): Router {
  const router = Router();

  // GET /api/options/chain/:symbol — Full option chain with Greeks
  router.get('/chain/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const expiry = req.query.expiry as string | undefined;
      const result = await optionsService.getOptionChainWithGreeks(symbol, expiry);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/options/greeks/:symbol/:strike/:type — Greeks for specific contract
  router.get('/greeks/:symbol/:strike/:type', async (req: Request, res: Response) => {
    try {
      const { symbol, strike, type } = req.params;
      const expiry = req.query.expiry as string | undefined;
      const result = await optionsService.getGreeksForContract(
        symbol,
        parseFloat(strike),
        type.toUpperCase() as 'CE' | 'PE',
        expiry,
      );

      if (!result) {
        res.status(404).json({ success: false, error: 'Contract not found' });
        return;
      }

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/options/predict — Predict option price at target level
  router.post('/predict', async (req: Request, res: Response) => {
    try {
      const { symbol, strike, optionType, targetPrice, daysForward, expiry } = req.body;

      if (!symbol || !strike || !optionType || targetPrice === undefined) {
        res.status(400).json({
          success: false,
          error: 'Required: symbol, strike, optionType, targetPrice',
        });
        return;
      }

      const result = await optionsService.predictAtLevel(
        symbol,
        parseFloat(strike),
        optionType.toUpperCase(),
        parseFloat(targetPrice),
        parseInt(daysForward || '0', 10),
        expiry,
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/options/find-level — Find required index level for target option price
  router.post('/find-level', async (req: Request, res: Response) => {
    try {
      const { symbol, strike, optionType, targetOptionPrice, expiry } = req.body;

      if (!symbol || !strike || !optionType || targetOptionPrice === undefined) {
        res.status(400).json({
          success: false,
          error: 'Required: symbol, strike, optionType, targetOptionPrice',
        });
        return;
      }

      const result = await optionsService.findLevelForTargetPrice(
        symbol,
        parseFloat(strike),
        optionType.toUpperCase(),
        parseFloat(targetOptionPrice),
        expiry,
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/options/strategy — AI-recommended strategies
  router.post('/strategy', async (req: Request, res: Response) => {
    try {
      const { symbol, capital, riskTolerance } = req.body;

      if (!symbol) {
        res.status(400).json({ success: false, error: 'Required: symbol' });
        return;
      }

      const result = await strategyRecommender.recommendStrategies(
        symbol,
        parseFloat(capital || '100000'),
        riskTolerance || 'medium',
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/options/maxpain/:symbol — Max pain analysis
  router.get('/maxpain/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const expiry = req.query.expiry as string | undefined;
      const result = await optionsService.getMaxPain(symbol, expiry);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/options/pain-map/:symbol — Heatmap structure for frontend
  router.get('/pain-map/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const { expiry } = req.query;
      const result = await painMapService.generatePainMap(symbol, expiry as string);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/options/oi/:symbol — Open Interest analysis
  router.get('/oi/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const expiry = req.query.expiry as string | undefined;
      const result = await optionsService.getOIAnalysis(symbol, expiry);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
