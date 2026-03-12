import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDatabase, resetDatabase } from '../src/models/database.js';

describe('Date Normalization (B5)', () => {
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

  it('should store due date as YYYY-MM-DD regardless of input format', async () => {
    // Simulate a date with timezone info (as a date picker might send)
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: projectId,
        title: 'Task with TZ date',
        due_date: '2025-06-15T00:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.task.due_date).toBe('2025-06-15');
  });

  it('should normalize date on update too', async () => {
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Task' });

    const updateRes = await request(app)
      .put(`/api/tasks/${taskRes.body.task.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ due_date: '2025-12-31T23:59:59.999Z' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.task.due_date).toBe('2025-12-31');
  });

  it('should handle plain YYYY-MM-DD date', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: projectId,
        title: 'Simple date task',
        due_date: '2025-03-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.task.due_date).toBe('2025-03-15');
  });

  it('should handle null due date', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: projectId,
        title: 'No date task',
      });

    expect(res.status).toBe(201);
    expect(res.body.task.due_date).toBeNull();
  });
});
