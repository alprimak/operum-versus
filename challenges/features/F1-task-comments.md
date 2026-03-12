# F1: Add Task Comments with @mention Notifications

## Difficulty: Hard
## Area: Full-stack

## Description

Users need the ability to comment on tasks and @mention other project members. Mentioned users should see a notification indicator.

## Requirements

### Backend
- [ ] Create `comments` table: id, task_id, user_id, body, created_at, updated_at
- [ ] Create `notifications` table: id, user_id, type, reference_id, message, read, created_at
- [ ] POST /api/tasks/:id/comments — create comment
- [ ] GET /api/tasks/:id/comments — list comments
- [ ] DELETE /api/tasks/:id/comments/:commentId — delete own comment
- [ ] GET /api/notifications — list user's notifications
- [ ] PUT /api/notifications/:id/read — mark notification as read
- [ ] Parse @mentions in comment body and create notifications for mentioned users
- [ ] Validate mentioned users are members of the task's project

### Frontend
- [ ] Comment list component on task detail view
- [ ] Comment input with @mention autocomplete (project members)
- [ ] Notification bell icon with unread count in header
- [ ] Notification dropdown showing recent notifications
- [ ] Click notification to navigate to the relevant task

### Testing
- [ ] API tests for comment CRUD
- [ ] Test @mention parsing and notification creation
- [ ] Test that non-members cannot be mentioned
