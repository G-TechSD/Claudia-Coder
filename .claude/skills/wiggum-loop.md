# Ralph Wiggum Autonomous Loop Skill

## Overview

When this skill is invoked, operate in **autonomous loop mode** - continuously iterating toward a goal until completion criteria are met. You make a promise to complete a task and keep working until that promise is fulfilled.

> "Me fail English? That's unpossible!" - Ralph Wiggum
>
> Unlike Ralph, you WILL complete the task. You promised.

## Core Concept: The Promise

Every autonomous loop begins with a **promise** - a commitment to achieve a specific outcome. The loop continues until you can honestly declare the promise fulfilled.

### Promise Syntax

```
<promise>PROMISE_NAME</promise>
```

When the task is complete, emit this tag to signal termination of the autonomous loop.

### Common Promise Types

| Promise | Meaning |
|---------|---------|
| `TASK_COMPLETE` | Generic task completion |
| `TESTS_PASSING` | All tests pass successfully |
| `BUILD_SUCCESS` | Project builds without errors |
| `TS_FIXED` | TypeScript errors resolved |
| `LINT_CLEAN` | No linting errors remain |
| `FEATURE_DONE` | Feature fully implemented |
| `BUG_FIXED` | Bug resolved and verified |

## Iteration Tracking

### Iteration Counter

Track your progress through the loop:

```
=== WIGGUM LOOP: Iteration {N}/{MAX} ===
Status: {current_status}
Remaining: {what_still_needs_to_be_done}
```

### Maximum Iteration Limits

| Task Type | Default Max Iterations | Hard Limit |
|-----------|----------------------|------------|
| Simple fix | 5 | 10 |
| Feature implementation | 10 | 20 |
| Refactoring | 15 | 25 |
| Complex debugging | 20 | 30 |

**CRITICAL**: If you reach 80% of max iterations without clear progress, pause and reassess strategy.

### Iteration Structure

Each iteration follows this pattern:

1. **ASSESS** - What is the current state?
2. **PLAN** - What action will move us closer to the promise?
3. **EXECUTE** - Perform the action
4. **VERIFY** - Did it work? Are we closer to completion?
5. **DECIDE** - Continue, adjust, or complete?

## Workflow Rules

### When to Test

**TEST AFTER EVERY CODE CHANGE**

```
[Code Change Made]
     |
     v
[Run Relevant Tests]
     |
     v
[Tests Pass?] --No--> [Fix Issues, Loop Back]
     |
    Yes
     |
     v
[Continue to Next Task]
```

Testing cadence:
- After modifying any source file: Run unit tests for that module
- After modifying multiple files: Run integration tests
- Before declaring promise complete: Run full test suite
- After fixing a bug: Add regression test, run full suite

### When to Commit

**COMMIT AFTER EVERY MEANINGFUL CHANGE**

Commit triggers:
- After implementing a feature or sub-feature
- After fixing a bug (with passing tests)
- After refactoring that improves code quality
- After adding/updating tests
- Before switching to a different area of the codebase

Commit message format:
```
[type]: Brief description

- Detail 1
- Detail 2

Wiggum Loop: Iteration N of promise PROMISE_NAME
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

### When NOT to Commit

- Code is broken/tests failing
- Change is incomplete
- You're in the middle of a multi-file refactor

## Completion Detection

### Completion Criteria Checklist

Before emitting `<promise>COMPLETE</promise>`, verify ALL:

```
[ ] Primary objective achieved
[ ] All tests pass
[ ] No new errors introduced
[ ] Code compiles/builds successfully
[ ] Changes are committed
[ ] No TODO items left for this task
```

### Self-Verification Protocol

**MANDATORY** before marking complete:

1. **Re-read the original request** - Does your work actually address it?
2. **Run final verification commands**:
   - Test suite: `npm test` / `pytest` / equivalent
   - Type check: `tsc --noEmit` / `mypy` / equivalent
   - Lint: `eslint` / `flake8` / equivalent
   - Build: `npm run build` / equivalent
3. **Review your changes** - `git diff` or `git log --oneline -10`
4. **Ask yourself**: "If I were the user, would I consider this done?"

### Completion Declaration

Only after self-verification passes:

```
=== WIGGUM LOOP: COMPLETE ===

Promise: {PROMISE_NAME}
Iterations: {N}
Summary: {what_was_accomplished}

Verification:
- Tests: PASS
- Build: PASS
- Lint: PASS

<promise>PROMISE_NAME</promise>
```

## Failure Modes and Recovery

### Stuck Detection

You are stuck if:
- Same error appears 3+ iterations in a row
- No measurable progress in 3 iterations
- You're undoing previous work

### Recovery Actions

1. **Step back** - Re-read the original problem
2. **Change approach** - Try a different solution strategy
3. **Reduce scope** - Can you solve a smaller version first?
4. **Gather info** - Search for similar issues, read documentation
5. **Ask for help** - If truly blocked, explain the situation to the user

### Graceful Failure

If unable to complete after max iterations:

```
=== WIGGUM LOOP: INCOMPLETE ===

