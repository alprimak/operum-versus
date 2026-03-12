# B2: Dashboard Stats Show Deleted Tasks in Count

## Difficulty: Easy
## Area: Backend

## Description

The dashboard statistics endpoint counts soft-deleted tasks in the total, making numbers appear inflated. When a user deletes a task, the count doesn't decrease.

## Steps to Reproduce

1. Create a project with 5 tasks
2. Check dashboard — shows 5 total tasks
3. Delete 2 tasks
4. Check dashboard — still shows 5 total tasks (should show 3)

## Root Cause

The dashboard queries in `routes/dashboard.ts` don't filter out tasks where `deleted_at IS NOT NULL`.

## Acceptance Criteria

- [ ] Dashboard stats exclude soft-deleted tasks
- [ ] All dashboard queries (total, completed, overdue, by-status, by-priority) filter deleted tasks
- [ ] Add test case verifying deleted tasks are excluded from counts
