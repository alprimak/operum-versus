import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDatabase, resetDatabase } from '../src/models/database.js';

describe('CSV Export', () => {
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
  });

  it('should export tasks as CSV with correct headers', async () => {
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Task 1', priority: 'high' });

    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');

    const lines = res.text.split('\n');
    expect(lines[0]).toBe('Title,Description,Status,Priority,Assignee,Due Date,Created,Updated');
    expect(lines.length).toBe(2); // header + 1 task
    expect(lines[1]).toContain('Task 1');
  });

  it('should exclude soft-deleted tasks from export', async () => {
    const task1 = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Active Task' });

    const task2 = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Deleted Task' });

    await request(app)
      .delete(`/api/tasks/${task2.body.task.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${authToken}`);

    const lines = res.text.split('\n');
    expect(lines.length).toBe(2); // header + 1 active task
    expect(res.text).toContain('Active Task');
    expect(res.text).not.toContain('Deleted Task');
  });

  it('should return 403 for non-members', async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@test.com', password: 'password123', name: 'Other' });

    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${other.body.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('should handle CSV special characters', async () => {
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: projectId,
        title: 'Task with "quotes"',
        description: 'Has, commas and\nnewlines',
      });

    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // Quotes should be escaped as double-quotes
    expect(res.text).toContain('"Task with ""quotes"""');
  });

  it('should include assignee name when assigned', async () => {
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Assigned Task', assignee_id: userId });

    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.text).toContain('Test User');
  });
});
