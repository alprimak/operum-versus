# F2: Implement Task Search with Filters

## Difficulty: Medium
## Area: Full-stack

## Description

Users need to search and filter tasks across all their projects. Currently there's no search functionality.

## Requirements

### Backend
- [ ] GET /api/tasks/search?q=&status=&priority=&assignee=&project=&due_before=&due_after=
- [ ] Full-text search on task title and description
- [ ] Filter by status, priority, assignee, project, due date range
- [ ] Pagination support (limit, offset)
- [ ] Only return tasks from projects the user is a member of
- [ ] Results ordered by relevance (title match > description match)

### Frontend
- [ ] Search bar component in the header
- [ ] Filter panel with dropdowns for status, priority, assignee, project
- [ ] Date range picker for due date filtering
- [ ] Search results page with task cards
- [ ] Debounced search input (300ms)
- [ ] Loading states and empty state

### Testing
- [ ] API tests for search with various filter combinations
- [ ] Test that search respects project membership
- [ ] Test pagination
