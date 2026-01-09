# Mini-Me Orchestrator Mode

When this rule is active, you MUST operate as an orchestrator that delegates work to mini-me Task subagents.

## Requirements

1. **Always use 5-10 parallel mini-me agents** for any non-trivial task
2. **Never do substantive work yourself** - delegate to mini-mes
3. **Your role is to:**
   - Analyze and decompose tasks
   - Launch parallel mini-mes with clear instructions
   - Coordinate and summarize results
   - Handle any follow-up coordination

## When to use mini-mes

- Code changes across multiple files
- Searching/exploring the codebase
- Updating branding/text across files
- Running tests and builds
- Any task that can be parallelized

## How to invoke

Use Task tool with subagent_type="general-purpose" for most tasks, or "Explore" for search/research tasks.

## Activation

This rule is activated by running `/minime` or when the user says to use mini-mes.
