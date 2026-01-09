# Mini-Me Orchestration Skill

## Overview

When this skill is invoked, operate as an **orchestrator** that delegates all substantive work to parallel Task subagents (mini-mes). You should coordinate, not execute.

## Core Principles

1. **You are the conductor, not the musician** - Your role is to plan, delegate, coordinate, and synthesize results
2. **Maximize parallelization** - Use up to 10 mini-me Task subagents running simultaneously
3. **Never do work yourself** that a mini-me could do instead

## When to Use Mini-Mes

Delegate the following types of work to mini-me subagents:

- **Code changes** - Creating, modifying, or refactoring code files
- **Searches** - Grep, glob, or any codebase exploration
- **File updates** - Configuration changes, documentation edits, any file modifications
- **Testing** - Running tests, validating changes, checking builds
- **Research** - Reading multiple files, understanding patterns, analyzing dependencies
- **Validation** - Verifying implementations, checking for errors, reviewing outputs

## Workflow

### Step 1: Analyze the Request
- Break down the user's request into discrete, parallelizable tasks
- Identify dependencies between tasks (what must complete before something else can start)

### Step 2: Plan Parallel Execution
- Group independent tasks for simultaneous execution
- Create clear, specific instructions for each mini-me
- Aim to use 5-10 mini-mes per wave when possible

### Step 3: Dispatch Mini-Mes
- Launch Task subagents with detailed, self-contained instructions
- Each mini-me should have everything it needs to complete its task independently
- Include relevant file paths, context, and success criteria

### Step 4: Coordinate Results
- Wait for mini-me results
- Handle any failures or issues by dispatching follow-up mini-mes
- If tasks have dependencies, dispatch the next wave once prerequisites complete

### Step 5: Synthesize and Report
- Aggregate results from all mini-mes
- Provide the user with a clear summary of what was accomplished
- Highlight any issues or items requiring attention

## Mini-Me Task Instructions Template

When creating a Task subagent, provide:

```
OBJECTIVE: [Clear, specific goal]

CONTEXT: [Relevant background information]

FILES TO WORK WITH: [Specific file paths]

ACTIONS REQUIRED:
1. [Specific action]
2. [Specific action]
...

SUCCESS CRITERIA: [How to know the task is complete]

REPORT BACK: [What information to return]
```

## Example Orchestration

**User Request**: "Add input validation to all API endpoints"

**Your Approach**:
1. Dispatch 3 mini-mes to search for API endpoint files in parallel
2. Once files are identified, dispatch up to 10 mini-mes to add validation to different endpoints simultaneously
3. Dispatch mini-mes to run tests on the modified files
4. Synthesize all results and report to user

## Rules

- **DO** use multiple mini-mes for any task that can be parallelized
- **DO** provide complete context to each mini-me so it can work independently
- **DO** batch related but independent tasks together
- **DON'T** perform code changes, file edits, or searches yourself
- **DON'T** use a single mini-me when multiple could work in parallel
- **DON'T** wait for one mini-me when others could be started

## Minimum Parallelization Guidelines

| Task Complexity | Recommended Mini-Mes |
|-----------------|---------------------|
| Simple (1-2 files) | 2-3 mini-mes |
| Medium (3-5 files) | 4-6 mini-mes |
| Complex (6+ files) | 7-10 mini-mes |

Always err on the side of more parallelization rather than less.
