# B5: Date Picker Timezone Offset Causes Wrong Due Date

## Difficulty: Medium
## Area: Frontend

## Description

When a user selects a due date using the date picker, the saved date is off by one day in certain timezones. For example, selecting "March 15" saves as "March 14" for users in UTC-negative timezones.

## Steps to Reproduce

1. Set browser timezone to US Eastern (UTC-5)
2. Create a task and set due date to March 15, 2026
3. Save the task
4. Refresh — due date shows March 14, 2026

## Root Cause

The frontend date picker returns a local Date object. When serialized to JSON for the API call, `Date.toISOString()` converts to UTC, shifting the date backward for negative UTC offsets. The backend stores the UTC string, and when displayed, the frontend doesn't convert back.

## Acceptance Criteria

- [ ] Due dates are stored as date-only strings (YYYY-MM-DD), not datetime
- [ ] Timezone does not affect the stored date
- [ ] Date picker displays the correct date regardless of user's timezone
- [ ] Add test case for timezone edge cases
