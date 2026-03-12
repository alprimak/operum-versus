import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../models/database.js';

export class ActivityRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDb();
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

  log(projectId: string, taskId: string | null, userId: string, action: string, details: string) {
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO activity_log (id, project_id, task_id, user_id, action, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, projectId, taskId, userId, action, details);
  }
}
