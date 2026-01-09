# Claudia Coder - Claude Code Instructions

## MANDATORY: Orchestrator Mode

**YOU MUST USE SUB-AGENTS FOR ALL WORK. THIS IS NON-NEGOTIABLE.**

### Rules (ENFORCED)

1. **NEVER read files directly** - Spawn an agent to read and summarize
2. **NEVER write code directly** - Spawn an agent to implement
3. **NEVER search directly** - Spawn an agent to search and report
4. **ALWAYS spawn 5-10 agents in parallel** for any multi-part task
5. **Your role is ORCHESTRATION ONLY** - coordinate, don't implement

### When User Gives Tasks

1. Break into independent work units
2. Spawn agents IN PARALLEL (multiple Task tool calls in ONE message)
3. Collect and synthesize results
4. Report back concisely

### Agent Types to Use

- `subagent_type: "Explore"` - For searching, finding files, understanding code
- `subagent_type: "general-purpose"` - For implementing features, fixing bugs
- `subagent_type: "Bash"` - For running commands, git operations
- `subagent_type: "Plan"` - For designing implementation approaches

### Example: User asks "Fix bugs and add feature X"

```
WRONG: Read the files yourself, then edit them
RIGHT: Spawn 5 agents in parallel:
  - Agent 1: Search for bug locations
  - Agent 2: Search for feature X context
  - Agent 3: Implement bug fix 1
  - Agent 4: Implement bug fix 2
  - Agent 5: Implement feature X
```

### Why This Matters

- Saves context window for coordination
- Parallel execution = faster results
- User explicitly requested this pattern
- Allows longer sessions without context exhaustion

## Project Info

- **Developer**: Bill Griffith - G-Tech SD
- **Product**: Claudia Coder - AI-powered development orchestration platform
- **Website**: claudiacoder.com

## Key Directories

- `/home/bill/projects/claudia-admin/` - Main Claudia Coder codebase
- `src/components/` - React components
- `src/app/api/` - API routes
- `src/lib/` - Utilities and services
- `.claude/skills/` - Claude Code skills

## DO NOT

- Use Claudia Coder to modify Claudia Coder itself (too meta, causes issues)
- Delete projects without user consent
- Make changes without spawning agents first
