import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { ActivityRepository } from '../db/activityRepository.js';

export const activityRouter = Router();
activityRouter.use(authenticateToken);
const activityRepository = new ActivityRepository();

activityRouter.get('/project/:projectId', (req: AuthRequest, res: Response) => {
  const member = activityRepository.isProjectMember(req.params.projectId, req.userId!);

  if (!member) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  // BUG B4: No deduplication — rapid consecutive updates to the same task
  // generate multiple activity entries with timestamps within the same second.
  // The frontend shows all of them, creating a cluttered activity feed.
  const activities = activityRepository.listForProject(req.params.projectId, limit, offset);

  res.json({ activities });
});
