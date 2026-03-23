import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getDb, initDatabase, resetDatabase } from '../src/models/database.js';

describe('Dashboard', () => {
  let authToken: string;
  let projectId: string;

  beforeEach(async () => {
    resetDatabase();
    initDatabase();

    // Register user
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'password123', name: 'Test User' });
    authToken = res.body.accessToken;

    // Create project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Project' });
    projectId = projRes.body.project.id;
  });

  it('should return correct task counts', async () => {
    // Create 3 tasks
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ project_id: projectId, title: `Task ${i}` });
    }

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalTasks).toBe(3);
  });

  // This test SHOULD pass but FAILS due to BUG B2
  it('should not count deleted tasks', async () => {
    // Create 3 tasks
    const taskIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ project_id: projectId, title: `Task ${i}` });
      taskIds.push(res.body.task.id);
    }

    // Delete one task
    await request(app)
      .delete(`/api/tasks/${taskIds[0]}`)
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalTasks).toBe(2);
    expect(res.body.tasksByStatus.todo).toBe(2);
    expect(res.body.tasksByPriority.medium).toBe(2);
  });
});
