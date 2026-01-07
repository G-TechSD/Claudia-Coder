#!/bin/bash
#
# BIRTH CANAL - Autonomous Claude Code execution wrapper
#
# This script keeps Claude Code running until:
# 1. The mission is explicitly marked complete
# 2. User interrupts with Ctrl+C
# 3. A stop file is created: touch ~/.claude-stop
#
# Usage: ./birth-canal.sh "Your mission prompt here"
#

set -e

MISSION="$1"
STOP_FILE="$HOME/.claude-stop"
LOG_FILE="$HOME/.claude-birth-canal.log"
ITERATION=0

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Cleanup stop file on start
rm -f "$STOP_FILE"

log() {
    echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

check_stop() {
    if [[ -f "$STOP_FILE" ]]; then
        log "${RED}Stop file detected. Exiting birth canal.${NC}"
        exit 0
    fi
}

trap 'log "${YELLOW}Interrupted by user. Exiting.${NC}"; exit 130' INT TERM

if [[ -z "$MISSION" ]]; then
    echo -e "${RED}Usage: $0 \"Your mission prompt\"${NC}"
    echo ""
    echo "Examples:"
    echo "  $0 \"Build a todo app with React and save it to ~/projects/todo-app\""
    echo "  $0 \"Fix all TypeScript errors in the current project\""
    echo "  $0 \"Implement the features in TODO.md one by one\""
    echo ""
    echo "To stop: touch ~/.claude-stop"
    exit 1
fi

log "${GREEN}=== BIRTH CANAL INITIATED ===${NC}"
log "Mission: $MISSION"
log "Stop file: $STOP_FILE"
log "To stop gracefully: touch $STOP_FILE"
echo ""

# Main loop
while true; do
    check_stop
    ITERATION=$((ITERATION + 1))

    log "${GREEN}--- Iteration $ITERATION ---${NC}"

    # Run Claude Code with the mission
    # Using --dangerously-skip-permissions for autonomous operation
    # The prompt includes instructions to keep going

    PROMPT="$MISSION

AUTONOMOUS MODE INSTRUCTIONS:
- Keep working until the mission is FULLY complete
- Do NOT stop to ask questions - make reasonable decisions
- Do NOT stop after each step - continue to the next
- If you encounter an error, try to fix it and continue
- Only stop when the mission is truly complete
- Use TodoWrite to track your progress
- Mark the mission complete by creating a file: touch ~/.claude-mission-complete"

    # Run claude with the prompt
    if claude --dangerously-skip-permissions -p "$PROMPT" 2>&1 | tee -a "$LOG_FILE"; then
        log "${GREEN}Claude session completed${NC}"
    else
        log "${YELLOW}Claude session ended with non-zero exit${NC}"
    fi

    check_stop

    # Check if mission is complete
    if [[ -f "$HOME/.claude-mission-complete" ]]; then
        log "${GREEN}=== MISSION COMPLETE ===${NC}"
        rm -f "$HOME/.claude-mission-complete"
        exit 0
    fi

    # Brief pause before next iteration
    log "Pausing 5 seconds before next iteration..."
    sleep 5

    check_stop
done
