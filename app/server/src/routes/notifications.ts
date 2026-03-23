import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { NotificationRepository } from '../db/notificationRepository.js';

export const notificationRouter = Router();
notificationRouter.use(authenticateToken);
const notificationRepository = new NotificationRepository();

notificationRouter.get('/', (req: AuthRequest, res: Response) => {
  const notifications = notificationRepository.listForUser(req.userId!);
  const unreadCount = notificationRepository.unreadCountForUser(req.userId!);
  res.json({ notifications, unreadCount });
});

notificationRouter.put('/:id/read', (req: AuthRequest, res: Response) => {
  const notification = notificationRepository.findForUser(req.params.id, req.userId!);

  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  notificationRepository.markAsRead(req.params.id, req.userId!);

  res.status(204).send();
});
