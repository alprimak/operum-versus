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

const searchTaskSchema = z.object({
  query: z.string().trim().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
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

const commentSchema = z.object({
  content: z.string().min(1).max(5000),
});

function extractMentions(content: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
  const mentions = new Set<string>();
  let match: RegExpExecArray | null = mentionRegex.exec(content);

  while (match) {
    mentions.add(match[1]);
    match = mentionRegex.exec(content);
  }

  return [...mentions];
}

function getTaskWithMembership(taskId: string, userId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT t.*
    FROM tasks t
    JOIN project_members pm ON pm.project_id = t.project_id
    WHERE t.id = ? AND pm.user_id = ? AND t.deleted_at IS NULL
  `).get(taskId, userId) as any;
}

function getMentionedUsersForProject(projectId: string, mentions: string[]): any[] {
  if (mentions.length === 0) return [];
  const db = getDb();
  const placeholders = mentions.map(() => '?').join(', ');

  return db.prepare(`
    SELECT u.id, u.name
    FROM users u
    JOIN project_members pm ON pm.user_id = u.id
    WHERE pm.project_id = ?
      AND u.name IN (${placeholders})
  `).all(projectId, ...mentions) as any[];
}

function createMentionNotifications(
  projectId: string,
  commentId: string,
  content: string,
  authorId: string
): void {
  const mentions = extractMentions(content);
  if (mentions.length === 0) return;

  const db = getDb();
  const mentionedUsers = getMentionedUsersForProject(projectId, mentions);
  const matchedNames = new Set(mentionedUsers.map((u) => u.name));
  const invalidMentions = mentions.filter((mention) => !matchedNames.has(mention));

  if (invalidMentions.length > 0) {
    throw new Error('Only project members can be mentioned');
  }

  const insertNotification = db.prepare(`
    INSERT INTO notifications (id, user_id, type, reference_id, message)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const user of mentionedUsers) {
    if (user.id === authorId) continue;
    insertNotification.run(
      uuidv4(),
      user.id,
      'mention',
      commentId,
      `You were mentioned in a task comment`
    );
  }
}
taskRouter.get('/search', (req: AuthRequest, res: Response) => {
  try {
    const parsed = searchTaskSchema.parse(req.query);
    const db = getDb();
    const where: string[] = ['pm.user_id = ?', 't.deleted_at IS NULL'];
    const params: any[] = [req.userId];

    if (parsed.project_id) {
      where.push('t.project_id = ?');
      params.push(parsed.project_id);
    }
    if (parsed.status) {
      where.push('t.status = ?');
      params.push(parsed.status);
    }
    if (parsed.priority) {
      where.push('t.priority = ?');
      params.push(parsed.priority);
    }
    if (parsed.assignee) {
      where.push('t.assignee_id = ?');
      params.push(parsed.assignee);
    }
    if (parsed.query && parsed.query.length > 0) {
      const searchTerm = `%${parsed.query}%`;
      where.push('(t.title LIKE ? OR COALESCE(t.description, \'\') LIKE ?)');
      params.push(searchTerm, searchTerm);
    }

    const tasks = db.prepare(`
      SELECT
        t.*,
        u.name as assignee_name,
        p.name as project_name
      FROM tasks t
      INNER JOIN project_members pm ON pm.project_id = t.project_id
      INNER JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY t.created_at DESC
    `).all(...params);

    res.json({ tasks });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
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

taskRouter.get('/:taskId/comments', (req: AuthRequest, res: Response) => {
  const task = getTaskWithMembership(req.params.taskId, req.userId!);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const db = getDb();
  const comments = db.prepare(`
    SELECT c.*, u.name AS author_name
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.taskId);

  res.json({ comments });
});

taskRouter.post('/:taskId/comments', (req: AuthRequest, res: Response) => {
  try {
    const { content } = commentSchema.parse(req.body);
    const task = getTaskWithMembership(req.params.taskId, req.userId!);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const db = getDb();
    const commentId = uuidv4();
    db.prepare(`
      INSERT INTO comments (id, task_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `).run(commentId, req.params.taskId, req.userId, content);

    try {
      createMentionNotifications(task.project_id, commentId, content, req.userId!);
    } catch (err) {
      db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
      if (err instanceof Error && err.message === 'Only project members can be mentioned') {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const comment = db.prepare(`
      SELECT c.*, u.name AS author_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `).get(commentId);

    res.status(201).json({ comment });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

taskRouter.put('/:taskId/comments/:commentId', (req: AuthRequest, res: Response) => {
  try {
    const { content } = commentSchema.parse(req.body);
    const task = getTaskWithMembership(req.params.taskId, req.userId!);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const db = getDb();
    const existingComment = db.prepare(`
      SELECT id, user_id
      FROM comments
      WHERE id = ? AND task_id = ?
    `).get(req.params.commentId, req.params.taskId) as any;

    if (!existingComment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (existingComment.user_id !== req.userId) {
      res.status(403).json({ error: 'Only comment author can edit' });
      return;
    }

    db.prepare(`
      UPDATE comments
      SET content = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(content, req.params.commentId);

    createMentionNotifications(task.project_id, req.params.commentId, content, req.userId!);

    const comment = db.prepare(`
      SELECT c.*, u.name AS author_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `).get(req.params.commentId);

    res.json({ comment });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    if (err instanceof Error && err.message === 'Only project members can be mentioned') {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

taskRouter.delete('/:taskId/comments/:commentId', (req: AuthRequest, res: Response) => {
  const task = getTaskWithMembership(req.params.taskId, req.userId!);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const db = getDb();
  const existingComment = db.prepare(`
    SELECT id, user_id
    FROM comments
    WHERE id = ? AND task_id = ?
  `).get(req.params.commentId, req.params.taskId) as any;

  if (!existingComment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  if (existingComment.user_id !== req.userId) {
    res.status(403).json({ error: 'Only comment author can delete' });
    return;
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.commentId);
  res.status(204).send();
});
