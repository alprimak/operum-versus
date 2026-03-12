import Database from 'better-sqlite3';
import { getDb } from '../models/database.js';

export class TaskRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDb();
  }

  findById(id: string) {
    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  }

  listByProject(projectId: string) {
    return this.db.prepare(`
      SELECT t.*, u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = ?
      ORDER BY t.created_at DESC
    `).all(projectId);
  }

  create(
    id: string, projectId: string, title: string,
    description: string | null, priority: string,
    assigneeId: string | null, dueDate: string | null,
    createdBy: string
  ) {
    this.db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, priority, assignee_id, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, title, description, priority, assigneeId, dueDate, createdBy);
    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
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

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_at = datetime('now')");
    values.push(id);

    this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  }

  softDelete(id: string) {
    this.db.prepare("UPDATE tasks SET deleted_at = datetime('now') WHERE id = ?").run(id);
  }

  getStats(projectIds: string[]) {
    const placeholders = projectIds.map(() => '?').join(',');

    const totalTasks = this.db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE project_id IN (${placeholders})
    `).get(...projectIds) as any;

    const completedTasks = this.db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE project_id IN (${placeholders}) AND status = 'done'
    `).get(...projectIds) as any;

    const overdueTasks = this.db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE project_id IN (${placeholders})
      AND due_date < datetime('now')
      AND status != 'done'
    `).get(...projectIds) as any;

    const tasksByStatus = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM tasks
      WHERE project_id IN (${placeholders})
      GROUP BY status
    `).all(...projectIds) as any[];

    const tasksByPriority = this.db.prepare(`
      SELECT priority, COUNT(*) as count FROM tasks
      WHERE project_id IN (${placeholders})
      GROUP BY priority
    `).all(...projectIds) as any[];

    return {
      totalTasks: totalTasks.count,
      completedTasks: completedTasks.count,
      overdueTasks: overdueTasks.count,
      tasksByStatus: Object.fromEntries(tasksByStatus.map((r: any) => [r.status, r.count])),
      tasksByPriority: Object.fromEntries(tasksByPriority.map((r: any) => [r.priority, r.count])),
    };
  }
}
