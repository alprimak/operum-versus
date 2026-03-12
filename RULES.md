# Benchmark Rules & Methodology

## Fairness Principles

1. **Same starting point** — All contestants start from the same git commit
2. **Same hardware** — Run on the same machine or equivalent specs
3. **Same model** — Use the same Claude model version for all Claude-based contestants
4. **Same API tier** — Same rate limits and token budgets
5. **No pre-training** — Agents should not have seen this codebase before
6. **Independent evaluation** — Judge uses a different model family than contestants

## Before Each Run

1. Fresh clone of the repository
2. `npm install` and verify `npm test` shows expected failures
3. Clear any agent memory/context from previous runs
4. Start screen recording (optional but recommended)
5. Document: agent system, model version, hardware specs

## During Each Run

### Allowed
- Human can read task descriptions and relay to agent
- Human can approve/reject PRs
- Human can answer clarifying questions about requirements
- Human can restart agent if it crashes

### Counted as Intervention
- Human corrects agent's approach
- Human provides hints or suggestions
- Human fixes code the agent wrote
- Human re-explains a requirement after initial prompt
- Human resolves merge conflicts manually

### Not Allowed
- Human writes code directly
- Human modifies the benchmark codebase before agent starts
- Human provides solutions from previous runs
- Cherry-picking which challenges to attempt (must do all in the set)

## After Each Run

1. All tests must pass (`npm test` exits 0)
2. Application must start and function (`npm run dev`)
3. Manual smoke test of fixed/implemented features
4. Run AI judge evaluation
5. Record all metrics in run report

## Challenge Ordering

- Agents may tackle challenges in any order
- Parallel work on multiple challenges is allowed (and encouraged for multi-agent systems)
- This is a key differentiator — orchestrated teams can parallelize

## Time Limits

- **Quick test**: 2 hours max
- **Standard test**: 4 hours max
- **Full test**: 8 hours max

If time limit is exceeded, record partial completion and note which challenges were not finished.

## Scoring Formula

```
Total Score = (Challenges Completed × 10)
            + (Code Quality Score × 5)
            + (Architecture Score × 5)
            - (Human Interventions × 3)
            - (Bugs Introduced × 10)
            + (Time Bonus)

Time Bonus:
  - Under 50% of time limit: +20
  - Under 75% of time limit: +10
  - Under 100% of time limit: +0
  - Over time limit: -10 per 30 min over
```

## Reporting

Use `runs/template.md` for standardized reporting. Include:
- System configuration
- All metrics
- AI judge scores
- Notable observations
- Links to PRs (if public)
