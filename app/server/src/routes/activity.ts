import { Router, Response } from 'express';
import { UserRepository } from '../repositories/UserRepository.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const activityRouter = Router();
activityRouter.use(authenticateToken);

activityRouter.get('/project/:projectId', (req: AuthRequest, res: Response) => {
  const userRepo = new UserRepository();
  const activityRepo = new ActivityRepository();

  if (!userRepo.isMemberOf(req.params.projectId, req.userId!)) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const activities = activityRepo.listByProject(req.params.projectId, limit, offset);
  res.json({ activities });
});
