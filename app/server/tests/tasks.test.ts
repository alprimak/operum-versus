import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getDb, initDatabase, resetDatabase } from '../src/models/database.js';

describe('Tasks', () => {
  let ownerToken: string;
  let assigneeId: string;
  let sourceProjectId: string;
  let targetProjectId: string;

  beforeEach(async () => {
    resetDatabase();
    initDatabase();

    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'owner@test.com', password: 'password123', name: 'Owner User' });
    ownerToken = ownerRes.body.accessToken;

    const assigneeRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'assignee@test.com', password: 'password123', name: 'Assignee User' });
    assigneeId = assigneeRes.body.user.id;

    const sourceProjectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Source Project' });
    sourceProjectId = sourceProjectRes.body.project.id;

    const targetProjectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Target Project' });
    targetProjectId = targetProjectRes.body.project.id;

    const db = getDb();
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(sourceProjectId, assigneeId, 'member');
  });

  it('returns 400 when assignee is not a member of the target project', async () => {
    const createTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        project_id: sourceProjectId,
        title: 'Cross-project task',
        assignee_id: assigneeId,
      });

    const taskId = createTaskRes.body.task.id;

    const updateRes = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ project_id: targetProjectId });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error).toBe('Assignee must be a member of the target project');
  });

  it('keeps assignee when switching to a project where they are a member', async () => {
    const db = getDb();
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(targetProjectId, assigneeId, 'member');

    const createTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        project_id: sourceProjectId,
        title: 'Move me',
        assignee_id: assigneeId,
      });

    const taskId = createTaskRes.body.task.id;

    const updateRes = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ project_id: targetProjectId });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.task.project_id).toBe(targetProjectId);
    expect(updateRes.body.task.assignee_id).toBe(assigneeId);
  });
});
