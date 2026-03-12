import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDb } from '../models/database.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

export const projectRouter = Router();
projectRouter.use(authenticateToken);

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

projectRouter.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*, pm.role
    FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = ?
    ORDER BY p.updated_at DESC
  `).all(req.userId);

  res.json({ projects });
});

projectRouter.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = createProjectSchema.parse(req.body);
    const db = getDb();
    const id = uuidv4();

    db.prepare('INSERT INTO projects (id, name, description, owner_id) VALUES (?, ?, ?, ?)')
      .run(id, name, description || null, req.userId);

    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(id, req.userId, 'owner');

    logActivity(id, null, req.userId!, 'project_created', `Created project "${name}"`);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json({ project });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

projectRouter.get('/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const project = db.prepare(`
    SELECT p.* FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE p.id = ? AND pm.user_id = ?
  `).get(req.params.id, req.userId) as any;

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, pm.role
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(req.params.id);

  res.json({ project: { ...project, members } });
});

projectRouter.put('/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { name, description } = req.body;

  const member = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.id, req.userId) as any;

  if (!member || member.role !== 'owner') {
    res.status(403).json({ error: 'Only project owner can update' });
    return;
  }

  db.prepare('UPDATE projects SET name = ?, description = ?, updated_at = datetime("now") WHERE id = ?')
    .run(name, description, req.params.id);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ project });
});

// CSV Export
projectRouter.get('/:id/export/csv', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const member = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);

  if (!member) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(req.params.id) as any;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const tasks = db.prepare(`
    SELECT t.title, t.description, t.status, t.priority,
           u.name as assignee_name, t.due_date, t.created_at, t.updated_at
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.project_id = ? AND t.deleted_at IS NULL
    ORDER BY t.created_at ASC
  `).all(req.params.id) as any[];

  const headers = ['Title', 'Description', 'Status', 'Priority', 'Assignee', 'Due Date', 'Created', 'Updated'];

  function escapeCsvField(value: string | null): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const rows = tasks.map((t: any) => [
    t.title, t.description, t.status, t.priority,
    t.assignee_name, t.due_date, t.created_at, t.updated_at,
  ].map(escapeCsvField).join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${project.name}-tasks.csv"`);
  res.send(csv);
});

projectRouter.delete('/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const member = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.id, req.userId) as any;

  if (!member || member.role !== 'owner') {
    res.status(403).json({ error: 'Only project owner can delete' });
    return;
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.status(204).send();
});
