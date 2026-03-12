# B3: Auth Token Refresh Race Condition

## Difficulty: Hard
## Area: Full-stack

## Description

When multiple API requests fire simultaneously and the access token is expired, all requests attempt to refresh the token at the same time. The first refresh succeeds, but subsequent refreshes also succeed using the same (now-stale) refresh token. This creates multiple valid access tokens and potential security issues.

## Steps to Reproduce

1. Login to get access and refresh tokens
2. Wait for access token to expire (1 hour, or modify expiry for testing)
3. Trigger multiple simultaneous API requests
4. All requests try to refresh — all succeed with the same refresh token
5. Multiple valid access tokens now exist

## Root Cause

- No refresh token rotation (old token not invalidated after use)
- No token blacklist or single-use enforcement
- No mutex/lock on the refresh operation in the frontend

## Acceptance Criteria

- [ ] Implement refresh token rotation — issue new refresh token on each refresh, invalidate the old one
- [ ] Add a `refresh_tokens` table to track valid tokens
- [ ] Frontend implements a refresh mutex — only one refresh request at a time, others queue
- [ ] Expired/used refresh tokens return 403
- [ ] Add comprehensive test cases for the refresh flow
