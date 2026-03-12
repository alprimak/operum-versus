import { getDb } from '../models/database.js';

export class ProjectRepository {
  private get db() { return getDb(); }

  findAllForUser(userId: string) {
    return this.db.prepare(`
      SELECT p.*, pm.role
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ?
      ORDER BY p.updated_at DESC
    `).all(userId) as any[];
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

  create(id: string, name: string, description: string | null, ownerId: string) {
    return this.db.prepare('INSERT INTO projects (id, name, description, owner_id) VALUES (?, ?, ?, ?)')
      .run(id, name, description, ownerId);
  }

  update(id: string, name: string, description: string | undefined) {
    return this.db.prepare('UPDATE projects SET name = ?, description = ?, updated_at = datetime("now") WHERE id = ?')
      .run(name, description, id);
  }

  delete(id: string) {
    return this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  getMembership(projectId: string, userId: string) {
    return this.db.prepare(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, userId) as any;
  }

  addMember(projectId: string, userId: string, role: string) {
    return this.db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(projectId, userId, role);
  }

  getMembers(projectId: string) {
    return this.db.prepare(`
      SELECT u.id, u.name, u.email, pm.role
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `).all(projectId) as any[];
  }

  isMember(projectId: string, userId: string): boolean {
    return !!this.db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, userId);
  }
}

export const projectRepository = new ProjectRepository();
