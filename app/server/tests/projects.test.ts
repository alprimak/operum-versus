import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getDb, initDatabase, resetDatabase } from '../src/models/database.js';

describe('Projects CSV export', () => {
  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let projectId: string;
  let memberId: string;

  beforeEach(async () => {
    resetDatabase();
    initDatabase();

    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'owner.projects@test.com', password: 'password123', name: 'Owner User' });
    ownerToken = ownerRes.body.accessToken;

    const memberRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'member.projects@test.com', password: 'password123', name: 'Member User' });
    memberToken = memberRes.body.accessToken;
    memberId = memberRes.body.user.id;

    const outsiderRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'outsider.projects@test.com', password: 'password123', name: 'Outsider User' });
    outsiderToken = outsiderRes.body.accessToken;

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'CSV Export Project' });
    projectId = projectRes.body.project.id;

    const db = getDb();
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(projectId, memberId, 'member');
  });

  it('exports project tasks as csv for project members and excludes soft-deleted tasks', async () => {
    const firstTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        project_id: projectId,
        title: 'Task with "quotes", commas',
        status: 'todo',
        priority: 'high',
        assignee_id: memberId,
        due_date: '2024-07-01',
      });

    const deletedTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        project_id: projectId,
        title: 'This task should be deleted',
      });

    await request(app)
      .delete(`/api/tasks/${deletedTaskRes.body.task.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const exportRes = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/csv');
    expect(exportRes.headers['content-disposition']).toContain(`attachment; filename="project-${projectId}-tasks.csv"`);

    const lines = exportRes.text.trim().split('\n');
    expect(lines[0]).toBe('id,title,status,priority,assignee,due date,created at');
    expect(lines.length).toBe(2);

    expect(exportRes.text).toContain(firstTaskRes.body.task.id);
    expect(exportRes.text).toContain('"Task with ""quotes"", commas"');
    expect(exportRes.text).toContain('"Member User"');
    expect(exportRes.text).toContain('"2024-07-01T00:00:00.000Z"');
    expect(exportRes.text).not.toContain(deletedTaskRes.body.task.id);
    expect(exportRes.text).not.toContain('This task should be deleted');
  });

  it('returns 403 when user is not a member of the project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not a member of this project');
  });
});
