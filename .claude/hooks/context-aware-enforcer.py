#!/usr/bin/env python3
"""
Context-Aware Agent Enforcement Hook

This hook provides intelligent enforcement based on:
- Current context usage (if available)
- Tool usage patterns in the session
- Delegation ratio tracking

Usage:
  Set CLAUDE_HOOK_EVENT environment variable and pipe input JSON via stdin
"""

import sys
import json
import os
from datetime import datetime
from pathlib import Path

# Configuration
STATS_DIR = Path.home() / ".claude"
STATS_FILE = STATS_DIR / "orchestrator-stats.json"
SESSION_FILE = STATS_DIR / "current-session-stats.json"

# Tools requiring delegation
HIGH_COST_TOOLS = {"Read", "Write", "Edit"}
MEDIUM_COST_TOOLS = {"Grep", "Glob", "Bash"}
DELEGATION_TOOLS = {"Task"}
COORDINATION_TOOLS = {"TodoWrite", "Skill", "WebSearch", "WebFetch"}


def load_session_stats():
    """Load current session statistics."""
    try:
        if SESSION_FILE.exists():
            with open(SESSION_FILE) as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        pass

    return {
        "session_id": datetime.now().isoformat(),
        "high_cost_direct": 0,
        "medium_cost_direct": 0,
        "delegated": 0,
        "coordination": 0,
        "tool_sequence": [],
        "warnings_issued": 0,
    }


def save_session_stats(stats):
    """Save session statistics."""
    STATS_DIR.mkdir(parents=True, exist_ok=True)
    with open(SESSION_FILE, "w") as f:
        json.dump(stats, f, indent=2)


def calculate_delegation_ratio(stats):
    """Calculate the delegation ratio."""
    total_work = (
        stats["high_cost_direct"]
        + stats["medium_cost_direct"]
        + stats["delegated"]
    )
    if total_work == 0:
        return 1.0
    return stats["delegated"] / total_work


def get_warning_level(stats):
    """Determine warning severity based on patterns."""
    ratio = calculate_delegation_ratio(stats)

    # Check recent tool sequence for consecutive direct uses
    recent = stats["tool_sequence"][-5:] if stats["tool_sequence"] else []
    consecutive_direct = 0
    for tool in reversed(recent):
        if tool in HIGH_COST_TOOLS | MEDIUM_COST_TOOLS:
            consecutive_direct += 1
        else:
            break

    if consecutive_direct >= 3:
        return "CRITICAL"
    if ratio < 0.3 and stats["high_cost_direct"] >= 3:
        return "HIGH"
    if ratio < 0.5 and stats["high_cost_direct"] >= 2:
        return "MEDIUM"
    if stats["high_cost_direct"] >= 1:
        return "LOW"
    return "OK"


def generate_message(tool_name, event_type, stats):
    """Generate context-aware enforcement message."""
    ratio = calculate_delegation_ratio(stats)
    warning_level = get_warning_level(stats)

    if event_type == "PreToolUse":
        if tool_name in HIGH_COST_TOOLS:
            if warning_level == "CRITICAL":
                return (
                    f"CRITICAL: You have used {stats['high_cost_direct']} high-cost tools directly "
                    f"with only {stats['delegated']} delegations. "
                    f"Your delegation ratio is {ratio:.0%}. "
                    f"STOP and use Task tool to delegate this {tool_name} operation!"
                )
            elif warning_level == "HIGH":
                return (
                    f"WARNING: Delegation ratio is {ratio:.0%}. "
                    f"Direct {tool_name} uses consume main context. "
                    f"Strong recommendation: Delegate to a sub-agent."
                )
            else:
                return (
                    f"REMINDER: {tool_name} operation should typically be delegated. "
                    f"Current delegation ratio: {ratio:.0%}"
                )

        elif tool_name in MEDIUM_COST_TOOLS:
            if warning_level in ("CRITICAL", "HIGH"):
                return (
                    f"CAUTION: Consider delegating {tool_name} to preserve context. "
                    f"Delegation ratio: {ratio:.0%}"
                )

        elif tool_name in DELEGATION_TOOLS:
            return f"GOOD: Using Task tool for delegation. Ratio: {ratio:.0%}"

    elif event_type == "PostToolUse":
        if tool_name in HIGH_COST_TOOLS | MEDIUM_COST_TOOLS:
            return (
                f"Session stats - Direct: {stats['high_cost_direct']} high / "
                f"{stats['medium_cost_direct']} medium, "
                f"Delegated: {stats['delegated']}, "
                f"Ratio: {ratio:.0%}"
            )
        elif tool_name in DELEGATION_TOOLS:
            return f"Delegation recorded. Ratio improved to {ratio:.0%}"

    elif event_type == "Stop":
        if ratio < 0.5:
            return (
                f"SESSION REVIEW: Delegation ratio was {ratio:.0%}. "
                f"Direct uses: {stats['high_cost_direct']} high-cost, "
                f"{stats['medium_cost_direct']} medium-cost. "
                f"Delegations: {stats['delegated']}. "
                f"Aim for 80%+ delegation ratio next session."
            )
        else:
            return (
                f"SESSION COMPLETE: Good delegation ratio of {ratio:.0%}. "
                f"Delegated {stats['delegated']} tasks."
            )

    return None


def handle_event(event_type, input_data):
    """Handle a hook event."""
    stats = load_session_stats()
    tool_name = input_data.get("tool_name", "")

    # Update statistics
    if event_type == "PreToolUse":
        stats["tool_sequence"].append(tool_name)
        if len(stats["tool_sequence"]) > 20:
            stats["tool_sequence"] = stats["tool_sequence"][-20:]

    elif event_type == "PostToolUse":
        if tool_name in HIGH_COST_TOOLS:
            stats["high_cost_direct"] += 1
        elif tool_name in MEDIUM_COST_TOOLS:
            stats["medium_cost_direct"] += 1
        elif tool_name in DELEGATION_TOOLS:
            stats["delegated"] += 1
        elif tool_name in COORDINATION_TOOLS:
            stats["coordination"] += 1

    # Generate message
    message = generate_message(tool_name, event_type, stats)

    # Save updated stats
    save_session_stats(stats)

    # Prepare output
    output = {"continue": True}
    if message:
        output["systemMessage"] = message
        stats["warnings_issued"] += 1

    return output


def main():
    event_type = os.environ.get("CLAUDE_HOOK_EVENT", "Unknown")

    try:
        input_data = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        input_data = {}

    result = handle_event(event_type, input_data)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
