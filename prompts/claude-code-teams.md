# Claude Code Teams (Multi-Session) — Initial Prompt

Use Claude Code with Teams features (shared context, multiple sessions).
Open 2-3 parallel sessions and distribute work across them.

---

## Session 1 Prompt — Bug Fixes

```
I have a full-stack TypeScript app called TaskFlow in this repo (app/ directory).
Express + SQLite backend, React + TypeScript frontend.

You are Session 1, handling bug fixes. Sessions 2 and 3 are handling features
and refactors in parallel. Coordinate via git — create a separate branch and
PR for each fix.

Set up first: cd app && npm install && npm test
(Some tests will fail — the bugs are real.)

Fix these 5 bugs:

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

Rules:
- Separate branch per bug (fix/B1-assignee, fix/B2-dashboard, etc.)
- Every fix must include tests
- All existing tests must pass after your changes
- Do not modify test expectations — fix the actual bugs
- Start with B2 (easiest), then B4, B1, B5, B3 (hardest)
```

---

## Session 2 Prompt — Features

```
I have a full-stack TypeScript app called TaskFlow in this repo (app/ directory).
Express + SQLite backend, React + TypeScript frontend.

You are Session 2, handling feature requests. Sessions 1 and 3 are handling
bugs and refactors in parallel. Coordinate via git — create a separate branch
and PR for each feature.

Set up first: cd app && npm install && npm test

Implement these 3 features:

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

Rules:
- Separate branch per feature (feat/F1-comments, feat/F2-search, feat/F3-csv)
- Every feature must include tests
- All existing tests must pass after your changes
- Start with F3 (easiest), then F2, then F1 (hardest)
```

---

## Session 3 Prompt — Refactors

```
I have a full-stack TypeScript app called TaskFlow in this repo (app/ directory).
Express + SQLite backend, React + TypeScript frontend.

You are Session 3, handling refactors. Sessions 1 and 2 are handling bugs and
features in parallel. Coordinate via git — create a separate branch and PR for
each refactor.

Set up first: cd app && npm install && npm test

Complete these 2 refactors:

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

Rules:
- Separate branch per refactor (refactor/R1-repository, refactor/R2-auth-context)
- No behavioral changes — these are structural improvements only
- All existing tests must pass after your changes
- Start with R2 (smaller scope), then R1
```
