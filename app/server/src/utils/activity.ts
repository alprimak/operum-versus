import { ActivityRepository } from '../repositories/ActivityRepository.js';

export function logActivity(
  projectId: string,
  taskId: string | null,
  userId: string,
  action: string,
  details: string
): void {
  const repo = new ActivityRepository();
  repo.log(projectId, taskId, userId, action, details);
}
