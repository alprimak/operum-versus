import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';

export const activityRouter = Router();
activityRouter.use(authenticateToken);

activityRouter.get('/project/:projectId', (req: AuthRequest, res: Response) => {
  const projectRepo = new ProjectRepository();

  if (!projectRepo.isMember(req.params.projectId, req.userId!)) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const activityRepo = new ActivityRepository();
  const activities = activityRepo.findByProject(req.params.projectId, limit, offset);

  res.json({ activities });
});
