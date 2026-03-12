import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDatabase, resetDatabase } from '../src/models/database.js';

describe('Task Search', () => {
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
      .send({ name: 'Search Test Project' });
    projectId = projRes.body.project.id;

    // Create test tasks
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Fix the login bug', status: 'todo', priority: 'high' });

    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Update dashboard UI', description: 'login screen redesign', status: 'in_progress', priority: 'medium' });

    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Write tests', status: 'done', priority: 'low' });
  });

  it('should search by title text', async () => {
    const res = await request(app)
      .get(`/api/tasks/search?project_id=${projectId}&query=login`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2); // "Fix the login bug" and "Update dashboard UI" (description match)
    const titles = res.body.tasks.map((t: any) => t.title);
    expect(titles).toContain('Fix the login bug');
    expect(titles).toContain('Update dashboard UI');
  });

  it('should filter by status', async () => {
    const res = await request(app)
      .get(`/api/tasks/search?project_id=${projectId}&status=done`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].title).toBe('Write tests');
  });

  it('should filter by priority', async () => {
    const res = await request(app)
      .get(`/api/tasks/search?project_id=${projectId}&priority=high`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].title).toBe('Fix the login bug');
  });

  it('should combine query and status filters', async () => {
    const res = await request(app)
      .get(`/api/tasks/search?project_id=${projectId}&query=login&status=todo`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].title).toBe('Fix the login bug');
  });

  it('should return all non-deleted tasks when no filters given', async () => {
    const res = await request(app)
      .get(`/api/tasks/search?project_id=${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(3);
  });

  it('should not include soft-deleted tasks in search results', async () => {
    // Get task id and delete it
    const listRes = await request(app)
      .get(`/api/tasks/project/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);
    const taskId = listRes.body.tasks[0].id;

    await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .get(`/api/tasks/search?project_id=${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2);
  });

  it('should return 400 when project_id is missing', async () => {
    const res = await request(app)
      .get('/api/tasks/search?query=something')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
  });

  it('should return 403 for non-members', async () => {
    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@test.com', password: 'password123', name: 'Other' });
    const otherToken = otherRes.body.accessToken;

    const res = await request(app)
      .get(`/api/tasks/search?project_id=${projectId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});
