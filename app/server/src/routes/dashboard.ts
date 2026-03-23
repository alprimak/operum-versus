import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { DashboardRepository } from '../db/dashboardRepository.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticateToken);
const dashboardRepository = new DashboardRepository();

dashboardRouter.get('/stats', (req: AuthRequest, res: Response) => {
  const projectIds = dashboardRepository.listProjectIdsForUser(req.userId!);
  if (projectIds.length === 0) {
    res.json({
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      tasksByStatus: {},
      tasksByPriority: {},
    });
    return;
  }

  const totalTasks = dashboardRepository.getTotalTasks(projectIds);
  const completedTasks = dashboardRepository.getCompletedTasks(projectIds);
  const overdueTasks = dashboardRepository.getOverdueTasks(projectIds);
  const tasksByStatus = dashboardRepository.getTasksByStatus(projectIds);
  const tasksByPriority = dashboardRepository.getTasksByPriority(projectIds);

  res.json({
    totalTasks,
    completedTasks,
    overdueTasks,
    tasksByStatus: Object.fromEntries(tasksByStatus.map((r) => [r.status, r.count])),
    tasksByPriority: Object.fromEntries(tasksByPriority.map((r) => [r.priority, r.count])),
  });
});
