import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../models/database.js';

const DEDUP_WINDOW_SECONDS = 5;

export function logActivity(
  projectId: string,
  taskId: string | null,
  userId: string,
  action: string,
  details: string
): void {
  const db = getDb();

  // Deduplicate: if the same user performed the same action on the same task
  // within the dedup window, update the existing entry instead of creating a new one.
  if (taskId) {
    const existing = db.prepare(`
      SELECT id FROM activity_log
      WHERE task_id = ? AND user_id = ? AND action = ?
        AND created_at >= datetime('now', ?)
      ORDER BY created_at DESC
      LIMIT 1
    `).get(taskId, userId, action, `-${DEDUP_WINDOW_SECONDS} seconds`) as any;

    if (existing) {
      db.prepare(`
        UPDATE activity_log SET details = ?, created_at = datetime('now')
        WHERE id = ?
      `).run(details, existing.id);
      return;
    }
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO activity_log (id, project_id, task_id, user_id, action, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, projectId, taskId, userId, action, details);
}
