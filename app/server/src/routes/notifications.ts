import { Router, Response } from 'express';
import { getDb } from '../models/database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const notificationRouter = Router();
notificationRouter.use(authenticateToken);

notificationRouter.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const notifications = db.prepare(`
    SELECT *
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.userId);

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_id = ? AND read = 0
  `).get(req.userId) as { count: number };

  res.json({ notifications, unreadCount: unreadCount.count });
});

notificationRouter.put('/:id/read', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const notification = db.prepare(`
    SELECT id
    FROM notifications
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.userId);

  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  db.prepare(`
    UPDATE notifications
    SET read = 1
    WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.userId);

  res.status(204).send();
});
