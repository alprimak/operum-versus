import { Router, Response } from 'express';
import { getDb } from '../models/database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const activityRouter = Router();
activityRouter.use(authenticateToken);

activityRouter.get('/project/:projectId', (req: AuthRequest, res: Response) => {
  const db = getDb();

  // Verify membership
  const member = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.projectId, req.userId);

  if (!member) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  // BUG B4: No deduplication — rapid consecutive updates to the same task
  // generate multiple activity entries with timestamps within the same second.
  // The frontend shows all of them, creating a cluttered activity feed.
  const activities = db.prepare(`
    SELECT al.*, u.name as user_name
    FROM activity_log al
    JOIN users u ON al.user_id = u.id
    WHERE al.project_id = ?
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.params.projectId, limit, offset);

  res.json({ activities });
});
