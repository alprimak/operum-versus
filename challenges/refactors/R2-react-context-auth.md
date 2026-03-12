# R2: Replace Prop Drilling with React Context for Auth

## Difficulty: Medium
## Area: Frontend

## Description

Authentication state (user, tokens, login/logout functions) is currently passed through props across multiple component levels. Refactor to use React Context for cleaner component architecture.

## Requirements

- [ ] Create `AuthContext` with `AuthProvider` component
- [ ] Context provides: user, isAuthenticated, login, logout, refreshToken
- [ ] Create `useAuth()` hook for consuming auth context
- [ ] Remove auth-related props from all intermediate components
- [ ] Protected route wrapper using auth context
- [ ] Token refresh handled transparently within the context
- [ ] No behavioral changes — app functions identically after refactor
- [ ] All existing tests must pass (update test setup to wrap with AuthProvider)
