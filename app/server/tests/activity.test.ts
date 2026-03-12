import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDatabase, resetDatabase } from '../src/models/database.js';

describe('Activity Deduplication', () => {
  let authToken: string;
  let projectId: string;
  let taskId: string;

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

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Test Task' });
    taskId = taskRes.body.task.id;
  });

  it('should deduplicate rapid consecutive updates to the same task', async () => {
    // Update same task rapidly (same action type)
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

    const activityRes = await request(app)
      .get(`/api/activity/project/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(activityRes.status).toBe(200);
    const taskUpdateEntries = activityRes.body.activities.filter(
      (a: any) => a.action === 'task_updated'
    );
    // Rapid updates should be deduplicated — only 1 entry instead of 3
    expect(taskUpdateEntries.length).toBe(1);
  });

  it('should not deduplicate updates to different tasks', async () => {
    const taskRes2 = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Test Task 2' });
    const taskId2 = taskRes2.body.task.id;

    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'in_progress' });

    await request(app)
      .put(`/api/tasks/${taskId2}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'in_progress' });

    const activityRes = await request(app)
      .get(`/api/activity/project/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const taskUpdateEntries = activityRes.body.activities.filter(
      (a: any) => a.action === 'task_updated'
    );
    // Different tasks should each have their own entry
    expect(taskUpdateEntries.length).toBe(2);
  });
});
