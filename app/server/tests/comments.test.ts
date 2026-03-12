import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getDb, initDatabase, resetDatabase } from '../src/models/database.js';

describe('Task Comments', () => {
  let authToken: string;
  let projectId: string;
  let taskId: string;

  beforeEach(async () => {
    resetDatabase();
    initDatabase();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'password123', name: 'TestUser' });
    authToken = res.body.accessToken;

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

  it('should create a comment', async () => {
    const res = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'This is a comment' });

    expect(res.status).toBe(201);
    expect(res.body.comment.content).toBe('This is a comment');
    expect(res.body.comment.user_name).toBe('TestUser');
  });

  it('should list comments for a task', async () => {
    await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Comment 1' });
    await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Comment 2' });

    const res = await request(app)
      .get(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.comments.length).toBe(2);
  });

  it('should update own comment', async () => {
    const createRes = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Original' });

    const res = await request(app)
      .put(`/api/tasks/${taskId}/comments/${createRes.body.comment.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.comment.content).toBe('Updated');
  });

  it('should delete own comment', async () => {
    const createRes = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'To delete' });

    const res = await request(app)
      .delete(`/api/tasks/${taskId}/comments/${createRes.body.comment.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(204);
  });

  it('should create notification on @mention', async () => {
    // Register second user and add to project
    const user2Res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bob@test.com', password: 'password123', name: 'Bob' });
    const user2Token = user2Res.body.accessToken;

    const db = getDb();
    const bob = db.prepare('SELECT id FROM users WHERE email = ?').get('bob@test.com') as any;
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(projectId, bob.id, 'member');

    // Post comment with @mention
    await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Hey @Bob check this out' });

    // Check Bob's notifications
    const notifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user2Token}`);

    expect(notifRes.body.notifications.length).toBe(1);
    expect(notifRes.body.notifications[0].type).toBe('mention');
    expect(notifRes.body.notifications[0].message).toContain('mentioned you');
  });

  it('should not notify non-project-members on @mention', async () => {
    // Register second user but do NOT add to project
    const user2Res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'outsider@test.com', password: 'password123', name: 'Outsider' });
    const user2Token = user2Res.body.accessToken;

    await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Hey @Outsider look at this' });

    const notifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user2Token}`);

    expect(notifRes.body.notifications.length).toBe(0);
  });

  it('should return 403 for non-project-member accessing comments', async () => {
    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@test.com', password: 'password123', name: 'Other' });

    const res = await request(app)
      .get(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${otherRes.body.accessToken}`);

    expect(res.status).toBe(403);
  });
});
