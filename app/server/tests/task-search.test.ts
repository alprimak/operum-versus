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
      .send({ name: 'Test Project' });
    projectId = projRes.body.project.id;

    // Seed tasks
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Fix login bug', priority: 'high' });
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Add dark mode', priority: 'low', description: 'Theme support' });
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Update docs', priority: 'medium' });
  });

  it('should search by text query in title', async () => {
    const res = await request(app)
      .get('/api/tasks/search?query=login')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.tasks[0].title).toBe('Fix login bug');
  });

  it('should search by text query in description', async () => {
    const res = await request(app)
      .get('/api/tasks/search?query=Theme')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.tasks[0].title).toBe('Add dark mode');
  });

  it('should filter by priority', async () => {
    const res = await request(app)
      .get('/api/tasks/search?priority=high')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.tasks[0].title).toBe('Fix login bug');
  });

  it('should combine filters with AND logic', async () => {
    const res = await request(app)
      .get('/api/tasks/search?query=bug&priority=high')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(1);

    // No match: query matches but priority doesn't
    const res2 = await request(app)
      .get('/api/tasks/search?query=bug&priority=low')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res2.body.tasks.length).toBe(0);
  });

  it('should exclude soft-deleted tasks', async () => {
    // Delete one task
    const allTasks = await request(app)
      .get('/api/tasks/search')
      .set('Authorization', `Bearer ${authToken}`);
    const toDelete = allTasks.body.tasks.find((t: any) => t.title === 'Fix login bug');

    await request(app)
      .delete(`/api/tasks/${toDelete.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .get('/api/tasks/search?query=login')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.body.tasks.length).toBe(0);
  });

  it('should return all tasks when no filters provided', async () => {
    const res = await request(app)
      .get('/api/tasks/search')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(3);
  });

  it('should filter by project_id', async () => {
    // Create second project with a task
    const proj2 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Other Project' });
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: proj2.body.project.id, title: 'Other task' });

    const res = await request(app)
      .get(`/api/tasks/search?project_id=${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.body.tasks.length).toBe(3); // Only original project tasks
  });
});
