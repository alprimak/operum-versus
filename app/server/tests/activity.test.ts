import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDatabase, resetDatabase } from '../src/models/database.js';

describe('Activity Feed', () => {
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

  it('should deduplicate rapid updates to the same task', async () => {
    // Create a task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Test Task' });
    const taskId = taskRes.body.task.id;

    // Rapidly update the same task's status multiple times
    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'in_progress' });

    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'review' });

    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'done' });

    const actRes = await request(app)
      .get(`/api/activity/project/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    // Should have: 1 task_created + 1 deduplicated task_updated = 2 entries
    // (not 1 task_created + 3 task_updated = 4 entries)
    const taskActivities = actRes.body.activities.filter(
      (a: any) => a.task_id === taskId
    );
    expect(taskActivities.length).toBe(2);
  });

  it('should not deduplicate different actions on the same task', async () => {
    // Create a task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Test Task' });
    const taskId = taskRes.body.task.id;

    // Update then delete — different actions, should not dedup
    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'done' });

    await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const actRes = await request(app)
      .get(`/api/activity/project/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const taskActivities = actRes.body.activities.filter(
      (a: any) => a.task_id === taskId
    );
    // task_created + task_updated + task_deleted = 3
    expect(taskActivities.length).toBe(3);
  });
});
