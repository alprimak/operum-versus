import type Database from 'better-sqlite3';
import { getDb } from '../models/database.js';

type SearchParams = {
  userId: string;
  query?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  project_id?: string;
};

export class TaskRepository {
  private readonly getDatabase: () => Database.Database;
  constructor(db?: Database.Database) {
    this.getDatabase = db ? () => db : () => getDb();
  }

  findTaskWithMembership(taskId: string, userId: string): any {
    return this.getDatabase().prepare(`
      SELECT t.*
      FROM tasks t
      JOIN project_members pm ON pm.project_id = t.project_id
      WHERE t.id = ? AND pm.user_id = ? AND t.deleted_at IS NULL
    `).get(taskId, userId);
  }

  listMentionedUsersForProject(projectId: string, mentions: string[]): any[] {
    if (mentions.length === 0) return [];
    const placeholders = mentions.map(() => '?').join(', ');
    return this.getDatabase().prepare(`
      SELECT u.id, u.name
      FROM users u
      JOIN project_members pm ON pm.user_id = u.id
      WHERE pm.project_id = ?
        AND u.name IN (${placeholders})
    `).all(projectId, ...mentions) as any[];
  }

  searchTasks(params: SearchParams): any[] {
    const where: string[] = ['pm.user_id = ?', 't.deleted_at IS NULL'];
    const values: any[] = [params.userId];

    if (params.project_id) {
      where.push('t.project_id = ?');
      values.push(params.project_id);
    }
    if (params.status) {
      where.push('t.status = ?');
      values.push(params.status);
    }
    if (params.priority) {
      where.push('t.priority = ?');
      values.push(params.priority);
    }
    if (params.assignee) {
      where.push('t.assignee_id = ?');
      values.push(params.assignee);
    }
    if (params.query && params.query.length > 0) {
      const searchTerm = `%${params.query}%`;
      where.push('(t.title LIKE ? OR COALESCE(t.description, \'\') LIKE ?)');
      values.push(searchTerm, searchTerm);
    }

    return this.getDatabase().prepare(`
      SELECT
        t.*,
        u.name as assignee_name,
        p.name as project_name
      FROM tasks t
      INNER JOIN project_members pm ON pm.project_id = t.project_id
      INNER JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY t.created_at DESC
    `).all(...values) as any[];
  }

  isProjectMember(projectId: string, userId: string): boolean {
    const member = this.getDatabase().prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, userId);
    return Boolean(member);
  }

  listTasksForProject(projectId: string): any[] {
    return this.getDatabase().prepare(`
      SELECT t.*, u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = ?
      ORDER BY t.created_at DESC
    `).all(projectId) as any[];
  }

  createTask(input: {
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    priority: string;
    assigneeId: string | null;
    dueDate: string | null;
    createdBy: string;
  }): void {
    this.getDatabase().prepare(`
      INSERT INTO tasks (id, project_id, title, description, priority, assignee_id, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.projectId,
      input.title,
      input.description,
      input.priority,
      input.assigneeId,
      input.dueDate,
      input.createdBy
    );
  }

  findTaskById(taskId: string): any {
    return this.getDatabase().prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  }

  updateTask(taskId: string, fields: string[], values: any[]): void {
    this.getDatabase().prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values, taskId);
  }

  softDeleteTask(taskId: string): void {
    this.getDatabase().prepare("UPDATE tasks SET deleted_at = datetime('now') WHERE id = ?").run(taskId);
  }

  listCommentsForTask(taskId: string): any[] {
    return this.getDatabase().prepare(`
      SELECT c.*, u.name AS author_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `).all(taskId) as any[];
  }

  createComment(commentId: string, taskId: string, userId: string, content: string): void {
    this.getDatabase().prepare(`
      INSERT INTO comments (id, task_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `).run(commentId, taskId, userId, content);
  }

  deleteComment(commentId: string): void {
    this.getDatabase().prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  }

  findCommentByIdForTask(commentId: string, taskId: string): any {
    return this.getDatabase().prepare(`
      SELECT id, user_id
      FROM comments
      WHERE id = ? AND task_id = ?
    `).get(commentId, taskId);
  }

  updateComment(commentId: string, content: string): void {
    this.getDatabase().prepare(`
      UPDATE comments
      SET content = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(content, commentId);
  }

  findCommentWithAuthor(commentId: string): any {
    return this.getDatabase().prepare(`
      SELECT c.*, u.name AS author_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `).get(commentId);
  }
}
