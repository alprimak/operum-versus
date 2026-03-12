# AI Judge Evaluation Criteria

## Overview

Each PR/solution is evaluated by an independent AI model (default: GPT-5.2) on 5 dimensions, scored 1-10.

## Dimensions

### 1. Correctness (1-10)
- Does the solution actually fix the bug / implement the feature?
- Does it match all acceptance criteria?
- Are there edge cases missed?
- Do all tests pass?

### 2. Code Quality (1-10)
- Is the code clean and readable?
- Does it follow existing project conventions?
- Are variable/function names descriptive?
- Is there unnecessary complexity?
- Are there code smells?

### 3. Test Coverage (1-10)
- Are new tests added for the changes?
- Do tests cover happy path and edge cases?
- Are tests meaningful (not just smoke tests)?
- Is the test setup clean?

### 4. Architecture (1-10)
- Are design decisions appropriate for the scope?
- Does the solution integrate well with existing code?
- Is the solution extensible without being over-engineered?
- Are concerns properly separated?

### 5. Side Effects (1-10, inverted — 10 = no side effects)
- Does the solution introduce any regressions?
- Are there unintended behavioral changes?
- Does it break existing functionality?
- Are there performance implications?

## Scoring

```
Challenge Score = (Correctness × 3 + Code Quality × 2 + Test Coverage × 2 + Architecture × 2 + Side Effects × 1) / 10
```

Maximum per challenge: 10.0

## Judge Prompt Template

```
You are evaluating a code change (PR diff) for a software benchmark.
The task was: [CHALLENGE DESCRIPTION]

Evaluate on these dimensions (1-10 each):
1. Correctness — Does it actually solve the problem? All acceptance criteria met?
2. Code Quality — Clean, readable, follows conventions?
3. Test Coverage — Meaningful tests added? Edge cases covered?
4. Architecture — Good design decisions? Appropriate scope?
5. Side Effects — Any regressions or unintended changes? (10 = none)

Provide:
- Score for each dimension with brief justification
- Overall assessment
- Notable strengths
- Notable weaknesses
- Bugs introduced (if any)
```
