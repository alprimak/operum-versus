import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getDb, initDatabase, resetDatabase } from '../src/models/database.js';

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
      .send({ name: 'Test Project' });
    projectId = projRes.body.project.id;
  });

  it('should export tasks as CSV with correct headers', async () => {
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Task One', priority: 'high' });

    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Task Two', due_date: '2024-06-15' });

    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');

    const lines = res.text.split('\n');
    expect(lines[0]).toBe('Title,Description,Status,Priority,Assignee,Due Date,Created,Updated');
    expect(lines.length).toBe(3); // header + 2 tasks
    expect(res.text).toContain('Task One');
    expect(res.text).toContain('Task Two');
  });

  it('should exclude soft-deleted tasks from CSV', async () => {
    const t1 = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Active Task' });

    const t2 = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Deleted Task' });

    await request(app)
      .delete(`/api/tasks/${t2.body.task.id}`)
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
    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@test.com', password: 'password123', name: 'Other' });

    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${otherRes.body.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('should handle CSV special characters in fields', async () => {
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: projectId,
        title: 'Task with, comma',
        description: 'Has "quotes" and\nnewline',
      });

    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // Fields with special chars should be properly quoted
    expect(res.text).toContain('"Task with, comma"');
    expect(res.text).toContain('"Has ""quotes"" and');
  });
});
