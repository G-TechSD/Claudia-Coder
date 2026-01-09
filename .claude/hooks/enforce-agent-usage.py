#!/usr/bin/env python3
"""
Enforce Agent Usage Hook for Claude Code

This hook monitors tool usage and injects reminders about using sub-agents
for orchestration instead of direct tool execution.

Hook Events Supported:
- PreToolUse: Reminds about delegation before direct tool use
- PostToolUse: Tracks what was done directly vs delegated
- UserPromptSubmit: Injects orchestration reminders
"""

import sys
import json
import os
from datetime import datetime

# Tools that should typically be delegated to sub-agents
DELEGATABLE_TOOLS = {
    "Read": "reading files",
    "Write": "writing files",
    "Edit": "editing files",
    "Grep": "searching code",
    "Glob": "finding files",
    "Bash": "running commands"
}

# Tools that are OK to use directly for orchestration
ORCHESTRATION_TOOLS = {"Task", "TodoWrite", "WebSearch", "WebFetch"}

# Counter file for tracking
STATS_FILE = os.path.expanduser("~/.claude/agent-enforcement-stats.json")


def load_stats():
    """Load usage statistics."""
    try:
        with open(STATS_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            "direct_tool_uses": 0,
            "agent_delegations": 0,
            "session_start": datetime.now().isoformat(),
            "tool_breakdown": {}
        }


def save_stats(stats):
    """Save usage statistics."""
    os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)
    with open(STATS_FILE, 'w') as f:
        json.dump(stats, f, indent=2)


def get_hook_event():
    """Determine the hook event type from environment."""
    return os.environ.get("CLAUDE_HOOK_EVENT", "Unknown")


def handle_pre_tool_use(tool_input):
    """Handle PreToolUse hook - remind about delegation."""
    tool_name = tool_input.get("tool_name", "")

    if tool_name in DELEGATABLE_TOOLS:
        action = DELEGATABLE_TOOLS[tool_name]

        # Output a reminder that Claude will see
        reminder = {
            "systemMessage": f"""
ORCHESTRATOR REMINDER: You are about to use {tool_name} directly for {action}.

Consider whether this should be delegated to a sub-agent instead:
- If this is part of a larger task: DELEGATE to a Task sub-agent
- If you're doing multiple similar operations: SPAWN PARALLEL agents
- If you're exploring/researching: Use an Explore sub-agent

Direct tool use is acceptable ONLY for:
- Quick verification of agent results
- Single, isolated operations
- Coordination and synthesis activities

Proceeding with direct use. Remember to delegate next time if applicable.
""",
            "continue": True  # Allow the tool to proceed
        }

        # Track the direct usage
        stats = load_stats()
        stats["direct_tool_uses"] += 1
        stats["tool_breakdown"][tool_name] = stats["tool_breakdown"].get(tool_name, 0) + 1
        save_stats(stats)

        print(json.dumps(reminder))
        return

    if tool_name == "Task":
        # Track agent delegation
        stats = load_stats()
        stats["agent_delegations"] += 1
        save_stats(stats)

    # Allow tool to proceed without modification
    print(json.dumps({"continue": True}))


def handle_post_tool_use(tool_output):
    """Handle PostToolUse hook - track and analyze patterns."""
    tool_name = tool_output.get("tool_name", "")

    stats = load_stats()

    # Calculate delegation ratio
    total = stats["direct_tool_uses"] + stats["agent_delegations"]
    if total > 0:
        delegation_ratio = stats["agent_delegations"] / total

        # If ratio is too low, output a stronger reminder
        if delegation_ratio < 0.3 and total >= 5:
            warning = {
                "systemMessage": f"""
WARNING: Agent delegation ratio is LOW ({delegation_ratio:.0%})

Session Statistics:
- Direct tool uses: {stats['direct_tool_uses']}
- Agent delegations: {stats['agent_delegations']}
- Most used directly: {max(stats['tool_breakdown'].items(), key=lambda x: x[1])[0] if stats['tool_breakdown'] else 'N/A'}

REMINDER: You are configured to operate as an ORCHESTRATOR.
Your job is to COORDINATE sub-agents, not do the work yourself.

For the next task, please use the Task tool to spawn sub-agents.
""",
                "continue": True
            }
            print(json.dumps(warning))
            return

    print(json.dumps({"continue": True}))


def handle_user_prompt_submit(prompt_data):
    """Handle UserPromptSubmit hook - inject orchestration context."""
    # Inject context about orchestration mode
    context = {
        "systemMessage": """
=== ORCHESTRATOR MODE ACTIVE ===

Before processing this request, remember:
1. Break the task into independent work units
2. Spawn sub-agents (Task tool) for each unit
3. Use 5-10 parallel agents when possible
4. Your role is COORDINATION, not implementation

Direct tool use should be minimal and only for orchestration activities.
""",
        "continue": True
    }

    print(json.dumps(context))


def handle_stop():
    """Handle Stop hook - provide session summary."""
    stats = load_stats()
    total = stats["direct_tool_uses"] + stats["agent_delegations"]

    if total > 0:
        ratio = stats["agent_delegations"] / total

        if ratio < 0.5:
            # Force continuation to fix low delegation
            output = {
                "continue": False,
                "stopReason": "agent_ratio_low",
                "systemMessage": f"""
ORCHESTRATOR CHECK: Your delegation ratio is only {ratio:.0%}.

You should be delegating at least 50% of work to sub-agents.
Please review the task and consider if you missed opportunities to delegate.

If the task is complete, you may proceed. Otherwise, use more sub-agents.
"""
            }
            print(json.dumps(output))
            return

    print(json.dumps({"continue": True}))


def main():
    """Main entry point for the hook."""
    event = get_hook_event()

    # Read input from stdin
    try:
        input_data = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        input_data = {}

    if event == "PreToolUse":
        handle_pre_tool_use(input_data)
    elif event == "PostToolUse":
        handle_post_tool_use(input_data)
    elif event == "UserPromptSubmit":
        handle_user_prompt_submit(input_data)
    elif event == "Stop":
        handle_stop()
    else:
        # Unknown event, allow to proceed
        print(json.dumps({"continue": True}))


if __name__ == "__main__":
    main()
