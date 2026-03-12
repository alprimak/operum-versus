import { getDb } from '../models/database.js';

export class UserRepository {
  private get db() { return getDb(); }

  findById(id: string) {
    return this.db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(id) as any;
  }

  findByEmail(email: string) {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  }

  create(id: string, email: string, passwordHash: string, name: string) {
    return this.db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
      .run(id, email, passwordHash, name);
  }
}

export const userRepository = new UserRepository();
