import { getDb } from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';

const DEDUP_WINDOW_SECONDS = 5;

export class ActivityRepository {
  private get db() { return getDb(); }

  log(projectId: string, taskId: string | null, userId: string, action: string, details: string): void {
    const existing = this.db.prepare(`
      SELECT id FROM activity_log
      WHERE project_id = ? AND task_id IS ? AND user_id = ? AND action = ?
        AND created_at >= datetime('now', '-' || ? || ' seconds')
      LIMIT 1
    `).get(projectId, taskId, userId, action, DEDUP_WINDOW_SECONDS) as any;

    if (existing) {
      this.db.prepare('UPDATE activity_log SET details = ?, created_at = datetime(\'now\') WHERE id = ?')
        .run(details, existing.id);
      return;
    }

    this.db.prepare(`
      INSERT INTO activity_log (id, project_id, task_id, user_id, action, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), projectId, taskId, userId, action, details);
  }

  findByProject(projectId: string, limit: number, offset: number) {
    return this.db.prepare(`
      SELECT al.*, u.name as user_name
      FROM activity_log al
      JOIN users u ON al.user_id = u.id
      WHERE al.project_id = ?
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).all(projectId, limit, offset) as any[];
  }

  isMember(projectId: string, userId: string): boolean {
    return !!this.db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, userId);
  }
}

export const activityRepository = new ActivityRepository();
