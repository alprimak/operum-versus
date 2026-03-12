import { Router, Response } from 'express';
import { getDb } from '../models/database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { taskRepository } from '../repositories/index.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticateToken);

dashboardRouter.get('/stats', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const projectIds = db.prepare(`
    SELECT project_id FROM project_members WHERE user_id = ?
  `).all(req.userId) as any[];

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

  const ids = projectIds.map((p: any) => p.project_id);
  const counts = taskRepository.getProjectIdCountsForUser(ids);

  res.json({
    totalTasks: counts.total,
    completedTasks: counts.completed,
    overdueTasks: counts.overdue,
    tasksByStatus: Object.fromEntries(counts.byStatus.map((r: any) => [r.status, r.count])),
    tasksByPriority: Object.fromEntries(counts.byPriority.map((r: any) => [r.priority, r.count])),
  });
});
