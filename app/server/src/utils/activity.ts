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
  const id = uuidv4();

  // BUG B4: No debouncing or deduplication logic.
  // If the same user updates the same task multiple times within a short
  // window (e.g., changing status then assignee), each update creates
  // a separate activity entry. Should consolidate rapid updates.
  db.prepare(`
    INSERT INTO activity_log (id, project_id, task_id, user_id, action, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, projectId, taskId, userId, action, details);
}
