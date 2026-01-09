#!/bin/bash
# Agent Usage Reminder Hook
# Lightweight shell-based hook for quick reminders

# Read tool name from stdin if available
read -t 1 TOOL_INPUT 2>/dev/null || TOOL_INPUT="{}"

# Extract tool name (basic JSON parsing)
TOOL_NAME=$(echo "$TOOL_INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

# Define tools that should be delegated
case "$TOOL_NAME" in
    Read|Write|Edit|Grep|Glob)
        echo '{"systemMessage": "REMINDER: Consider delegating this to a sub-agent using the Task tool.", "continue": true}'
        ;;
    Bash)
        echo '{"systemMessage": "REMINDER: For complex bash operations, delegate to a sub-agent.", "continue": true}'
        ;;
    *)
        echo '{"continue": true}'
        ;;
esac
