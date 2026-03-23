import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getDb, initDatabase, resetDatabase } from '../src/models/database.js';

describe('Task comments and mentions', () => {
  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let memberId: string;
  let outsiderId: string;
  let taskId: string;
  let projectId: string;

  beforeEach(async () => {
    resetDatabase();
    initDatabase();

    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'owner@test.com', password: 'password123', name: 'owner' });
    ownerToken = ownerRes.body.accessToken;

    const memberRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'member@test.com', password: 'password123', name: 'member' });
    memberToken = memberRes.body.accessToken;
    memberId = memberRes.body.user.id;

    const outsiderRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'outsider@test.com', password: 'password123', name: 'outsider' });
    outsiderToken = outsiderRes.body.accessToken;
    outsiderId = outsiderRes.body.user.id;

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Comments Project' });
    projectId = projectRes.body.project.id;

    const db = getDb();
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(projectId, memberId, 'member');

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ project_id: projectId, title: 'Task with comments' });
    taskId = taskRes.body.task.id;
  });

  it('creates, lists, updates, and deletes comments for project members', async () => {
    const createRes = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'First comment' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.comment.content).toBe('First comment');

    const listRes = await request(app)
      .get(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.comments).toHaveLength(1);

    const commentId = createRes.body.comment.id;
    const updateRes = await request(app)
      .put(`/api/tasks/${taskId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'Updated comment' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.comment.content).toBe('Updated comment');

    const deleteRes = await request(app)
      .delete(`/api/tasks/${taskId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(deleteRes.status).toBe(204);
  });

  it('creates mention notifications for mentioned project members', async () => {
    const res = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: 'Please review this @member' });

    expect(res.status).toBe(201);

    const notificationsRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(notificationsRes.status).toBe(200);
    expect(notificationsRes.body.unreadCount).toBe(1);
    expect(notificationsRes.body.notifications[0].type).toBe('mention');
  });

  it('rejects mentions of users who are not project members', async () => {
    const res = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: 'Tagging @outsider should fail' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Only project members can be mentioned');
  });

  it('forbids non-authors from editing or deleting comments', async () => {
    const createRes = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'Author-owned comment' });
    const commentId = createRes.body.comment.id;

    const editRes = await request(app)
      .put(`/api/tasks/${taskId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: 'Should not be allowed' });
    expect(editRes.status).toBe(403);

    const deleteRes = await request(app)
      .delete(`/api/tasks/${taskId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(deleteRes.status).toBe(403);
  });

  it('prevents non-members from commenting on a task', async () => {
    const outsiderCommentRes = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ content: 'I am not in this project' });

    expect(outsiderCommentRes.status).toBe(404);
  });

  it('can mark notifications as read', async () => {
    await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: 'Please review this @member' });

    const listRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${memberToken}`);
    const notificationId = listRes.body.notifications[0].id;

    const markReadRes = await request(app)
      .put(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(markReadRes.status).toBe(204);

    const unreadRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(unreadRes.body.unreadCount).toBe(0);

    const db = getDb();
    const row = db.prepare('SELECT read FROM notifications WHERE id = ?').get(notificationId) as { read: number };
    expect(row.read).toBe(1);
  });

  it('does not create self-mention notifications', async () => {
    const res = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'I can mention myself @member' });

    expect(res.status).toBe(201);

    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?')
      .get(memberId) as { count: number };
    expect(count.count).toBe(0);
  });
});
