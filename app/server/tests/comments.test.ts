import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getDb, initDatabase, resetDatabase } from '../src/models/database.js';

describe('Comments and Notifications', () => {
  let authToken: string;
  let userId: string;
  let projectId: string;
  let taskId: string;

  beforeEach(async () => {
    resetDatabase();
    initDatabase();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'author@test.com', password: 'password123', name: 'Author' });
    authToken = res.body.accessToken;
    userId = res.body.user.id;

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Comments Project' });
    projectId = projRes.body.project.id;

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Commented Task' });
    taskId = taskRes.body.task.id;
  });

  it('should create a comment on a task', async () => {
    const res = await request(app)
      .post(`/api/comments/task/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'This is a comment' });

    expect(res.status).toBe(201);
    expect(res.body.comment.content).toBe('This is a comment');
    expect(res.body.comment.author_name).toBe('Author');
  });

  it('should list comments for a task', async () => {
    await request(app)
      .post(`/api/comments/task/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'First comment' });

    await request(app)
      .post(`/api/comments/task/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Second comment' });

    const res = await request(app)
      .get(`/api/comments/task/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(2);
  });

  it('should create notification when a project member is @mentioned', async () => {
    // Register a second user and add to project
    const memberRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'member@test.com', password: 'password123', name: 'Bob' });
    const memberToken = memberRes.body.accessToken;
    const memberId = memberRes.body.user.id;

    const db = getDb();
    db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)').run(projectId, memberId);

    // Author mentions Bob
    await request(app)
      .post(`/api/comments/task/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Hey @Bob please review this' });

    // Bob should have a notification
    const notifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(notifRes.status).toBe(200);
    expect(notifRes.body.unreadCount).toBe(1);
    expect(notifRes.body.notifications[0].type).toBe('mention');
    expect(notifRes.body.notifications[0].message).toContain('Author');
  });

  it('should not create notification when mentioning a non-member', async () => {
    // Register a user but do NOT add to project
    const outsiderRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'outsider@test.com', password: 'password123', name: 'Charlie' });
    const outsiderId = outsiderRes.body.user.id;

    await request(app)
      .post(`/api/comments/task/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Hey @Charlie' });

    const db = getDb();
    const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ?').all(outsiderId);
    expect(notifications).toHaveLength(0);
  });

  it('should delete own comment', async () => {
    const createRes = await request(app)
      .post(`/api/comments/task/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Delete me' });
    const commentId = createRes.body.comment.id;

    const deleteRes = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(deleteRes.status).toBe(204);
  });

  it('should not allow deleting another user comment', async () => {
    const createRes = await request(app)
      .post(`/api/comments/task/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Author comment' });
    const commentId = createRes.body.comment.id;

    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@test.com', password: 'password123', name: 'Other' });
    const otherToken = otherRes.body.accessToken;
    const otherId = otherRes.body.user.id;
    const db = getDb();
    db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)').run(projectId, otherId);

    const deleteRes = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(deleteRes.status).toBe(403);
  });

  it('should return 403 for non-member trying to comment', async () => {
    const outsiderRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'outside@test.com', password: 'password123', name: 'Outsider' });
    const outsiderToken = outsiderRes.body.accessToken;

    const res = await request(app)
      .post(`/api/comments/task/${taskId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ content: 'Sneaky comment' });

    expect(res.status).toBe(403);
  });

  it('should mark notifications as read', async () => {
    const memberRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dave@test.com', password: 'password123', name: 'Dave' });
    const memberToken = memberRes.body.accessToken;
    const memberId = memberRes.body.user.id;

    const db = getDb();
    db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)').run(projectId, memberId);

    await request(app)
      .post(`/api/comments/task/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: '@Dave check this out' });

    await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${memberToken}`);

    const notifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(notifRes.body.unreadCount).toBe(0);
  });
});
