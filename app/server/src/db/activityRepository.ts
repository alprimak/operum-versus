import type Database from 'better-sqlite3';
import { getDb } from '../models/database.js';

export class ActivityRepository {
  private readonly getDatabase: () => Database.Database;
  constructor(db?: Database.Database) {
    this.getDatabase = db ? () => db : () => getDb();
  }

  isProjectMember(projectId: string, userId: string): boolean {
    const member = this.getDatabase().prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, userId);
    return Boolean(member);
  }

  listForProject(projectId: string, limit: number, offset: number): any[] {
    return this.getDatabase().prepare(`
      SELECT al.*, u.name as user_name
      FROM activity_log al
      JOIN users u ON al.user_id = u.id
      WHERE al.project_id = ?
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).all(projectId, limit, offset) as any[];
  }
}
