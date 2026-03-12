import type Database from 'better-sqlite3';
import { getDb } from '../models/database.js';

export class TaskRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDb();
  }

  findById(id: string) {
    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  }

  findByProject(projectId: string) {
    return this.db.prepare(`
      SELECT t.*, u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = ?
      ORDER BY t.created_at DESC
    `).all(projectId) as any[];
  }

  create(id: string, projectId: string, title: string, description: string | null,
         priority: string, assigneeId: string | null, dueDate: string | null, createdBy: string) {
    this.db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, priority, assignee_id, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, title, description, priority, assigneeId, dueDate, createdBy);
  }

  update(id: string, updates: Record<string, any>) {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = datetime("now")');
    values.push(id);

    this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return true;
  }

  softDelete(id: string) {
    this.db.prepare("UPDATE tasks SET deleted_at = datetime('now') WHERE id = ?").run(id);
  }

  countByProjectIds(projectIds: string[]) {
    const placeholders = projectIds.map(() => '?').join(',');
    return {
      total: (this.db.prepare(`
        SELECT COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders})
      `).get(...projectIds) as any).count,
      completed: (this.db.prepare(`
        SELECT COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders}) AND status = 'done'
      `).get(...projectIds) as any).count,
      overdue: (this.db.prepare(`
        SELECT COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders})
        AND due_date < datetime('now') AND status != 'done'
      `).get(...projectIds) as any).count,
      byStatus: Object.fromEntries(
        (this.db.prepare(`
          SELECT status, COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders}) GROUP BY status
        `).all(...projectIds) as any[]).map(r => [r.status, r.count])
      ),
      byPriority: Object.fromEntries(
        (this.db.prepare(`
          SELECT priority, COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders}) GROUP BY priority
        `).all(...projectIds) as any[]).map(r => [r.priority, r.count])
      ),
    };
  }
}
