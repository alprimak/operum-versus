# B4: Activity Feed Shows Duplicate Entries on Rapid Updates

## Difficulty: Medium
## Area: Backend

## Description

When updating multiple fields on a task quickly (e.g., changing status and then assignee), the activity feed shows separate entries for each change with nearly identical timestamps. This clutters the feed and confuses users.

## Steps to Reproduce

1. Open a task
2. Change the status from "todo" to "in_progress"
3. Immediately change the assignee
4. Check the activity feed — shows two separate entries within the same second

## Root Cause

The `logActivity` utility creates a new entry for every single update without any debouncing or consolidation logic. When the frontend sends rapid sequential updates, each one generates its own activity log entry.

## Acceptance Criteria

- [ ] Implement activity deduplication — consolidate updates to the same task by the same user within a short time window (e.g., 5 seconds)
- [ ] Consolidated entries should show all changed fields (e.g., "Updated status, assignee on Task X")
- [ ] Activity feed displays clean, non-duplicated entries
- [ ] Add test case for deduplication behavior
