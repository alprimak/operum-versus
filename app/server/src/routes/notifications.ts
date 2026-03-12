import { Router, Response } from 'express';
import { getDb } from '../models/database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const notificationRouter = Router();
notificationRouter.use(authenticateToken);

// GET /api/notifications — list unread notifications for current user
notificationRouter.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.userId);

  const unreadCount = (db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
  ).get(req.userId) as any).count;

  res.json({ notifications, unreadCount });
});

// PUT /api/notifications/:id/read — mark notification as read
notificationRouter.put('/:id/read', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId) as any;

  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// PUT /api/notifications/read-all — mark all as read
notificationRouter.put('/read-all', (req: AuthRequest, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.userId);
  res.json({ success: true });
});
