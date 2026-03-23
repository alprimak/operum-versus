import type Database from 'better-sqlite3';
import { getDb } from '../models/database.js';

export class DashboardRepository {
  private readonly getDatabase: () => Database.Database;
  constructor(db?: Database.Database) {
    this.getDatabase = db ? () => db : () => getDb();
  }

  listProjectIdsForUser(userId: string): string[] {
    const projectIds = this.getDatabase().prepare(`
      SELECT project_id FROM project_members WHERE user_id = ?
    `).all(userId) as Array<{ project_id: string }>;
    return projectIds.map((p) => p.project_id);
  }

  getTotalTasks(projectIds: string[]): number {
    const placeholders = projectIds.map(() => '?').join(',');
    const totalTasks = this.getDatabase().prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE project_id IN (${placeholders})
      AND deleted_at IS NULL
    `).get(...projectIds) as { count: number };
    return totalTasks.count;
  }

  getCompletedTasks(projectIds: string[]): number {
    const placeholders = projectIds.map(() => '?').join(',');
    const completedTasks = this.getDatabase().prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE project_id IN (${placeholders})
      AND status = 'done'
      AND deleted_at IS NULL
    `).get(...projectIds) as { count: number };
    return completedTasks.count;
  }

  getOverdueTasks(projectIds: string[]): number {
    const placeholders = projectIds.map(() => '?').join(',');
    const overdueTasks = this.getDatabase().prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE project_id IN (${placeholders})
      AND due_date < datetime('now')
      AND status != 'done'
      AND deleted_at IS NULL
    `).get(...projectIds) as { count: number };
    return overdueTasks.count;
  }

  getTasksByStatus(projectIds: string[]): Array<{ status: string; count: number }> {
    const placeholders = projectIds.map(() => '?').join(',');
    return this.getDatabase().prepare(`
      SELECT status, COUNT(*) as count FROM tasks
      WHERE project_id IN (${placeholders})
      AND deleted_at IS NULL
      GROUP BY status
    `).all(...projectIds) as Array<{ status: string; count: number }>;
  }

  getTasksByPriority(projectIds: string[]): Array<{ priority: string; count: number }> {
    const placeholders = projectIds.map(() => '?').join(',');
    return this.getDatabase().prepare(`
      SELECT priority, COUNT(*) as count FROM tasks
      WHERE project_id IN (${placeholders})
      AND deleted_at IS NULL
      GROUP BY priority
    `).all(...projectIds) as Array<{ priority: string; count: number }>;
  }
}
