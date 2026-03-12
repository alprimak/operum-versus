# F3: Add CSV Export for Project Tasks

## Difficulty: Easy
## Area: Backend

## Description

Users need to export their project's tasks as a CSV file for reporting and external tools.

## Requirements

### Backend
- [ ] GET /api/projects/:id/export/csv — returns CSV file
- [ ] Include columns: Title, Description, Status, Priority, Assignee, Due Date, Created, Updated
- [ ] Exclude soft-deleted tasks
- [ ] Set proper Content-Type and Content-Disposition headers
- [ ] Only accessible to project members

### Frontend
- [ ] "Export CSV" button on the project page
- [ ] Trigger browser download

### Testing
- [ ] API test for CSV export format
- [ ] Test that deleted tasks are excluded
- [ ] Test that non-members get 403
