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

  // Deduplicate: if same user/task/action exists within the time window, update it
  if (taskId) {
    const recent = db.prepare(`
      SELECT id FROM activity_log
      WHERE task_id = ? AND user_id = ? AND action = ?
      AND created_at >= datetime('now', '-${DEDUP_WINDOW_SECONDS} seconds')
      ORDER BY created_at DESC LIMIT 1
    `).get(taskId, userId, action) as any;

    if (recent) {
      db.prepare(`
        UPDATE activity_log SET details = ?, created_at = datetime('now') WHERE id = ?
      `).run(details, recent.id);
      return;
    }
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO activity_log (id, project_id, task_id, user_id, action, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, projectId, taskId, userId, action, details);
}
