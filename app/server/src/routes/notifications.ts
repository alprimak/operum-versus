import { Router, Response } from 'express';
import { getDb } from '../models/database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const notificationRouter = Router();
notificationRouter.use(authenticateToken);

// List notifications for current user
notificationRouter.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const notifications = db.prepare(`
    SELECT n.*, u.name as from_user_name
    FROM notifications n
    JOIN users u ON n.from_user_id = u.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.userId, limit, offset);

  const unreadCount = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
  ).get(req.userId) as any;

  res.json({ notifications, unreadCount: unreadCount.count });
});

// Mark notification as read
notificationRouter.put('/:id/read', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const notification = db.prepare(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId) as any;

  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Mark all notifications as read
notificationRouter.put('/read-all', (req: AuthRequest, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(req.userId);
  res.json({ success: true });
});
