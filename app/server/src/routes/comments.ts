import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDb } from '../models/database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const commentRouter = Router();
commentRouter.use(authenticateToken);

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

// Parse @mentions from comment content
function parseMentions(content: string): string[] {
  const matches = content.match(/@(\w+)/g) || [];
  return matches.map(m => m.slice(1)); // strip the @ prefix
}

// GET /api/comments/task/:taskId — list comments for a task
commentRouter.get('/task/:taskId', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(req.params.taskId) as any;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Verify project membership
  const member = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(task.project_id, req.userId);

  if (!member) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  const comments = db.prepare(`
    SELECT c.*, u.name as author_name, u.email as author_email
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.taskId);

  res.json({ comments });
});

// POST /api/comments/task/:taskId — create a comment
commentRouter.post('/task/:taskId', (req: AuthRequest, res: Response) => {
  try {
    const { content } = createCommentSchema.parse(req.body);
    const db = getDb();

    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(req.params.taskId) as any;
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify project membership
    const member = db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(task.project_id, req.userId);

    if (!member) {
      res.status(403).json({ error: 'Not a member of this project' });
      return;
    }

    const commentId = uuidv4();
    db.prepare(`
      INSERT INTO comments (id, task_id, project_id, user_id, content)
      VALUES (?, ?, ?, ?, ?)
    `).run(commentId, task.id, task.project_id, req.userId, content);

    // Process @mentions — notify mentioned project members
    const mentionedNames = parseMentions(content);
    if (mentionedNames.length > 0) {
      const author = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;

      for (const name of mentionedNames) {
        // Find user by name who is also a project member
        const mentionedUser = db.prepare(`
          SELECT u.id FROM users u
          JOIN project_members pm ON u.id = pm.user_id
          WHERE u.name = ? AND pm.project_id = ?
        `).get(name, task.project_id) as any;

        if (mentionedUser && mentionedUser.id !== req.userId) {
          db.prepare(`
            INSERT INTO notifications (id, user_id, project_id, task_id, comment_id, type, message)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            mentionedUser.id,
            task.project_id,
            task.id,
            commentId,
            'mention',
            `${author.name} mentioned you in a comment on "${task.title}"`
          );
        }
      }
    }

    const comment = db.prepare(`
      SELECT c.*, u.name as author_name, u.email as author_email
      FROM comments c JOIN users u ON c.user_id = u.id
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

// DELETE /api/comments/:id — delete own comment
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
