import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getDb, initDatabase, resetDatabase } from '../src/models/database.js';

describe('Comments & Notifications', () => {
  let authToken: string;
  let userId: string;
  let projectId: string;
  let taskId: string;

  let otherToken: string;
  let otherUserId: string;

  beforeEach(async () => {
    resetDatabase();
    initDatabase();

    // Register first user
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@test.com', password: 'password123', name: 'Alice' });
    authToken = res.body.accessToken;
    userId = res.body.user.id;

    // Register second user
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bob@test.com', password: 'password123', name: 'Bob' });
    otherToken = res2.body.accessToken;
    otherUserId = res2.body.user.id;

    // Create project (Alice is owner)
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Project' });
    projectId = projRes.body.project.id;

    // Add Bob as member
    const db = getDb();
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(projectId, otherUserId, 'member');

    // Create a task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Test Task' });
    taskId = taskRes.body.task.id;
  });

  describe('CRUD', () => {
    it('should create a comment', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task_id: taskId, content: 'Hello world' });

      expect(res.status).toBe(201);
      expect(res.body.comment.content).toBe('Hello world');
      expect(res.body.comment.user_name).toBe('Alice');
    });

    it('should list comments for a task', async () => {
      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task_id: taskId, content: 'Comment 1' });

      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ task_id: taskId, content: 'Comment 2' });

      const res = await request(app)
        .get(`/api/comments/task/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.comments.length).toBe(2);
    });

    it('should update own comment', async () => {
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task_id: taskId, content: 'Original' });

      const res = await request(app)
        .put(`/api/comments/${createRes.body.comment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.comment.content).toBe('Updated');
    });

    it('should not update another user\'s comment', async () => {
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task_id: taskId, content: 'Alice comment' });

      const res = await request(app)
        .put(`/api/comments/${createRes.body.comment.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ content: 'Hacked' });

      expect(res.status).toBe(403);
    });

    it('should delete own comment', async () => {
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task_id: taskId, content: 'To delete' });

      const res = await request(app)
        .delete(`/api/comments/${createRes.body.comment.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(204);
    });

    it('should reject comment from non-member', async () => {
      // Register a third user who is NOT a project member
      const res3 = await request(app)
        .post('/api/auth/register')
        .send({ email: 'charlie@test.com', password: 'password123', name: 'Charlie' });

      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${res3.body.accessToken}`)
        .send({ task_id: taskId, content: 'Should fail' });

      expect(res.status).toBe(403);
    });
  });

  describe('@mention notifications', () => {
    it('should create notification when mentioning a project member', async () => {
      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task_id: taskId, content: 'Hey @Bob check this out' });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBe(1);
      expect(res.body.unreadCount).toBe(1);
      expect(res.body.notifications[0].message).toContain('Alice');
      expect(res.body.notifications[0].message).toContain('mentioned you');
    });

    it('should not create notification for self-mention', async () => {
      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task_id: taskId, content: 'Note to @Alice (myself)' });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.body.notifications.length).toBe(0);
    });

    it('should not create notification for non-member mention', async () => {
      // Register Charlie but don't add to project
      const res3 = await request(app)
        .post('/api/auth/register')
        .send({ email: 'charlie@test.com', password: 'password123', name: 'Charlie' });

      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task_id: taskId, content: 'Hey @Charlie should not notify' });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${res3.body.accessToken}`);

      expect(res.body.notifications.length).toBe(0);
    });

    it('should mark notification as read', async () => {
      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task_id: taskId, content: 'Hey @Bob' });

      const notifRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${otherToken}`);

      const notifId = notifRes.body.notifications[0].id;

      await request(app)
        .put(`/api/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${otherToken}`);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.body.unreadCount).toBe(0);
      expect(res.body.notifications[0].read).toBe(1);
    });

    it('should mark all notifications as read', async () => {
      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task_id: taskId, content: 'Hey @Bob first' });

      await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task_id: taskId, content: 'Hey @Bob second' });

      await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${otherToken}`);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.body.unreadCount).toBe(0);
    });
  });
});
