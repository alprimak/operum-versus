import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { activityRepository } from '../repositories/index.js';

export const activityRouter = Router();
activityRouter.use(authenticateToken);

activityRouter.get('/project/:projectId', (req: AuthRequest, res: Response) => {
  if (!activityRepository.isMember(req.params.projectId, req.userId!)) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const activities = activityRepository.findByProject(req.params.projectId, limit, offset);
  res.json({ activities });
});
