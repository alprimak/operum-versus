import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { taskRepository, projectRepository } from '../repositories/index.js';
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
  if (!projectRepository.isMember(req.params.projectId, req.userId!)) {
    res.status(403).json({ error: 'Not a member of this project' });
    return;
  }

  const tasks = taskRepository.findByProject(req.params.projectId);
  res.json({ tasks });
});

taskRouter.post('/', (req: AuthRequest, res: Response) => {
  try {
    const data = createTaskSchema.parse(req.body);

    if (!projectRepository.isMember(data.project_id, req.userId!)) {
      res.status(403).json({ error: 'Not a member of this project' });
      return;
    }

    const id = uuidv4();
    const normalizedDueDate = data.due_date ? data.due_date.split('T')[0] : null;

    taskRepository.create(
      id, data.project_id, data.title, data.description || null,
      data.priority || 'medium', data.assignee_id || null, normalizedDueDate, req.userId!
    );

    logActivity(data.project_id, id, req.userId!, 'task_created', `Created task "${data.title}"`);

    const task = taskRepository.findById(id);
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

    const task = taskRepository.findById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (!projectRepository.isMember(task.project_id, req.userId!)) {
      res.status(403).json({ error: 'Not a member of this project' });
      return;
    }

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        if (key === 'due_date' && value) {
          fields.push(`${key} = ?`);
          values.push((value as string).split('T')[0]);
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
    }

    if (fields.length === 0) {
      res.json({ task });
      return;
    }

    fields.push('updated_at = datetime("now")');
    taskRepository.update(req.params.id, fields, values);

    const changes = Object.keys(updates).join(', ');
    logActivity(task.project_id, req.params.id, req.userId!, 'task_updated',
      `Updated ${changes} on "${task.title}"`);

    const updatedTask = taskRepository.findById(req.params.id);
    res.json({ task: updatedTask });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

taskRouter.delete('/:id', (req: AuthRequest, res: Response) => {
  const task = taskRepository.findById(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  taskRepository.softDelete(req.params.id);
  logActivity(task.project_id, req.params.id, req.userId!, 'task_deleted',
    `Deleted task "${task.title}"`);

  res.status(204).send();
});
