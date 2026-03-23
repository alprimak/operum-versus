import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDatabase, resetDatabase } from '../src/models/database.js';
import { resetRefreshTokenStore } from '../src/middleware/auth.js';

describe('Activity Feed', () => {
  let authToken: string;
  let projectId: string;
  let taskId: string;

  beforeEach(async () => {
    resetDatabase();
    initDatabase();
    resetRefreshTokenStore();

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'activity@test.com', password: 'password123', name: 'Activity User' });
    authToken = registerRes.body.accessToken;

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Activity Project' });
    projectId = projectRes.body.project.id;

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ project_id: projectId, title: 'Dedup Task' });
    taskId = taskRes.body.task.id;
  });

  it('deduplicates rapid consecutive updates from same user on same task', async () => {
    const firstUpdate = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'in_progress' });
    expect(firstUpdate.status).toBe(200);

    const secondUpdate = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ priority: 'high' });
    expect(secondUpdate.status).toBe(200);

    const activityRes = await request(app)
      .get(`/api/activity/project/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(activityRes.status).toBe(200);

    const updates = activityRes.body.activities.filter(
      (entry: any) => entry.action === 'task_updated' && entry.task_id === taskId
    );

    expect(updates).toHaveLength(1);
    expect(updates[0].details).toContain('priority');
  });
});
