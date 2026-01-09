#!/bin/bash
# Claude Code Orchestrator Wrapper
# This script wraps Claude Code to inject orchestrator reminders

set -e

PROJECT_DIR="/home/bill/projects/claudia-admin"
STATS_FILE="$HOME/.claude/orchestrator-stats.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║         CLAUDE CODE - ORCHESTRATOR MODE                      ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  You are entering a project that REQUIRES orchestration.     ║"
    echo "║                                                              ║"
    echo "║  MANDATORY RULES:                                            ║"
    echo "║  1. Use Task tool for ALL substantive work                   ║"
    echo "║  2. Spawn 5-10 parallel sub-agents per request               ║"
    echo "║  3. NEVER read/write/edit files directly                     ║"
    echo "║  4. Coordinate and synthesize, don't implement               ║"
    echo "║                                                              ║"
    echo "║  Hooks are configured to remind and track compliance.        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_settings() {
    local settings_file="$PROJECT_DIR/.claude/settings.json"
    if [[ -f "$settings_file" ]]; then
        echo -e "${GREEN}[OK]${NC} Hooks configured in .claude/settings.json"
    else
        echo -e "${YELLOW}[WARN]${NC} No settings.json found - hooks not configured"
    fi
}

check_rules() {
    local rules_dir="$PROJECT_DIR/.claude/rules"
    if [[ -d "$rules_dir" ]] && [[ $(ls -A "$rules_dir" 2>/dev/null) ]]; then
        local rule_count=$(ls -1 "$rules_dir"/*.md 2>/dev/null | wc -l)
        echo -e "${GREEN}[OK]${NC} Found $rule_count enforcement rule(s)"
    else
        echo -e "${YELLOW}[WARN]${NC} No enforcement rules found"
    fi
}

show_session_stats() {
    if [[ -f "$STATS_FILE" ]]; then
        echo -e "\n${BLUE}=== Previous Session Stats ===${NC}"
        cat "$STATS_FILE" | python3 -m json.tool 2>/dev/null || cat "$STATS_FILE"
    fi
}

main() {
    print_banner

    echo -e "\n${BLUE}=== Pre-flight Checks ===${NC}"
    check_settings
    check_rules

    show_session_stats

    echo -e "\n${BLUE}=== Starting Claude Code ===${NC}"
    echo "Launching in: $PROJECT_DIR"
    echo ""

    # Change to project directory and launch Claude
    cd "$PROJECT_DIR"

    # Pass through any arguments to claude
    if command -v claude &> /dev/null; then
        claude "$@"
    else
        echo -e "${RED}[ERROR]${NC} claude command not found in PATH"
        echo "Please ensure Claude Code is installed and accessible."
        exit 1
    fi
}

# Handle interrupts gracefully
trap 'echo -e "\n${YELLOW}Session interrupted${NC}"; exit 0' INT TERM

main "$@"
