import type Database from 'better-sqlite3';
import { getDb } from '../models/database.js';

export class NotificationRepository {
  private readonly getDatabase: () => Database.Database;
  constructor(db?: Database.Database) {
    this.getDatabase = db ? () => db : () => getDb();
  }

  listForUser(userId: string): any[] {
    return this.getDatabase().prepare(`
      SELECT *
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as any[];
  }

  unreadCountForUser(userId: string): number {
    const unreadCount = this.getDatabase().prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND read = 0
    `).get(userId) as { count: number };
    return unreadCount.count;
  }

  findForUser(notificationId: string, userId: string): { id: string } | undefined {
    return this.getDatabase().prepare(`
      SELECT id
      FROM notifications
      WHERE id = ? AND user_id = ?
    `).get(notificationId, userId) as { id: string } | undefined;
  }

  markAsRead(notificationId: string, userId: string): void {
    this.getDatabase().prepare(`
      UPDATE notifications
      SET read = 1
      WHERE id = ? AND user_id = ?
    `).run(notificationId, userId);
  }

  createMentionNotification(id: string, userId: string, referenceId: string): void {
    this.getDatabase().prepare(`
      INSERT INTO notifications (id, user_id, type, reference_id, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, 'mention', referenceId, 'You were mentioned in a task comment');
  }
}
