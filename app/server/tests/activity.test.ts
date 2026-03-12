import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getDb, initDatabase, resetDatabase } from '../src/models/database.js';

describe('Activity Deduplication', () => {
  let authToken: string;
  let projectId: string;

  beforeEach(async () => {
    resetDatabase();
    initDatabase();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'password123', name: 'Test User' });
    authToken = res.body.accessToken;

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Project' });
    projectId = projRes.body.project.id;
  });

  it('should deduplicate rapid updates to the same task', async () => {
    // Create a task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Test Task' });
    const taskId = taskRes.body.task.id;

    // Get activity count after creation (should be 1 for task_created)
    const before = await request(app)
      .get(`/api/activity/project/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);
    const countAfterCreate = before.body.activities.length;

    // Rapidly update the same task multiple times (same action type)
    const db = getDb();
    const me = db.prepare('SELECT id FROM users WHERE email = ?').get('test@test.com') as any;

    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Updated 1' });

    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Updated 2' });

    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Updated 3' });

    // Check activity feed
    const after = await request(app)
      .get(`/api/activity/project/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    // Should have only 1 additional entry (deduplicated), not 3
    const updateEntries = after.body.activities.filter(
      (a: any) => a.action === 'task_updated'
    );
    expect(updateEntries.length).toBe(1);

    // The deduplicated entry should reflect the latest update's details
    expect(updateEntries[0].details).toContain('title');
  });

  it('should keep separate entries for different actions', async () => {
    // Create a task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Test Task' });
    const taskId = taskRes.body.task.id;

    // Update then delete (different actions)
    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Updated' });

    await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .get(`/api/activity/project/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    // Should have 4 entries: project_created, task_created, task_updated, task_deleted
    const actionTypes = res.body.activities.map((a: any) => a.action).sort();
    expect(actionTypes).toEqual(['project_created', 'task_created', 'task_deleted', 'task_updated']);
  });
});
