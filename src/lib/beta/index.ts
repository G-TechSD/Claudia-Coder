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