Promise: {PROMISE_NAME} - UNFULFILLED
Iterations: {N}/{MAX}

Progress Made:
- {accomplishment_1}
- {accomplishment_2}

Blockers:
- {blocker_1}
- {blocker_2}

Recommended Next Steps:
- {suggestion_1}
- {suggestion_2}

<promise>INCOMPLETE:{PROMISE_NAME}</promise>
```

## Usage Examples

### Example 1: Fix TypeScript Errors

```
/wiggum "Fix all TypeScript errors and test" --promise "TS_FIXED"
```

Loop execution:
```
=== WIGGUM LOOP: Iteration 1/10 ===
Status: Starting TypeScript error resolution
Action: Running tsc to identify errors

[Finds 15 TS errors across 8 files]

=== WIGGUM LOOP: Iteration 2/10 ===
Status: 15 errors remaining
Action: Fixing errors in src/utils/helpers.ts (4 errors)

[Fixes errors, runs tests]
[Commits: "fix: resolve type errors in helpers.ts"]

=== WIGGUM LOOP: Iteration 3/10 ===
Status: 11 errors remaining
Action: Fixing errors in src/components/Button.tsx (3 errors)

... continues until ...

=== WIGGUM LOOP: COMPLETE ===

Promise: TS_FIXED
Iterations: 7
Summary: Fixed 15 TypeScript errors across 8 files

Verification:
- Tests: PASS (142/142)
- Build: PASS
- tsc --noEmit: 0 errors

<promise>TS_FIXED</promise>
```

### Example 2: Implement Feature

```
/wiggum "Add user authentication with JWT tokens" --promise "AUTH_IMPLEMENTED"
```

Loop execution:
```
=== WIGGUM LOOP: Iteration 1/15 ===
Status: Planning authentication implementation
Action: Analyzing existing code structure

[Identifies where auth should be added]

=== WIGGUM LOOP: Iteration 2/15 ===
Status: Implementation planned
Action: Creating auth middleware

[Creates middleware, writes tests]
[Commits: "feat: add JWT authentication middleware"]

=== WIGGUM LOOP: Iteration 3/15 ===
Status: Middleware complete
Action: Creating login/logout endpoints

[Creates endpoints, writes tests]
[Commits: "feat: add login and logout API endpoints"]

... continues ...

=== WIGGUM LOOP: COMPLETE ===

Promise: AUTH_IMPLEMENTED
Iterations: 12
Summary: Full JWT authentication system implemented

Verification:
- Tests: PASS (189/189, 23 new)
- Build: PASS
- Manual verification: Login flow works end-to-end

<promise>AUTH_IMPLEMENTED</promise>
```

### Example 3: Debug and Fix

```
/wiggum "Fix the race condition in data sync" --promise "RACE_CONDITION_FIXED"
```

### Example 4: Refactoring

```
/wiggum "Refactor utils into smaller modules with tests" --promise "REFACTOR_COMPLETE" --max-iterations 20
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `--promise` | `TASK_COMPLETE` | The promise name to fulfill |
| `--max-iterations` | 10 | Maximum loop iterations |
| `--commit-frequency` | `per-change` | When to commit: `per-change`, `per-feature`, `at-end` |
| `--test-frequency` | `per-change` | When to test: `per-change`, `per-feature`, `at-end` |
| `--verbose` | false | Show detailed iteration logs |

## Rules Summary

1. **Always track iterations** - Know where you are in the loop
2. **Test after every code change** - No exceptions
3. **Commit after every working change** - Small, atomic commits
4. **Verify before completing** - Self-check is mandatory
5. **Never exceed max iterations** - Fail gracefully if needed
6. **Keep the promise** - Don't declare complete until truly done
7. **Stay focused** - Only work on the promised task

## Anti-Patterns to Avoid

- **Premature completion** - Declaring done without verification
- **Infinite loops** - Not tracking iterations or having no exit condition
- **Big bang commits** - Saving all commits for the end
- **Skipping tests** - "I'll test it later" (you won't)
- **Scope creep** - Working on unrelated issues during the loop
- **Optimistic verification** - Assuming things work without checking

## Integration with Other Skills

The Wiggum Loop can be combined with other skills:

- **With /minime**: Dispatch mini-mes for parallel sub-tasks within each iteration
- **With code review**: Request review after completing the promise
- **With deployment**: Auto-deploy after successful completion

---

*"I'm learnding!" - Ralph Wiggum*

*And so will your codebase, one verified iteration at a time.*
