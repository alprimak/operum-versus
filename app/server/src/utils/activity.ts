import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../models/database.js';

export function logActivity(
  projectId: string,
  taskId: string | null,
  userId: string,
  action: string,
  details: string
): void {
  const db = getDb();
  const dedupeWindowSeconds = 5;
  const recentEntry = db.prepare(`
    SELECT id
    FROM activity_log
    WHERE project_id = ?
      AND user_id = ?
      AND action = ?
      AND (
        (task_id = ?)
        OR (task_id IS NULL AND ? IS NULL)
      )
      AND created_at >= datetime('now', ?)
    ORDER BY created_at DESC
    LIMIT 1
  `).get(projectId, userId, action, taskId, taskId, `-${dedupeWindowSeconds} seconds`) as { id: string } | undefined;

  if (recentEntry) {
    // Keep a single activity row for rapid repeated actions and refresh details.
    db.prepare(`
      UPDATE activity_log
      SET details = ?
      WHERE id = ?
    `).run(details, recentEntry.id);
    return;
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO activity_log (id, project_id, task_id, user_id, action, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, projectId, taskId, userId, action, details);
}
