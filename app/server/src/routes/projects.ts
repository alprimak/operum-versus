import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { projectRepository } from '../repositories/index.js';
import { logActivity } from '../utils/activity.js';

export const projectRouter = Router();
projectRouter.use(authenticateToken);

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

projectRouter.get('/', (req: AuthRequest, res: Response) => {
  const projects = projectRepository.findAllForUser(req.userId!);
  res.json({ projects });
});

projectRouter.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = createProjectSchema.parse(req.body);
    const id = uuidv4();

    projectRepository.create(id, name, description || null, req.userId!);
    projectRepository.addMember(id, req.userId!, 'owner');
    logActivity(id, null, req.userId!, 'project_created', `Created project "${name}"`);

    const project = projectRepository.findById(id);
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
  const project = projectRepository.findByIdForUser(req.params.id, req.userId!);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const members = projectRepository.getMembers(req.params.id);
  res.json({ project: { ...project, members } });
});

projectRouter.put('/:id', (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  const member = projectRepository.getMembership(req.params.id, req.userId!);

  if (!member || member.role !== 'owner') {
    res.status(403).json({ error: 'Only project owner can update' });
    return;
  }

  projectRepository.update(req.params.id, name, description);
  const project = projectRepository.findById(req.params.id);
  res.json({ project });
});

projectRouter.delete('/:id', (req: AuthRequest, res: Response) => {
  const member = projectRepository.getMembership(req.params.id, req.userId!);

  if (!member || member.role !== 'owner') {
    res.status(403).json({ error: 'Only project owner can delete' });
    return;
  }

  projectRepository.delete(req.params.id);
  res.status(204).send();
});
