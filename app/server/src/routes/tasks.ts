import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { TaskRepository } from '../repositories/TaskRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
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
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

taskRouter.get('/project/:projectId', (req: AuthRequest, res: Response) => {
  const userRepo = new UserRepository();
  const taskRepo = new TaskRepository();

  if (!userRepo.isMemberOf(req.params.projectId, req.userId!)) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  const tasks = taskRepo.listByProject(req.params.projectId);
  res.json({ tasks });
});

taskRouter.post('/', (req: AuthRequest, res: Response) => {
  try {
    const data = createTaskSchema.parse(req.body);
    const userRepo = new UserRepository();
    const taskRepo = new TaskRepository();

    if (!userRepo.isMemberOf(data.project_id, req.userId!)) {
      res.status(403).json({ error: 'Not a member of this project' });
      return;
    }

    const id = uuidv4();
    const task = taskRepo.create(
      id, data.project_id, data.title,
      data.description || null, data.priority || 'medium',
      data.assignee_id || null, data.due_date || null, req.userId!
    );

    logActivity(data.project_id, id, req.userId!, 'task_created', `Created task "${data.title}"`);
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
    const userRepo = new UserRepository();
    const taskRepo = new TaskRepository();

    const task = taskRepo.findById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (!userRepo.isMemberOf(task.project_id, req.userId!)) {
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

    const updatedTask = taskRepo.update(req.params.id, updates);

    // BUG B4: Activity logging happens for every field update individually
    // when batch updates come in rapid succession. The frontend sends
    // separate requests for status change and assignee change, causing
    // duplicate activity entries with nearly identical timestamps.
    const changes = Object.keys(updates).join(', ');
    logActivity(task.project_id, req.params.id, req.userId!, 'task_updated',
      `Updated ${changes} on "${task.title}"`);

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
  const taskRepo = new TaskRepository();

  const task = taskRepo.findById(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  taskRepo.softDelete(req.params.id);

  logActivity(task.project_id, req.params.id, req.userId!, 'task_deleted',
    `Deleted task "${task.title}"`);

  res.status(204).send();
});
