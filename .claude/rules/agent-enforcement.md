# Agent Usage Enforcement Rule

## ABSOLUTE REQUIREMENTS

This rule is ALWAYS active. Violations are tracked and reported.

### MANDATORY BEHAVIOR

1. **NEVER use Read tool directly** - Spawn an Explore sub-agent
2. **NEVER use Write tool directly** - Spawn an implementation sub-agent
3. **NEVER use Edit tool directly** - Spawn an implementation sub-agent
4. **NEVER use Grep/Glob directly** - Spawn an Explore sub-agent
5. **ALWAYS use Task tool** for substantive work

### DELEGATION PROTOCOL

For EVERY user request:

```
Step 1: Analyze request → Identify 5-10 independent work units
Step 2: Spawn Task agents → ONE agent per work unit, IN PARALLEL
Step 3: Coordinate → Wait for results, handle failures
Step 4: Synthesize → Combine results, report to user
Step 5: Iterate → Spawn more agents if follow-up needed
```

### WHAT YOU ARE ALLOWED TO DO DIRECTLY

- Use TodoWrite to track task progress
- Use Task tool to spawn sub-agents
- Use Skill tool to invoke skills
- Quick verification of agent results (single file read after agent work)
- Git status checks and simple coordination commands

### WHAT YOU MUST DELEGATE

- ALL file reading for understanding code
- ALL file writing for implementation
- ALL code editing
- ALL searching and exploration
- ALL complex bash operations
- ALL testing and validation

### ENFORCEMENT METRICS

Target delegation ratio: **80%+ of operations via sub-agents**

If you find yourself using Read/Write/Edit more than Task, you are violating this rule.

### CONSEQUENCES OF VIOLATION

- Context window exhaustion (poor experience for user)
- Slower overall execution (serial vs parallel)
- Reduced session longevity
- User explicitly requested this pattern - respect it

### SELF-CHECK BEFORE EVERY ACTION

Ask yourself:
1. "Can a sub-agent do this instead of me?"
2. "Am I doing work that should be parallelized?"
3. "Am I the orchestrator or the implementer?"

If the answer to #1 is YES, delegate.
If the answer to #2 is YES, spawn multiple agents.
If the answer to #3 is "implementer", STOP and delegate.

## HOOK INTEGRATION

This rule works with `.claude/settings.json` hooks that:
- Remind you before each direct tool use
- Track your delegation ratio
- Warn when ratio falls below threshold
- Report statistics at session end

## EXAMPLE PATTERNS

### BAD (Direct Implementation)
```
User: "Fix the bug in auth.ts"
Claude: [Uses Read to read auth.ts]
Claude: [Uses Edit to fix the bug]
Claude: "Done!"
```

### GOOD (Orchestrated)
```
User: "Fix the bug in auth.ts"
Claude: [Spawns Task agent: "Read auth.ts and identify the bug"]
Claude: [Spawns Task agent: "Search for related auth files"]
Claude: [Waits for results]
Claude: [Spawns Task agent: "Fix the identified bug in auth.ts"]
Claude: [Spawns Task agent: "Run auth tests to verify fix"]
Claude: "Fixed! Sub-agents identified X issue and resolved it. Tests pass."
```

### EXCELLENT (Parallel Orchestration)
```
User: "Fix bugs and add feature X"
Claude: [Spawns 5 Task agents in parallel:
  - Agent 1: Search for bug locations
  - Agent 2: Research feature X context
  - Agent 3: Identify affected files
  - Agent 4: Check test coverage
  - Agent 5: Review related documentation
]
Claude: [Waits for all results]
Claude: [Spawns 5 more Task agents in parallel:
  - Agent 6: Fix bug 1
  - Agent 7: Fix bug 2
  - Agent 8: Implement feature X part 1
  - Agent 9: Implement feature X part 2
  - Agent 10: Update tests
]
Claude: "Complete! Here's what was done..."
```
