# Operum Versus

**Reproducible benchmark for comparing AI coding agent systems.**

Test the same codebase, same bugs, same feature requests across different AI agent configurations — and judge results fairly with an independent AI evaluator.

## What This Is

A full-stack TypeScript application (Express + React + SQLite) with **intentionally seeded bugs and feature requests**. Each challenge is documented as a GitHub issue with clear acceptance criteria.

Use this repo to compare:
- **Operum** (6-agent orchestrated team) vs **Claude Code Teams** vs **Cursor** vs **any AI coding setup**
- Wall-clock time, human intervention, code quality, and test coverage

## Benchmark Structure

```
operum-versus/
├── app/                    # Full-stack application with seeded bugs
│   ├── server/             # Express + SQLite backend
│   │   ├── src/
│   │   │   ├── index.ts        # Server entry point
│   │   │   ├── routes/         # API routes
│   │   │   ├── models/         # Database models
│   │   │   ├── middleware/     # Auth, validation, error handling
│   │   │   └── utils/          # Helpers
│   │   ├── tests/              # Backend tests (some failing)
│   │   └── package.json
│   └── client/             # React frontend
│       ├── src/
│       │   ├── components/     # UI components
│       │   ├── hooks/          # Custom hooks
│       │   ├── pages/          # Page components
│       │   └── api/            # API client
│       ├── tests/              # Frontend tests
│       └── package.json
├── challenges/             # Benchmark task definitions
│   ├── bugs/               # Bug fix challenges
│   ├── features/           # Feature implementation challenges
│   └── refactors/          # Refactoring challenges
├── judge/                  # AI-as-judge evaluation system
│   ├── criteria.md         # Scoring rubric
│   ├── evaluate.ts         # Evaluation script
│   └── results/            # Stored evaluation results
├── runs/                   # Recorded benchmark runs
│   └── template.md         # Run report template
└── RULES.md                # Fairness rules and methodology
```

## The Application: TaskFlow

A project management / task tracking app (intentionally ironic — using a task tracker to test AI task agents).

**Features:**
- User authentication (JWT)
- Project CRUD with team members
- Task management with priorities, assignees, due dates
- Activity feed / audit log
- Dashboard with statistics
- REST API with OpenAPI docs

**Tech Stack:**
- Backend: Express.js, TypeScript, better-sqlite3, Zod validation
- Frontend: React 18, TypeScript, TanStack Query, Tailwind CSS
- Testing: Vitest, Testing Library

## Challenges

### Bug Fixes (B1-B5)
| ID | Title | Difficulty | Area |
|----|-------|-----------|------|
| B1 | Task assignee not persisted after project switch | Medium | Backend |
| B2 | Dashboard stats show deleted tasks in count | Easy | Backend |
| B3 | Auth token refresh race condition | Hard | Full-stack |
| B4 | Activity feed shows duplicate entries on rapid updates | Medium | Backend |
| B5 | Date picker timezone offset causes wrong due date | Medium | Frontend |

### Feature Requests (F1-F3)
| ID | Title | Difficulty | Area |
|----|-------|-----------|------|
| F1 | Add task comments with @mention notifications | Hard | Full-stack |
| F2 | Implement task search with filters | Medium | Full-stack |
| F3 | Add CSV export for project tasks | Easy | Backend |

### Refactors (R1-R2)
| ID | Title | Difficulty | Area |
|----|-------|-----------|------|
| R1 | Extract database queries into repository pattern | Medium | Backend |
| R2 | Replace prop drilling with React Context for auth | Medium | Frontend |

## How to Run a Benchmark

### 1. Setup
```bash
git clone https://github.com/alprimak/operum-versus.git
cd operum-versus
cd app && npm install
npm run dev  # Starts both server and client
npm test     # Run tests (some will fail — that's intentional)
```

### 2. Pick a Challenge Set
- **Quick test**: B1 + B2 + F3 (3 tasks, ~1 hour expected)
- **Standard test**: All 5 bugs (B1-B5)
- **Full test**: All 10 challenges (B1-B5, F1-F3, R1-R2)

### 3. Run with Your Agent System
- Start timer when agent begins
- Track all human interventions
- Stop timer when all PRs are merged and tests pass

