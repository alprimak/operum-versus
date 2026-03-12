import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getDb, initDatabase, resetDatabase } from '../src/models/database.js';

describe('Task Assignee Validation', () => {
  let authToken: string;
  let projectId: string;
  let userId: string;

  beforeEach(async () => {
    resetDatabase();
    initDatabase();

    // Register primary user
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'password123', name: 'Test User' });
    authToken = res.body.accessToken;
    userId = res.body.user?.id;

    // Create project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Project' });
    projectId = projRes.body.project.id;
  });

  it('should persist assignee after update', async () => {
    // Create a task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Test Task' });
    const taskId = taskRes.body.task.id;

    // The creating user is a project member, assign to self
    const db = getDb();
    const me = db.prepare('SELECT id FROM users WHERE email = ?').get('test@test.com') as any;

    const updateRes = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ assignee_id: me.id });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.task.assignee_id).toBe(me.id);

    // Read back to verify persistence
    const readRes = await request(app)
      .get(`/api/tasks/project/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const found = readRes.body.tasks.find((t: any) => t.id === taskId);
    expect(found.assignee_id).toBe(me.id);
  });

  it('should reject assignee who is not a project member', async () => {
    // Register a second user (not a member of the project)
    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@test.com', password: 'password123', name: 'Other User' });
    const otherToken = otherRes.body.accessToken;
    const db = getDb();
    const otherUser = db.prepare('SELECT id FROM users WHERE email = ?').get('other@test.com') as any;

    // Create task in original user's project
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Test Task' });
    const taskId = taskRes.body.task.id;

    // Try to assign to non-member
    const updateRes = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ assignee_id: otherUser.id });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error).toContain('not a member');
  });

  it('should allow clearing assignee with null', async () => {
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Test Task' });
    const taskId = taskRes.body.task.id;

    // Assign first
    const db = getDb();
    const me = db.prepare('SELECT id FROM users WHERE email = ?').get('test@test.com') as any;
    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ assignee_id: me.id });

    // Clear assignee
    const clearRes = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ assignee_id: null });

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.task.assignee_id).toBeNull();
  });
});
