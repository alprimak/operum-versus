import type Database from 'better-sqlite3';
import { getDb } from '../models/database.js';

export class ProjectRepository {
  private readonly getDatabase: () => Database.Database;
  constructor(db?: Database.Database) {
    this.getDatabase = db ? () => db : () => getDb();
  }

  listForUser(userId: string): any[] {
    return this.getDatabase().prepare(`
      SELECT p.*, pm.role
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ?
      ORDER BY p.updated_at DESC
    `).all(userId) as any[];
  }

  createProject(id: string, name: string, description: string | null, ownerId: string): void {
    this.getDatabase().prepare('INSERT INTO projects (id, name, description, owner_id) VALUES (?, ?, ?, ?)')
      .run(id, name, description, ownerId);
  }

  addProjectMember(projectId: string, userId: string, role: string): void {
    this.getDatabase().prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(projectId, userId, role);
  }

  findProjectForUser(projectId: string, userId: string): any {
    return this.getDatabase().prepare(`
      SELECT p.* FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE p.id = ? AND pm.user_id = ?
    `).get(projectId, userId);
  }

  findProjectMembers(projectId: string): any[] {
    return this.getDatabase().prepare(`
      SELECT u.id, u.name, u.email, pm.role
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `).all(projectId) as any[];
  }

  findProjectRole(projectId: string, userId: string): { role: string } | undefined {
    return this.getDatabase().prepare(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, userId) as { role: string } | undefined;
  }

  isProjectMember(projectId: string, userId: string): boolean {
    const member = this.getDatabase().prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, userId);
    return Boolean(member);
  }

  listProjectTasksForCsv(projectId: string): any[] {
    return this.getDatabase().prepare(`
      SELECT
        t.id,
        t.title,
        t.status,
        t.priority,
        u.name AS assignee,
        t.due_date,
        t.created_at
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.project_id = ?
        AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC
    `).all(projectId) as any[];
  }

  updateProject(projectId: string, name: string, description: string): void {
    this.getDatabase().prepare('UPDATE projects SET name = ?, description = ?, updated_at = datetime("now") WHERE id = ?')
      .run(name, description, projectId);
  }

  findProjectById(projectId: string): any {
    return this.getDatabase().prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  }

  deleteProject(projectId: string): void {
    this.getDatabase().prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  }
}
