import { Router, type IRouter, type Request, type Response } from 'express';
import { DecisionRepository } from '../models/decision.repository';

export const decisionsRouter: IRouter = Router();

decisionsRouter.get('/decisions', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query['limit'] ?? 50), 200);
  const decisions = await DecisionRepository.findRecent(limit);
  res.json(decisions);
});
