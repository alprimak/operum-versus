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

  async function createTask(
    token: string,
    data: {
      project_id: string;
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      assignee_id?: string;
    }
  ) {
    return request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send(data);
  }

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

  it('stores date-only due_date values as UTC midnight ISO strings', async () => {
    const createTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        project_id: sourceProjectId,
        title: 'Date-only due date',
        due_date: '2024-06-30',
      });

    expect(createTaskRes.status).toBe(201);
    expect(createTaskRes.body.task.due_date).toBe('2024-06-30T00:00:00.000Z');
  });

  it('normalizes due_date updates to UTC midnight for date-only inputs', async () => {
    const createTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        project_id: sourceProjectId,
        title: 'Update date-only due date',
      });

    const taskId = createTaskRes.body.task.id;

    const updateRes = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ due_date: '2024-06-30' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.task.due_date).toBe('2024-06-30T00:00:00.000Z');
  });

  it('searches tasks by text query and includes project context', async () => {
    await createTask(ownerToken, {
      project_id: sourceProjectId,
      title: 'Fix API pagination',
      description: 'Need to fix token handling for next page',
    });
    await createTask(ownerToken, {
      project_id: targetProjectId,
      title: 'Design homepage',
      description: 'Landing page draft',
    });

    const searchRes = await request(app)
      .get('/api/tasks/search')
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({ query: 'pagination' });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.tasks).toHaveLength(1);
    expect(searchRes.body.tasks[0].title).toBe('Fix API pagination');
    expect(searchRes.body.tasks[0].project_name).toBe('Source Project');
  });

  it('filters search results by status', async () => {
    const todoTask = await createTask(ownerToken, {
      project_id: sourceProjectId,
      title: 'Todo item',
    });
    const reviewTask = await createTask(ownerToken, {
      project_id: sourceProjectId,
      title: 'Review item',
    });

    await request(app)
      .put(`/api/tasks/${reviewTask.body.task.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'review' });

    const searchRes = await request(app)
      .get('/api/tasks/search')
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({ status: 'review', project_id: sourceProjectId });

    expect(todoTask.status).toBe(201);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.tasks).toHaveLength(1);
    expect(searchRes.body.tasks[0].title).toBe('Review item');
  });

  it('filters search results by priority', async () => {
    await createTask(ownerToken, {
      project_id: sourceProjectId,
      title: 'Low priority item',
      priority: 'low',
    });
    await createTask(ownerToken, {
      project_id: sourceProjectId,
      title: 'Urgent item',
      priority: 'urgent',
    });

    const searchRes = await request(app)
      .get('/api/tasks/search')
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({ priority: 'urgent', project_id: sourceProjectId });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.tasks).toHaveLength(1);
    expect(searchRes.body.tasks[0].title).toBe('Urgent item');
  });

  it('filters search results by assignee', async () => {
    await createTask(ownerToken, {
      project_id: sourceProjectId,
      title: 'Assigned task',
      assignee_id: assigneeId,
    });
    await createTask(ownerToken, {
      project_id: sourceProjectId,
      title: 'Unassigned task',
    });

    const searchRes = await request(app)
      .get('/api/tasks/search')
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({ assignee: assigneeId, project_id: sourceProjectId });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.tasks).toHaveLength(1);
    expect(searchRes.body.tasks[0].title).toBe('Assigned task');
  });

  it('combines multiple search filters with AND logic', async () => {
    const matchingTask = await createTask(ownerToken, {
      project_id: sourceProjectId,
      title: 'Auth regression',
      description: 'Investigate login timeout',
      priority: 'high',
      assignee_id: assigneeId,
    });
    const nonMatchingTask = await createTask(ownerToken, {
      project_id: sourceProjectId,
      title: 'Auth docs',
      description: 'Update docs for login flow',
      priority: 'low',
      assignee_id: assigneeId,
    });

    await request(app)
      .put(`/api/tasks/${matchingTask.body.task.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'in_progress' });

    await request(app)
      .put(`/api/tasks/${nonMatchingTask.body.task.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'in_progress' });

    const searchRes = await request(app)
      .get('/api/tasks/search')
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({
        query: 'auth',
        status: 'in_progress',
        priority: 'high',
        assignee: assigneeId,
        project_id: sourceProjectId,
      });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.tasks).toHaveLength(1);
    expect(searchRes.body.tasks[0].title).toBe('Auth regression');
  });

  it('excludes soft-deleted tasks from search results', async () => {
    const taskRes = await createTask(ownerToken, {
      project_id: sourceProjectId,
      title: 'Delete me',
      description: 'This task should be excluded after deletion',
    });

    await request(app)
      .delete(`/api/tasks/${taskRes.body.task.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const searchRes = await request(app)
      .get('/api/tasks/search')
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({ query: 'delete me', project_id: sourceProjectId });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.tasks).toHaveLength(0);
  });

  it('returns non-deleted tasks for empty query', async () => {
    await createTask(ownerToken, {
      project_id: sourceProjectId,
      title: 'Visible task',
    });
    const deletedTaskRes = await createTask(ownerToken, {
      project_id: sourceProjectId,
      title: 'Hidden task',
    });

    await request(app)
      .delete(`/api/tasks/${deletedTaskRes.body.task.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const searchRes = await request(app)
      .get('/api/tasks/search')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.tasks.some((task: any) => task.title === 'Visible task')).toBe(true);
    expect(searchRes.body.tasks.some((task: any) => task.title === 'Hidden task')).toBe(false);
  });
});
