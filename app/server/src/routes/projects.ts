import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';
import { ProjectRepository } from '../db/projectRepository.js';

export const projectRouter = Router();
projectRouter.use(authenticateToken);
const projectRepository = new ProjectRepository();

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  const escapedValue = stringValue.replace(/"/g, '""');
  return `"${escapedValue}"`;
}

projectRouter.get('/', (req: AuthRequest, res: Response) => {
  const projects = projectRepository.listForUser(req.userId!);

  res.json({ projects });
});

projectRouter.get('/:id/export/csv', (req: AuthRequest, res: Response) => {
  const db = getDb();

  const member = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);

  if (!member) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  const tasks = db.prepare(`
    SELECT
      t.id,
      t.title,
      t.status,
      t.priority,
      u.name AS assignee,
      t.due_date,
      t.created_at
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = ?
      AND t.deleted_at IS NULL
    ORDER BY t.created_at DESC
  `).all(req.params.id) as any[];

  const header = 'id,title,status,priority,assignee,due date,created at';
  const rows = tasks.map((task) =>
    [
      csvEscape(task.id),
      csvEscape(task.title),
      csvEscape(task.status),
      csvEscape(task.priority),
      csvEscape(task.assignee),
      csvEscape(task.due_date),
      csvEscape(task.created_at),
    ].join(',')
  );

  const csv = [header, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="project-${req.params.id}-tasks.csv"`);
  res.status(200).send(csv);
});

projectRouter.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = createProjectSchema.parse(req.body);
    const id = uuidv4();

    projectRepository.createProject(id, name, description || null, req.userId!);
    projectRepository.addProjectMember(id, req.userId!, 'owner');

    logActivity(id, null, req.userId!, 'project_created', `Created project "${name}"`);

    const project = projectRepository.findProjectById(id);
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
  const project = projectRepository.findProjectForUser(req.params.id, req.userId!) as any;

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const members = projectRepository.findProjectMembers(req.params.id);

  res.json({ project: { ...project, members } });
});

projectRouter.put('/:id', (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;

  const member = projectRepository.findProjectRole(req.params.id, req.userId!) as any;

  if (!member || member.role !== 'owner') {
    res.status(403).json({ error: 'Only project owner can update' });
    return;
  }

  projectRepository.updateProject(req.params.id, name, description);

  const project = projectRepository.findProjectById(req.params.id);
  res.json({ project });
});

projectRouter.delete('/:id', (req: AuthRequest, res: Response) => {
  const member = projectRepository.findProjectRole(req.params.id, req.userId!) as any;

  if (!member || member.role !== 'owner') {
    res.status(403).json({ error: 'Only project owner can delete' });
    return;
  }

  projectRepository.deleteProject(req.params.id);
  res.status(204).send();
});
