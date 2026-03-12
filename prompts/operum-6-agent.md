# Operum 6-Agent Team — Initial Prompt

Paste this into the Operum terminal chat when starting the benchmark run.

---

## Prompt

```
We have a full-stack TypeScript application called TaskFlow in this repository.
It's a project management / task tracker built with Express + SQLite on the backend
and React + TypeScript on the frontend.

The codebase has several known bugs and needs new features and refactoring.
Your job is to fix all bugs, implement all features, and complete all refactors
described below. Work in parallel where possible — assign different challenges
to different agents.

For each challenge, create a separate feature branch and PR.
All existing tests must continue to pass, and new tests should be added for
each change.

### Bug Fixes

**B1 — Task Assignee Not Persisted After Project Switch (Medium)**
When switching between projects and updating a task's assignee, the change
appears to save but reverts after refresh. The task update endpoint doesn't
validate that the assignee is a member of the project, and the frontend sends
stale project_id when switching rapidly.
- Assignee must persist correctly after project switch
- API must validate assignee is a project member
- Frontend must wait for project context to fully load before task updates
- Add test case for assignee validation

**B2 — Dashboard Stats Show Deleted Tasks in Count (Easy)**
Dashboard statistics count soft-deleted tasks in totals. After deleting tasks,
counts don't decrease.
- All dashboard queries must filter WHERE deleted_at IS NULL
- Covers: total, completed, overdue, by-status, by-priority
- Add test verifying deleted tasks are excluded

**B3 — Auth Token Refresh Race Condition (Hard)**
When multiple API calls fire simultaneously and the access token expires, all
calls try to refresh the token at once, causing 401 errors and logout.
- Implement token refresh mutex — only one refresh at a time
- Queue concurrent requests while refresh is in progress
- Retry failed requests with the new token
- Add test for concurrent expired-token scenario

**B4 — Activity Feed Shows Duplicate Entries on Rapid Updates (Medium)**
Updating a task multiple times in quick succession creates duplicate activity
log entries.
- Deduplicate activity entries within a short time window
- Use a debounce or upsert approach
- Add test for rapid consecutive updates

**B5 — Date Picker Timezone Offset Causes Wrong Due Date (Medium)**
Due dates are stored incorrectly when the user's timezone offset causes the
date to shift by one day.
- Normalize dates to UTC midnight before storage
- Display dates in the user's local timezone
- Add test for timezone edge cases (UTC+12, UTC-12)

### Feature Requests

**F1 — Task Comments with @mention Notifications (Hard)**
- Backend: comments table, notifications table, CRUD endpoints, @mention parsing
- Frontend: comment list, input with @mention autocomplete, notification bell
- Validate mentioned users are project members
- Full API test coverage

**F2 — Task Search with Filters (Medium)**
- GET /api/tasks/search with query, status, priority, assignee filters
- Full-text search on title and description
- Frontend: search bar with filter dropdowns
- API tests for each filter combination

**F3 — CSV Export for Project Tasks (Easy)**
- GET /api/projects/:id/export/csv returning a downloadable CSV file
- Columns: Title, Description, Status, Priority, Assignee, Due Date, Created, Updated
- Exclude soft-deleted tasks, restrict to project members
- Frontend: "Export CSV" button triggering browser download
- API tests for format, deleted exclusion, and 403 for non-members

### Refactors

**R1 — Extract Database Queries into Repository Pattern (Medium)**
- Create repositories/ directory with UserRepository, ProjectRepository,
  TaskRepository, ActivityRepository
- Move all direct SQL from route handlers into repository methods
- No behavioral changes — all existing tests must still pass
- Repositories should be injectable

**R2 — Replace Prop Drilling with React Context for Auth (Medium)**
- Create AuthContext with useAuth hook
- Replace all prop-drilled auth state (user, token, login, logout)
- Maintain exact same behavior — just cleaner architecture
- All frontend tests must still pass

### Setup

The app is in the `app/` directory:
- `cd app && npm install`
- `npm run dev` starts both server and client
- `npm test` runs the test suite (some tests will fail — the bugs are real)

### Rules

- Create a separate branch and PR for each challenge
- All 10 challenges must be attempted
- Parallelize work across agents where possible
- Every PR must include tests
- All existing tests must pass after your changes
- Do not modify test expectations to make them pass — fix the actual bugs
```
