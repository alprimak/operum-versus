import type Database from 'better-sqlite3';
import { getDb } from '../models/database.js';

export class AuthRepository {
  private readonly getDatabase: () => Database.Database;
  constructor(db?: Database.Database) {
    this.getDatabase = db ? () => db : () => getDb();
  }

  findUserIdByEmail(email: string): { id: string } | undefined {
    return this.getDatabase().prepare('SELECT id FROM users WHERE email = ?').get(email) as
      | { id: string }
      | undefined;
  }

  createUser(id: string, email: string, passwordHash: string, name: string): void {
    this.getDatabase().prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
      .run(id, email, passwordHash, name);
  }

  findUserByEmail(email: string): any {
    return this.getDatabase().prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  findUserProfileById(userId: string): any {
    return this.getDatabase().prepare('SELECT id, email, name, created_at FROM users WHERE id = ?')
      .get(userId);
  }
}
