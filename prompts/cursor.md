# Cursor — Initial Prompt

Open the repo in Cursor and paste this into the Composer chat.

---

## Prompt

```
I have a full-stack TypeScript application called TaskFlow in the `app/`
directory. It's a project management / task tracker built with Express + SQLite
on the backend and React + TypeScript on the frontend.

The codebase has 5 bugs, 3 feature requests, and 2 refactors to complete.
Work through them one at a time, creating a separate branch and PR for each.

First, get oriented: cd app && npm install && npm test
(Some tests will fail — the bugs are real.)

### Bug Fixes

B1 — Task Assignee Not Persisted After Project Switch (Medium)
- Assignee reverts after refresh when switching projects rapidly
- API must validate assignee is a project member
- Frontend must wait for project context to load before updates
- Add test for assignee validation

B2 — Dashboard Stats Show Deleted Tasks in Count (Easy)
- Dashboard queries don't filter WHERE deleted_at IS NULL
- Fix all dashboard queries: total, completed, overdue, by-status, by-priority
- Add test verifying deleted tasks are excluded

B3 — Auth Token Refresh Race Condition (Hard)
- Multiple concurrent calls all try to refresh an expired token
- Implement refresh mutex, queue requests, retry with new token
- Add test for concurrent expired-token scenario

B4 — Activity Feed Shows Duplicate Entries on Rapid Updates (Medium)
- Rapid task updates create duplicate activity log entries
- Deduplicate within a time window using debounce or upsert
- Add test for rapid consecutive updates

B5 — Date Picker Timezone Offset Causes Wrong Due Date (Medium)
- Timezone offset shifts the date by one day
- Normalize to UTC midnight before storage
- Add test for timezone edge cases

### Features

F1 — Task Comments with @mention Notifications (Hard)
- comments + notifications tables, CRUD endpoints, @mention parsing
- Frontend: comment list, autocomplete, notification bell
- Validate mentioned users are project members

F2 — Task Search with Filters (Medium)
- GET /api/tasks/search with query, status, priority, assignee filters
- Full-text search, frontend search bar with filter dropdowns

F3 — CSV Export for Project Tasks (Easy)
- GET /api/projects/:id/export/csv
- Columns: Title, Description, Status, Priority, Assignee, Due Date, Created, Updated
- Exclude deleted tasks, restrict to members, frontend download button

### Refactors

R1 — Extract Database Queries into Repository Pattern (Medium)
- Create repositories/ with User, Project, Task, Activity repositories
- Move all SQL out of route handlers, no behavioral changes

R2 — Replace Prop Drilling with React Context for Auth (Medium)
- Create AuthContext + useAuth hook, replace all prop-drilled auth state
- No behavioral changes

### Rules

- Separate branch and PR per challenge
- Every change must include tests
- All existing tests must pass
- Do not modify test expectations — fix the actual code
- Start with B2 (easiest), work through increasing difficulty

Suggested order: B2, F3, B4, B5, R2, B1, F2, R1, B3, F1
```
