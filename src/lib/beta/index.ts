/**
 * Beta Module Exports
 * Sandboxed access restrictions for beta testers
 */

export {
  // Constants
  BETA_MAX_PROJECTS,
  BETA_MAX_DAILY_EXECUTIONS,
  BETA_RESTRICTED_ROUTES,

  // Functions
  isBetaTester,
  isRouteRestrictedForBeta,
  checkBetaLimits,
  incrementExecutionCount,
  checkBetaLimitsServer,
  incrementExecutionCountServer,
  updateProjectCountServer,
  getRestrictionMessage,
} from "./restrictions"

export {
  // Lockdown constants
  LOCKDOWN_ENABLED,

  // Lockdown functions
  isLockdownMode,
  getLockdownState,
  enableLockdown,
  disableLockdown,
  addAllowedAdmin,
  isAdminAllowedDuringLockdown,

  // Security event logging
  getSecurityEvents,
  logSecurityEvent,
  clearSecurityEvents,
} from "./lockdown"
