import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDatabase, resetDatabase } from '../src/models/database.js';

describe('CSV Export', () => {
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
      .send({ name: 'Export Test Project' });
    projectId = projRes.body.project.id;
  });

  it('should return CSV with correct headers', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);

    const lines = res.text.split('\n');
    expect(lines[0]).toBe('Title,Description,Status,Priority,Assignee,Due Date,Created,Updated');
  });

  it('should include tasks in CSV rows', async () => {
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'My Task', priority: 'high' });

    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const lines = res.text.split('\n');
    expect(lines.length).toBe(2); // header + 1 task
    expect(lines[1]).toContain('My Task');
    expect(lines[1]).toContain('high');
  });

  it('should exclude soft-deleted tasks from CSV', async () => {
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Task to Delete' });
    const taskId = taskRes.body.task.id;

    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Active Task' });

    // Soft delete first task
    await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const lines = res.text.split('\n');
    expect(lines.length).toBe(2); // header + 1 active task only
    expect(res.text).not.toContain('Task to Delete');
    expect(res.text).toContain('Active Task');
  });

  it('should return 403 for non-members', async () => {
    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@test.com', password: 'password123', name: 'Other User' });
    const otherToken = otherRes.body.accessToken;

    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('should handle special characters in CSV values', async () => {
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: projectId,
        title: 'Task with, comma',
        description: 'Has "quotes" inside',
      });

    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // Comma in title should be quoted
    expect(res.text).toContain('"Task with, comma"');
    // Quotes should be escaped
    expect(res.text).toContain('"Has ""quotes"" inside"');
  });
});
