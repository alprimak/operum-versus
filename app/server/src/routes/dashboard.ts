import { Router, Response } from 'express';
import { getDb } from '../models/database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticateToken);

dashboardRouter.get('/stats', (req: AuthRequest, res: Response) => {
  const db = getDb();

  // Get all projects user is a member of
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
  const placeholders = ids.map(() => '?').join(',');

  // BUG B2: This query counts ALL tasks including soft-deleted ones
  // (where deleted_at IS NOT NULL). The dashboard shows inflated numbers
  // because deleted tasks are still included in the count.
  const totalTasks = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE project_id IN (${placeholders})
  `).get(...ids) as any;

  const completedTasks = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE project_id IN (${placeholders}) AND status = 'done'
  `).get(...ids) as any;

  const overdueTasks = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE project_id IN (${placeholders})
    AND due_date < datetime('now')
    AND status != 'done'
  `).get(...ids) as any;

  const tasksByStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM tasks
    WHERE project_id IN (${placeholders})
    GROUP BY status
  `).all(...ids) as any[];

  const tasksByPriority = db.prepare(`
    SELECT priority, COUNT(*) as count FROM tasks
    WHERE project_id IN (${placeholders})
    GROUP BY priority
  `).all(...ids) as any[];

  res.json({
    totalTasks: totalTasks.count,
    completedTasks: completedTasks.count,
    overdueTasks: overdueTasks.count,
    tasksByStatus: Object.fromEntries(tasksByStatus.map((r: any) => [r.status, r.count])),
    tasksByPriority: Object.fromEntries(tasksByPriority.map((r: any) => [r.priority, r.count])),
  });
});
