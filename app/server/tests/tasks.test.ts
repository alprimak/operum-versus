import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDatabase, resetDatabase } from '../src/models/database.js';

describe('Task Due Date Timezone Handling', () => {
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

  it('should store due date as date-only string (no time component)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: projectId,
        title: 'Timezone Test Task',
        due_date: '2024-06-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.task.due_date).toBe('2024-06-15');
  });

  it('should normalize datetime input to date-only (UTC+12 scenario)', async () => {
    // Simulate UTC+12 submitting with timezone offset (date would shift backward for storage)
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: projectId,
        title: 'UTC+12 Task',
        due_date: '2024-06-15T00:00:00+12:00',
      });

    expect(res.status).toBe(201);
    // Should strip time component and store just the date
    expect(res.body.task.due_date).toBe('2024-06-15');
  });

  it('should normalize datetime input to date-only (UTC-12 scenario)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: projectId,
        title: 'UTC-12 Task',
        due_date: '2024-06-15T23:59:59-12:00',
      });

    expect(res.status).toBe(201);
    expect(res.body.task.due_date).toBe('2024-06-15');
  });
});
