import Database from 'better-sqlite3';
import { getDb } from '../models/database.js';

export class UserRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDb();
  }

  findByEmail(email: string) {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  }

  findById(id: string) {
    return this.db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(id) as any;
  }

  create(id: string, email: string, passwordHash: string, name: string) {
    this.db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
      .run(id, email, passwordHash, name);
  }

  isMemberOf(projectId: string, userId: string) {
    return !!this.db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, userId);
  }

  getMemberRole(projectId: string, userId: string) {
    return this.db.prepare(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, userId) as { role: string } | undefined;
  }
}
