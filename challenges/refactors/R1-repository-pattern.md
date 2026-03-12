# R1: Extract Database Queries into Repository Pattern

## Difficulty: Medium
## Area: Backend

## Description

Database queries are currently embedded directly in route handlers. Extract them into repository classes for better separation of concerns, testability, and reusability.

## Requirements

- [ ] Create `repositories/` directory
- [ ] `UserRepository` — findById, findByEmail, create
- [ ] `ProjectRepository` — findById, findByUserId, create, update, delete, addMember, removeMember
- [ ] `TaskRepository` — findById, findByProjectId, create, update, softDelete, search
- [ ] `ActivityRepository` — findByProjectId, create, createWithDedup
- [ ] All route handlers use repository methods instead of direct DB queries
- [ ] Repository methods handle SQL and return typed objects
- [ ] No behavioral changes — all existing API tests must still pass
- [ ] Repositories are injectable for easier testing
