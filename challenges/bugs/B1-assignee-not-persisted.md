# B1: Task Assignee Not Persisted After Project Switch

## Difficulty: Medium
## Area: Backend + Frontend

## Description

When a user switches between projects and updates a task's assignee, the assignee change appears to save but reverts after a page refresh. The issue is intermittent and related to stale project context.

## Steps to Reproduce

1. Create two projects (Project A and Project B)
2. Add a task to Project A and assign it to a user
3. Switch to Project B
4. Quickly switch back to Project A
5. Change the assignee on the task
6. Refresh the page — assignee reverts to the previous value

## Root Cause Hints

- The task update endpoint doesn't validate that the assignee is a member of the project
- Frontend sends stale project_id when switching rapidly between projects
- Race condition between project switch and task update API calls

## Acceptance Criteria

- [ ] Assignee persists correctly after project switch
- [ ] API validates assignee is a member of the target project
- [ ] Frontend waits for project context to fully load before allowing task updates
- [ ] Add test case for assignee validation
