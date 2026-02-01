# Claudia Coder - Claude Code Instructions

## Project Information

- **Product**: Claudia Coder - AI-powered development orchestration platform
- **Website**: claudiacoder.com

### Key Directories

- Project root directory - Main codebase
- `src/components/` - React components
- `src/app/api/` - API routes
- `src/lib/` - Utilities and services
- `.claude/` - Claude Code configuration
  - `.claude/settings.json` - Hooks and permissions
  - `.claude/rules/` - Enforcement rules
  - `.claude/skills/` - Custom skills

## Working Style

You may work directly with tools (Read, Write, Edit, Grep, Glob, Bash) or delegate to sub-agents as appropriate for the task.

### When to use sub-agents (Task tool)

- Large tasks that can be parallelized across multiple files
- When explicitly requested by the user (e.g., `/minime` command)
- Complex multi-step operations where parallel execution helps
- **Limit: Maximum 5 concurrent sub-agents**

### When to work directly

- Simple file reads and edits
- Quick fixes and small changes
- Single-file operations
- When efficiency matters more than parallelization

## IMPORTANT: No Recursive Sub-Agents

If you ARE a sub-agent (spawned by a Task tool):
- **Work directly with tools** - do NOT spawn your own sub-agents
- **You are the implementer**, not an orchestrator
- Complete your assigned task and return results

Only the top-level Claude session should spawn sub-agents (maximum 5).

## Prohibitions

- **NEVER** delete projects without user consent
- **NEVER** make destructive changes without confirmation
- **NEVER** recommend AI models unless you have done current research (web search) on what models are available and performant today. Your training data about models is severely outdated. If asked about models, search first.
