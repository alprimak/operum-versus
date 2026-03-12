import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getDb, initDatabase, resetDatabase } from '../src/models/database.js';

describe('Task Search', () => {
  let authToken: string;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    resetDatabase();
    initDatabase();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'password123', name: 'Test User' });
    authToken = res.body.accessToken;
    userId = res.body.user.id;

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Project' });
    projectId = projRes.body.project.id;

    // Create various tasks
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Fix login bug', priority: 'high', description: 'Auth is broken' });

    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Add search feature', priority: 'medium' });

    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Write docs', priority: 'low', assignee_id: userId });
  });

  it('should return all non-deleted tasks with no filters', async () => {
    const res = await request(app)
      .get('/api/tasks/search')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(3);
  });

  it('should search by text query in title', async () => {
    const res = await request(app)
      .get('/api/tasks/search?q=login')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.tasks[0].title).toBe('Fix login bug');
  });

  it('should search by text query in description', async () => {
    const res = await request(app)
      .get('/api/tasks/search?q=Auth')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.tasks[0].title).toBe('Fix login bug');
  });

  it('should filter by status', async () => {
    const res = await request(app)
      .get('/api/tasks/search?status=todo')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(3); // all are todo by default
  });

  it('should filter by priority', async () => {
    const res = await request(app)
      .get('/api/tasks/search?priority=high')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.tasks[0].title).toBe('Fix login bug');
  });

  it('should filter by assignee', async () => {
    const res = await request(app)
      .get(`/api/tasks/search?assignee=${userId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.tasks[0].title).toBe('Write docs');
  });

  it('should combine multiple filters', async () => {
    const res = await request(app)
      .get(`/api/tasks/search?q=docs&assignee=${userId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.tasks[0].title).toBe('Write docs');
  });

  it('should exclude soft-deleted tasks', async () => {
    // Get tasks to find one to delete
    const listRes = await request(app)
      .get('/api/tasks/search')
      .set('Authorization', `Bearer ${authToken}`);
    const taskToDelete = listRes.body.tasks[0];

    await request(app)
      .delete(`/api/tasks/${taskToDelete.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .get('/api/tasks/search')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.body.tasks.length).toBe(2);
  });

  it('should include project_name and assignee_name in results', async () => {
    const res = await request(app)
      .get(`/api/tasks/search?assignee=${userId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.body.tasks[0].project_name).toBe('Test Project');
    expect(res.body.tasks[0].assignee_name).toBe('Test User');
  });

  it('should return 403 for non-member project filter', async () => {
    // Create another user
    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@test.com', password: 'password123', name: 'Other' });

    const res = await request(app)
      .get(`/api/tasks/search?project_id=${projectId}`)
      .set('Authorization', `Bearer ${other.body.accessToken}`);

    expect(res.status).toBe(403);
  });
});
