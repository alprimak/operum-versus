import { ActivityRepository } from '../repositories/ActivityRepository.js';

export function logActivity(
  projectId: string,
  taskId: string | null,
  userId: string,
  action: string,
  details: string
): void {
  // BUG B4: No debouncing or deduplication logic.
  // If the same user updates the same task multiple times within a short
  // window (e.g., changing status then assignee), each update creates
  // a separate activity entry. Should consolidate rapid updates.
  const activityRepo = new ActivityRepository();
  activityRepo.log(projectId, taskId, userId, action, details);
}
