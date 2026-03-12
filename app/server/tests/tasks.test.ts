import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDatabase, resetDatabase } from '../src/models/database.js';

describe('Tasks', () => {
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

  describe('assignee validation', () => {
    it('should allow assigning a project member', async () => {
      const taskRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ project_id: projectId, title: 'Test Task' });

      const updateRes = await request(app)
        .put(`/api/tasks/${taskRes.body.task.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ assignee_id: userId });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.task.assignee_id).toBe(userId);
      expect(updateRes.body.task.assignee_name).toBe('Test User');
    });

    it('should reject assigning a non-member', async () => {
      // Register another user who is NOT a member of the project
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({ email: 'other@test.com', password: 'password123', name: 'Other User' });
      const otherUserId = otherRes.body.user.id;

      const taskRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ project_id: projectId, title: 'Test Task' });

      const updateRes = await request(app)
        .put(`/api/tasks/${taskRes.body.task.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ assignee_id: otherUserId });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.error).toBe('Assignee is not a member of this project');
    });

    it('should allow clearing assignee (setting to null)', async () => {
      const taskRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ project_id: projectId, title: 'Test Task', assignee_id: userId });

      const updateRes = await request(app)
        .put(`/api/tasks/${taskRes.body.task.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ assignee_id: null });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.task.assignee_id).toBeNull();
    });

    it('should persist assignee after update', async () => {
      const taskRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ project_id: projectId, title: 'Test Task' });

      await request(app)
        .put(`/api/tasks/${taskRes.body.task.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ assignee_id: userId });

      // Fetch tasks for project and verify assignee persisted
      const listRes = await request(app)
        .get(`/api/tasks/project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const task = listRes.body.tasks.find((t: any) => t.id === taskRes.body.task.id);
      expect(task.assignee_id).toBe(userId);
      expect(task.assignee_name).toBe('Test User');
    });
  });
});
