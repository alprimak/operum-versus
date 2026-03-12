import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDatabase, resetDatabase } from '../src/models/database.js';

describe('Date Handling', () => {
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

  it('should normalize due_date to YYYY-MM-DD on create', async () => {
    // Send a date with timezone info that could cause off-by-one
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: projectId,
        title: 'Timezone Task',
        due_date: '2024-03-15T23:00:00.000Z',
      });

    expect(res.status).toBe(201);
    // Should be normalized to date-only, not shifted
    expect(res.body.task.due_date).toBe('2024-03-15');
  });

  it('should normalize due_date to YYYY-MM-DD on update', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Task' });
    const taskId = createRes.body.task.id;

    const updateRes = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ due_date: '2024-06-30T22:00:00-05:00' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.task.due_date).toBe('2024-06-30');
  });

  it('should store plain date strings unchanged', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: projectId,
        title: 'Plain Date',
        due_date: '2024-12-25',
      });

    expect(res.status).toBe(201);
    expect(res.body.task.due_date).toBe('2024-12-25');
  });
});
