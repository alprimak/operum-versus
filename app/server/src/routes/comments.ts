import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDb } from '../models/database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const commentRouter = Router();
commentRouter.use(authenticateToken);

const createCommentSchema = z.object({
  task_id: z.string().uuid(),
  content: z.string().min(1).max(5000),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

function parseMentions(content: string): string[] {
  const mentionRegex = /@(\w+(?:\.\w+)*@\w+(?:\.\w+)+|\w+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  return [...new Set(mentions)];
}

function createMentionNotifications(
  mentions: string[],
  taskId: string,
  commentId: string,
  fromUserId: string,
  fromUserName: string,
  taskTitle: string,
  projectId: string
): void {
  const db = getDb();

  for (const mention of mentions) {
    // Look up user by name or email
    const user = db.prepare(
      "SELECT id FROM users WHERE name = ? OR email = ?"
    ).get(mention, mention) as any;
    if (!user || user.id === fromUserId) continue;

    // Verify mentioned user is a project member
    const isMember = db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, user.id);
    if (!isMember) continue;

    const id = uuidv4();
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, comment_id, task_id, project_id, from_user_id, message)
      VALUES (?, ?, 'mention', ?, ?, ?, ?, ?)
    `).run(id, user.id, commentId, taskId, projectId, fromUserId,
      `${fromUserName} mentioned you in a comment on "${taskTitle}"`);
  }
}

// List comments for a task
commentRouter.get('/task/:taskId', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const task = db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.taskId) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const member = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(task.project_id, req.userId);
  if (!member) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  const comments = db.prepare(`
    SELECT c.*, u.name as user_name
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.taskId);

  res.json({ comments });
});

// Create comment
commentRouter.post('/', (req: AuthRequest, res: Response) => {
  try {
    const data = createCommentSchema.parse(req.body);
    const db = getDb();

    const task = db.prepare('SELECT project_id, title FROM tasks WHERE id = ?').get(data.task_id) as any;
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const member = db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(task.project_id, req.userId);
    if (!member) {
      res.status(403).json({ error: 'Not a member of this project' });
      return;
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO comments (id, task_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `).run(id, data.task_id, req.userId, data.content);

    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;

    // Parse @mentions and create notifications
    const mentions = parseMentions(data.content);
    if (mentions.length > 0) {
      createMentionNotifications(
        mentions, data.task_id, id, req.userId!, user.name, task.title, task.project_id
      );
    }

    const comment = db.prepare(`
      SELECT c.*, u.name as user_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(id);

    res.status(201).json({ comment });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

// Update comment
commentRouter.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const data = updateCommentSchema.parse(req.body);
    const db = getDb();

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id) as any;
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.user_id !== req.userId) {
      res.status(403).json({ error: 'Can only edit your own comments' });
      return;
    }

    db.prepare("UPDATE comments SET content = ?, updated_at = datetime('now') WHERE id = ?")
      .run(data.content, req.params.id);

    const updated = db.prepare(`
      SELECT c.*, u.name as user_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(req.params.id);

    res.json({ comment: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

// Delete comment
commentRouter.delete('/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id) as any;
  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  if (comment.user_id !== req.userId) {
    res.status(403).json({ error: 'Can only delete your own comments' });
    return;
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  res.status(204).send();
});
