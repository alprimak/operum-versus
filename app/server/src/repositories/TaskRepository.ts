import { getDb } from '../models/database.js';

export class TaskRepository {
  private get db() { return getDb(); }

  findByProject(projectId: string) {
    return this.db.prepare(`
      SELECT t.*, u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = ? AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC
    `).all(projectId) as any[];
  }

  findById(id: string) {
    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  }

  create(
    id: string, projectId: string, title: string, description: string | null,
    priority: string, assigneeId: string | null, dueDate: string | null, createdBy: string
  ) {
    return this.db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, priority, assignee_id, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, title, description, priority, assigneeId, dueDate, createdBy);
  }

  update(id: string, fields: string[], values: any[]) {
    return this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  }

  softDelete(id: string) {
    return this.db.prepare("UPDATE tasks SET deleted_at = datetime('now') WHERE id = ?").run(id);
  }

  getProjectIdCountsForUser(projectIds: string[]) {
    const placeholders = projectIds.map(() => '?').join(',');
    return {
      total: (this.db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders}) AND deleted_at IS NULL`).get(...projectIds) as any).count,
      completed: (this.db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders}) AND status = 'done' AND deleted_at IS NULL`).get(...projectIds) as any).count,
      overdue: (this.db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders}) AND due_date < datetime('now') AND status != 'done' AND deleted_at IS NULL`).get(...projectIds) as any).count,
      byStatus: this.db.prepare(`SELECT status, COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders}) AND deleted_at IS NULL GROUP BY status`).all(...projectIds) as any[],
      byPriority: this.db.prepare(`SELECT priority, COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders}) AND deleted_at IS NULL GROUP BY priority`).all(...projectIds) as any[],
    };
  }
}

export const taskRepository = new TaskRepository();
