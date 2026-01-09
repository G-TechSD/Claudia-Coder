/**
 * Security Module Exports
 * Prompt injection protection, sandbox isolation, and activity logging for Claudia Code
 */

// Prompt Injection Filter
export {
  filterPromptInjection,
  filterKickoffContent,
  detectStructuralInjection,
  sanitizeInput,
  isInputSafe,
  type FilterResult,
  type DetectedPattern,
  type InjectionType
} from "./prompt-filter"

// Security Activity Log
export {
  logSecurityEvent as logSecurityActivityEvent,
  getSecurityEvents as getSecurityActivityEvents,
  getSecurityEventById,
  getSecurityStats,
  clearOldEvents,
  exportEvents,
  hasRecentSecurityEvents,
  type SecurityEvent as SecurityActivityEvent,
  type SecurityEventInput,
  type SecurityEventType,
  type SecuritySeverity
} from "./activity-log"

// Sandbox Security (re-export for convenience)
export {
  validateProjectPath,
  isPathProtected,
  canAccessPath,
  canExecuteCommand,
  logSecurityEvent,
  getUserSandboxDir,
  ensureUserSandbox,
  getSecurityEvents,
  getAllSecurityEvents,
  PROTECTED_PATHS,
  PROTECTED_FILE_PATTERNS,
  BLOCKED_COMMAND_PATTERNS,
  SANDBOX_BASE_DIR,
} from "./sandbox"

// Command Filtering for Claude Code sessions
export {
  analyzeCommand,
  filterCommandForUser,
  filterPtyInput,
  createSandboxedEnvironment,
  type CommandFilterResult,
} from "./command-filter"
