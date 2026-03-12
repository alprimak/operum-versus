import Database from 'better-sqlite3';
import { getDb } from '../models/database.js';

export class ProjectRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDb();
  }

  listByUser(userId: string) {
    return this.db.prepare(`
      SELECT p.*, pm.role
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ?
      ORDER BY p.updated_at DESC
    `).all(userId);
  }

  findByIdForUser(id: string, userId: string) {
    return this.db.prepare(`
      SELECT p.* FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE p.id = ? AND pm.user_id = ?
    `).get(id, userId) as any;
  }

  findById(id: string) {
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  }

  getMembers(projectId: string) {
    return this.db.prepare(`
      SELECT u.id, u.name, u.email, pm.role
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `).all(projectId);
  }

  create(id: string, name: string, description: string | null, ownerId: string) {
    this.db.prepare('INSERT INTO projects (id, name, description, owner_id) VALUES (?, ?, ?, ?)')
      .run(id, name, description, ownerId);
    this.db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(id, ownerId, 'owner');
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  }

  update(id: string, name: string, description: string) {
    this.db.prepare("UPDATE projects SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?")
      .run(name, description, id);
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  getProjectIdsForUser(userId: string): string[] {
    const rows = this.db.prepare(
      'SELECT project_id FROM project_members WHERE user_id = ?'
    ).all(userId) as any[];
    return rows.map((r: any) => r.project_id);
  }
}
