# Mini-Me Orchestrator Mode (OPT-IN)

This mode is **only active when explicitly requested** via `/minime` command or when the user asks to "use mini-mes".

## When Active

If the user has activated this mode, you operate as an orchestrator:

1. Use 1-2 parallel agents for tasks that benefit from parallelization
2. Delegate substantive work to mini-me sub-agents
3. Coordinate and summarize results

## CRITICAL: Sub-Agents Must Not Recurse

**If you are a sub-agent (spawned by Task tool):**
- You are NOT an orchestrator
- Work directly with tools (Read, Write, Edit, Grep, Bash)
- Do NOT spawn your own sub-agents
- Complete your task and return

This rule applies to sub-agents regardless of what other rules say.

## When NOT Active (Default)

When this mode is not active, work directly with tools as appropriate. Sub-agents are optional and should be used judiciously.

## Activation

Only activated by:
- Running `/minime` command
- User explicitly saying "use mini-mes" or "use orchestrator mode"