### 4. Evaluate with AI Judge
```bash
cd judge
npx ts-node evaluate.ts --run-id <your-run-id> --model gpt-5.2
```

### 5. Record Results
Copy `runs/template.md` and fill in metrics.

## Metrics Tracked

| Metric | Description |
|--------|-------------|
| **Wall-clock time** | Total elapsed time from start to all PRs merged |
| **Human interventions** | Number of times human had to guide/correct the agent |
| **Context switches** | Times human had to re-explain or redirect |
| **PRs created** | Total pull requests (fewer = better batching) |
| **Tests passing** | All existing + new tests pass |
| **Bugs introduced** | New bugs found by judge in the solution |
| **Code quality score** | AI judge rating (1-10) on readability, patterns, correctness |
| **Architecture score** | AI judge rating (1-10) on design decisions |

## AI Judge System

Uses a separate AI model (default: GPT-5.2) to evaluate PR diffs independently:

- **Correctness**: Does the fix/feature actually work? Does it match acceptance criteria?
- **Code quality**: Clean code, proper patterns, no code smells
- **Test coverage**: Are changes tested? Are edge cases covered?
- **Side effects**: Any regressions or unintended behavior introduced?
- **Over-engineering**: Did the agent do too much or too little?

Using a different model family (OpenAI) than the contestant (Claude) ensures evaluation independence.

## Benchmark Results

### Latest Runs

| Date | System | Avg Score | Failures | Notes |
|------|--------|-----------|----------|-------|
| 2026-03-23 | Cursor (GPT-5.3 Codex) | **8.3/10** | 0/10 | 1 QA revision on R1 |
| 2026-03-12 | Claude Code (Operum) | **7.47/10** | 2/10 | R1 reintroduced bugs; R2 incomplete |

### Cursor (GPT-5.3 Codex) — 2026-03-23

| Challenge | PR | Score | Verdict |
|-----------|----|-------|---------|
| F2: Task search with filters | #57 | 9.6/10 | PASS |
| F3: CSV export | #58 | 9.4/10 | PASS |
| B2: Dashboard stats | #51 | 9.2/10 | PASS |
| B1: Assignee persistence | #53 | 8.8/10 | PASS |
| B5: Timezone date fix | #55 | 8.6/10 | PASS |
| F1: Comments + @mentions | #56 | 8.6/10 | PASS |
| B4: Activity dedup | #54 | 8.2/10 | PASS |
| B3: Token refresh race | #52 | 8.0/10 | PASS_WITH_NOTES |
| R1: Repository pattern | #59 | 6.8/10 | PASS_WITH_NOTES |
| R2: Auth context | #60 | 5.6/10 | PASS_WITH_NOTES |

**Strengths:** Bug fixes and features were uniformly strong. F2 and F3 exceeded requirements with excellent test depth. Zero outright failures.

**Weaknesses:** Refactor PRs dragged the average — R1 required a QA revision cycle; R2 delivered a context stub rather than a full prop-drilling refactor.

---

### Claude Code — 2026-03-12

| Challenge | PR | Score | Verdict |
|-----------|----|-------|---------|
| B2: Dashboard stats | #41 | 9.4/10 | PASS |
| B5: Timezone date fix | #45 | 9.0/10 | PASS |
| F3: CSV export | #46 | 9.0/10 | PASS |
| F2: Task search with filters | #47 | 9.0/10 | PASS |
| B3: Token refresh race | #43 | 8.8/10 | PASS |
| F1: Comments + @mentions | #48 | 8.2/10 | PASS_WITH_NOTES |
| B1: Assignee persistence | #42 | 8.0/10 | PASS_WITH_NOTES |
| B4: Activity dedup | #44 | 7.8/10 | PASS_WITH_NOTES |
| R1: Repository pattern | #49 | 5.8/10 | FAIL |
| R2: Auth context | #50 | 5.0/10 | FAIL |

**Strengths:** Top bug fixes and feature implementations were excellent. B2 fix was textbook.

**Weaknesses:** Both refactor PRs failed — R1 reintroduced the B2 deleted-task bug; R2 only created the context file without wiring it into the app.

## Fairness Rules

See [RULES.md](./RULES.md) for complete methodology.

## License

MIT — use this benchmark freely for your own AI agent comparisons.
