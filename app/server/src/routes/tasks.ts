import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDb } from '../models/database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

export const taskRouter = Router();
taskRouter.use(authenticateToken);

taskRouter.get('/search', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const { query, status, priority, assignee_id, project_id } = req.query as Record<string, string>;

  // Must specify a project_id to search within
  if (!project_id) {
    res.status(400).json({ error: 'project_id is required' });
    return;
  }

  // Verify membership
  const member = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(project_id, req.userId);

  if (!member) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  const conditions: string[] = ['t.project_id = ?', 't.deleted_at IS NULL'];
  const params: any[] = [project_id];

  if (query) {
    conditions.push('(t.title LIKE ? OR t.description LIKE ?)');
    const likeQuery = `%${query}%`;
    params.push(likeQuery, likeQuery);
  }

  if (status) {
    conditions.push('t.status = ?');
    params.push(status);
  }

  if (priority) {
    conditions.push('t.priority = ?');
    params.push(priority);
  }

  if (assignee_id) {
    conditions.push('t.assignee_id = ?');
    params.push(assignee_id);
  }

  const sql = `
    SELECT t.*, u.name as assignee_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY t.created_at DESC
  `;

  const tasks = db.prepare(sql).all(...params);
  res.json({ tasks });
});

const createTaskSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

taskRouter.get('/project/:projectId', (req: AuthRequest, res: Response) => {
  const db = getDb();

  // Verify membership
  const member = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.projectId, req.userId);

  if (!member) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  // BUG B1: When fetching tasks, assignee_id is selected but not joined with
  // user data, and on the frontend the assignee dropdown resets because
  // the response doesn't include the assignee name. Additionally, when
  // switching projects, the task list briefly shows tasks from the previous
  // project because the query doesn't properly filter by the new project_id
  // when there's a race condition in the request.
  const tasks = db.prepare(`
    SELECT t.*, u.name as assignee_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.project_id = ?
    ORDER BY t.created_at DESC
  `).all(req.params.projectId);

  res.json({ tasks });
});

taskRouter.post('/', (req: AuthRequest, res: Response) => {
  try {
    const data = createTaskSchema.parse(req.body);
    const db = getDb();

    // Verify membership
    const member = db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(data.project_id, req.userId);

    if (!member) {
      res.status(403).json({ error: 'Not a member of this project' });
      return;
    }

    const id = uuidv4();

    db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.project_id, data.title, data.description || null,
      data.status || 'todo', data.priority || 'medium', data.assignee_id || null, data.due_date || null, req.userId);

    logActivity(data.project_id, id, req.userId!, 'task_created', `Created task "${data.title}"`);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.status(201).json({ task });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

taskRouter.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const updates = updateTaskSchema.parse(req.body);
    const db = getDb();

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify membership
    const member = db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(task.project_id, req.userId);

    if (!member) {
      res.status(403).json({ error: 'Not a member of this project' });
      return;
    }

    // BUG B1: The assignee_id update doesn't validate that the assignee
    // is a member of the project. Also, when updating from the frontend
    // after switching projects, the task.project_id here is from the OLD
    // project because the frontend sends stale data.
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      res.json({ task });
      return;
    }

    fields.push('updated_at = datetime("now")');
    values.push(req.params.id);

    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    // BUG B4: Activity logging happens for every field update individually
    // when batch updates come in rapid succession. The frontend sends
    // separate requests for status change and assignee change, causing
    // duplicate activity entries with nearly identical timestamps.
    const changes = Object.keys(updates).join(', ');
    logActivity(task.project_id, req.params.id, req.userId!, 'task_updated',
      `Updated ${changes} on "${task.title}"`);

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json({ task: updatedTask });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

// Soft delete
taskRouter.delete('/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Soft delete — sets deleted_at but doesn't remove the row
  db.prepare("UPDATE tasks SET deleted_at = datetime('now') WHERE id = ?")
    .run(req.params.id);

  logActivity(task.project_id, req.params.id, req.userId!, 'task_deleted',
    `Deleted task "${task.title}"`);

  res.status(204).send();
});
