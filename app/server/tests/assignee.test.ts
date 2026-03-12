import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getDb, initDatabase, resetDatabase } from '../src/models/database.js';

describe('Task Assignee Validation', () => {
  let authToken: string;
  let userId: string;
  let projectId: string;
  let taskId: string;

  beforeEach(async () => {
    resetDatabase();
    initDatabase();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'owner@test.com', password: 'password123', name: 'Owner' });
    authToken = res.body.accessToken;
    userId = res.body.user.id;

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Project' });
    projectId = projRes.body.project.id;

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Test Task' });
    taskId = taskRes.body.task.id;
  });

  it('should allow assigning a project member', async () => {
    // Register a second user and add to project
    const memberRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'member@test.com', password: 'password123', name: 'Member' });
    const memberId = memberRes.body.user.id;

    // Add member to project directly via DB
    const db = getDb();
    db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)').run(projectId, memberId);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ assignee_id: memberId });

    expect(res.status).toBe(200);
    expect(res.body.task.assignee_id).toBe(memberId);
  });

  it('should reject assigning a non-project-member as assignee', async () => {
    // Register a user but do NOT add to project
    const nonMemberRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'outsider@test.com', password: 'password123', name: 'Outsider' });
    const nonMemberId = nonMemberRes.body.user.id;

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ assignee_id: nonMemberId });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('member');
  });

  it('should allow clearing the assignee (null)', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ assignee_id: null });

    expect(res.status).toBe(200);
    expect(res.body.task.assignee_id).toBeNull();
  });

  it('should not return soft-deleted tasks in project task list', async () => {
    // Delete the task
    await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`);

    // List tasks
    const res = await request(app)
      .get(`/api/tasks/project/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(0);
  });
});
