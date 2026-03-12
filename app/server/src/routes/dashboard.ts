import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import { TaskRepository } from '../repositories/TaskRepository.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticateToken);

dashboardRouter.get('/stats', (req: AuthRequest, res: Response) => {
  const projectRepo = new ProjectRepository();
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

  const taskRepo = new TaskRepository();
  const stats = taskRepo.countByProjectIds(ids);

  res.json({
    totalTasks: stats.total,
    completedTasks: stats.completed,
    overdueTasks: stats.overdue,
    tasksByStatus: stats.byStatus,
    tasksByPriority: stats.byPriority,
  });
});
