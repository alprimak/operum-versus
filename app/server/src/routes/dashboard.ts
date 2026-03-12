import { Router, Response } from 'express';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import { TaskRepository } from '../repositories/TaskRepository.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticateToken);

dashboardRouter.get('/stats', (req: AuthRequest, res: Response) => {
  const projectRepo = new ProjectRepository();
  const taskRepo = new TaskRepository();

  const ids = projectRepo.getProjectIdsForUser(req.userId!);

  if (ids.length === 0) {
    res.json({
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      tasksByStatus: {},
      tasksByPriority: {},
    });
    return;
  }

  // BUG B2: This query counts ALL tasks including soft-deleted ones
  // (where deleted_at IS NOT NULL). The dashboard shows inflated numbers
  // because deleted tasks are still included in the count.
  const stats = taskRepo.getStats(ids);
  res.json(stats);
});
