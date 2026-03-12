import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDb } from '../models/database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const commentRouter = Router({ mergeParams: true });
commentRouter.use(authenticateToken);

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

function getTaskAndVerifyMembership(taskId: string, userId: string) {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) return { error: 'Task not found', status: 404 };

  const member = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(task.project_id, userId);
  if (!member) return { error: 'Not a member of this project', status: 403 };

  return { task };
}

function extractMentions(content: string): string[] {
  const matches = content.match(/@(\w+)/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1)))];
}

function createMentionNotifications(mentions: string[], projectId: string, commenterId: string, taskId: string, commentId: string) {
  const db = getDb();
  const commenter = db.prepare('SELECT name FROM users WHERE id = ?').get(commenterId) as any;

  for (const name of mentions) {
    // Find user by name who is also a project member
    const user = db.prepare(`
      SELECT u.id FROM users u
      JOIN project_members pm ON u.id = pm.user_id
      WHERE u.name = ? AND pm.project_id = ? AND u.id != ?
    `).get(name, projectId, commenterId) as any;

    if (user) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, reference_id, message)
        VALUES (?, ?, 'mention', ?, ?)
      `).run(uuidv4(), user.id, commentId, `${commenter?.name || 'Someone'} mentioned you in a comment`);
    }
  }
}

// List comments for a task
commentRouter.get('/', (req: AuthRequest, res: Response) => {
  const result = getTaskAndVerifyMembership(req.params.taskId, req.userId!);
  if ('error' in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const db = getDb();
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
    const { content } = createCommentSchema.parse(req.body);
    const result = getTaskAndVerifyMembership(req.params.taskId, req.userId!);
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO comments (id, task_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `).run(id, req.params.taskId, req.userId, content);

    // Process @mentions
    const mentions = extractMentions(content);
    if (mentions.length > 0) {
      createMentionNotifications(mentions, result.task.project_id, req.userId!, req.params.taskId, id);
    }

    const comment = db.prepare(`
      SELECT c.*, u.name as user_name
      FROM comments c JOIN users u ON c.user_id = u.id
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
commentRouter.put('/:commentId', (req: AuthRequest, res: Response) => {
  try {
    const { content } = createCommentSchema.parse(req.body);
    const db = getDb();

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.commentId) as any;
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.user_id !== req.userId) {
      res.status(403).json({ error: 'Can only edit your own comments' });
      return;
    }

    db.prepare("UPDATE comments SET content = ?, updated_at = datetime('now') WHERE id = ?")
      .run(content, req.params.commentId);

    const updated = db.prepare(`
      SELECT c.*, u.name as user_name
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(req.params.commentId);

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
commentRouter.delete('/:commentId', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.commentId) as any;
  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  if (comment.user_id !== req.userId) {
    res.status(403).json({ error: 'Can only delete your own comments' });
    return;
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.commentId);
  res.status(204).send();
});
