import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDb } from '../models/database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

export const taskRouter = Router();
taskRouter.use(authenticateToken);

const createTaskSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
});

const updateTaskSchema = z.object({
  project_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

function normalizeDueDate(
  value: string | null | undefined
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}T00:00:00.000Z`;
  }

  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('Invalid due_date');
  }

  return parsedDate.toISOString();
}

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
    const normalizedDueDate = normalizeDueDate(data.due_date);

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
      INSERT INTO tasks (id, project_id, title, description, priority, assignee_id, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.project_id, data.title, data.description || null,
      data.priority || 'medium', data.assignee_id || null, normalizedDueDate ?? null, req.userId);

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

    const nextProjectId = updates.project_id ?? task.project_id;
    const nextAssigneeId =
      updates.assignee_id !== undefined ? updates.assignee_id : task.assignee_id;

    if (nextAssigneeId) {
      const assigneeMember = db.prepare(
        'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
      ).get(nextProjectId, nextAssigneeId);

      if (!assigneeMember) {
        res.status(400).json({ error: 'Assignee must be a member of the target project' });
        return;
      }
    }

    const normalizedUpdates = {
      ...updates,
      due_date:
        updates.due_date !== undefined ? normalizeDueDate(updates.due_date) : undefined,
    };

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(normalizedUpdates)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      res.json({ task });
      return;
    }

    fields.push("updated_at = datetime('now')");
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
    if (err instanceof Error && err.message === 'Invalid due_date') {
      res.status(400).json({ error: 'Invalid due_date' });
      return;
    }
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
