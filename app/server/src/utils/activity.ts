import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../models/database.js';

// Deduplicate window in seconds
const DEDUP_WINDOW_SECONDS = 5;

export function logActivity(
  projectId: string,
  taskId: string | null,
  userId: string,
  action: string,
  details: string
): void {
  const db = getDb();

  // Check for a recent duplicate within the deduplication window
  const existing = db.prepare(`
    SELECT id FROM activity_log
    WHERE project_id = ?
      AND task_id IS ?
      AND user_id = ?
      AND action = ?
      AND created_at >= datetime('now', '-' || ? || ' seconds')
    LIMIT 1
  `).get(projectId, taskId, userId, action, DEDUP_WINDOW_SECONDS) as any;

  if (existing) {
    // Update the existing entry with latest details instead of inserting
    db.prepare(`
      UPDATE activity_log SET details = ?, created_at = datetime('now') WHERE id = ?
    `).run(details, existing.id);
    return;
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO activity_log (id, project_id, task_id, user_id, action, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, projectId, taskId, userId, action, details);
}
