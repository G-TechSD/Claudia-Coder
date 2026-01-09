/**
 * Beta Tester Restrictions
 * Sandboxed access restrictions for beta testers in Claudia Coder
 *
 * Beta testers have limited access to prevent them from accessing
 * development/admin features while still being able to use the core app.
 */

// Beta limits - these can be adjusted as needed
export const BETA_MAX_PROJECTS = 3
export const BETA_MAX_DAILY_EXECUTIONS = 50

// Routes that beta testers cannot access
export const BETA_RESTRICTED_ROUTES = [
  '/admin',
  '/claude-code',
  '/settings/data',
]

// Storage keys for tracking beta usage
const BETA_EXECUTION_COUNT_KEY = 'beta_execution_count'
const BETA_EXECUTION_DATE_KEY = 'beta_execution_date'

interface BetaLimits {
  canCreateProject: boolean
  canExecute: boolean
  remaining: {
    projects: number
    executions: number
  }
  current: {
    projects: number
    executions: number
  }
  limits: {
    projects: number
    executions: number
  }
}

/**
 * Check if a user is a beta tester based on their role
 */
export function isBetaTester(userRole?: string): boolean {
  return userRole === 'beta' || userRole === 'beta_tester'
}

/**
 * Check if a route is restricted for beta testers
 */
export function isRouteRestrictedForBeta(pathname: string): boolean {
  return BETA_RESTRICTED_ROUTES.some(route =>
    pathname.startsWith(route) || pathname === route
  )
}

/**
 * Get the current execution count for today
 * Resets at midnight
 */
function getExecutionCount(userId: string): number {
  if (typeof window === 'undefined') return 0

  const today = new Date().toISOString().split('T')[0]
  const storedDate = localStorage.getItem(`${BETA_EXECUTION_DATE_KEY}_${userId}`)

  // Reset count if it's a new day
  if (storedDate !== today) {
    localStorage.setItem(`${BETA_EXECUTION_DATE_KEY}_${userId}`, today)
    localStorage.setItem(`${BETA_EXECUTION_COUNT_KEY}_${userId}`, '0')
    return 0
  }

  const count = localStorage.getItem(`${BETA_EXECUTION_COUNT_KEY}_${userId}`)
  return count ? parseInt(count, 10) : 0
}

/**
 * Get the project count for a user
 */
function getProjectCount(userId: string): number {
  if (typeof window === 'undefined') return 0

  // Import dynamically to avoid circular dependencies
  const stored = localStorage.getItem('claudia_projects')
  if (!stored) return 0

  try {
    const projects = JSON.parse(stored)
    return projects.filter((p: { userId?: string; status?: string }) =>
      p.userId === userId && p.status !== 'trashed'
    ).length
  } catch {
    return 0
  }
}

/**
 * Check if a beta tester can perform actions based on their limits
 */
export function checkBetaLimits(userId: string): BetaLimits {
  const currentProjects = getProjectCount(userId)
  const currentExecutions = getExecutionCount(userId)

  const canCreateProject = currentProjects < BETA_MAX_PROJECTS
  const canExecute = currentExecutions < BETA_MAX_DAILY_EXECUTIONS

  return {
    canCreateProject,
    canExecute,
    remaining: {
      projects: Math.max(0, BETA_MAX_PROJECTS - currentProjects),
      executions: Math.max(0, BETA_MAX_DAILY_EXECUTIONS - currentExecutions),
    },
    current: {
      projects: currentProjects,
      executions: currentExecutions,
    },
    limits: {
      projects: BETA_MAX_PROJECTS,
      executions: BETA_MAX_DAILY_EXECUTIONS,
    },
  }
}

/**
 * Increment the execution count for a beta user
 */
export function incrementExecutionCount(userId: string): number {
  if (typeof window === 'undefined') return 0

  const today = new Date().toISOString().split('T')[0]
  const storedDate = localStorage.getItem(`${BETA_EXECUTION_DATE_KEY}_${userId}`)

  // Reset count if it's a new day
  if (storedDate !== today) {
    localStorage.setItem(`${BETA_EXECUTION_DATE_KEY}_${userId}`, today)
    localStorage.setItem(`${BETA_EXECUTION_COUNT_KEY}_${userId}`, '1')
    return 1
  }

  const currentCount = getExecutionCount(userId)
  const newCount = currentCount + 1
  localStorage.setItem(`${BETA_EXECUTION_COUNT_KEY}_${userId}`, newCount.toString())
  return newCount
}

/**
 * Server-side function to check beta limits
 * Uses a simple file-based storage for server-side tracking
 */
export async function checkBetaLimitsServer(userId: string): Promise<BetaLimits> {
  // For server-side, we'll use a simple approach
  // In production, this should use a database
  const fs = await import('fs/promises')
  const path = await import('path')

  const STORAGE_DIR = '/home/bill/projects/claudia-admin/.local-storage'
  const BETA_LIMITS_FILE = path.join(STORAGE_DIR, 'beta-limits.json')

  let data: Record<string, { executions: number; date: string; projects: number }> = {}

  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
    const content = await fs.readFile(BETA_LIMITS_FILE, 'utf-8')
    data = JSON.parse(content)
  } catch {
    // File doesn't exist or is invalid
  }

  const today = new Date().toISOString().split('T')[0]
  const userData = data[userId] || { executions: 0, date: today, projects: 0 }

  // Reset if new day
  if (userData.date !== today) {
    userData.executions = 0
    userData.date = today
  }

  return {
    canCreateProject: userData.projects < BETA_MAX_PROJECTS,
    canExecute: userData.executions < BETA_MAX_DAILY_EXECUTIONS,
    remaining: {
      projects: Math.max(0, BETA_MAX_PROJECTS - userData.projects),
      executions: Math.max(0, BETA_MAX_DAILY_EXECUTIONS - userData.executions),
    },
    current: {
      projects: userData.projects,
      executions: userData.executions,
    },
    limits: {
      projects: BETA_MAX_PROJECTS,
      executions: BETA_MAX_DAILY_EXECUTIONS,
    },
  }
}

/**
 * Server-side function to increment execution count
 */
export async function incrementExecutionCountServer(userId: string): Promise<number> {
  const fs = await import('fs/promises')
  const path = await import('path')

  const STORAGE_DIR = '/home/bill/projects/claudia-admin/.local-storage'
  const BETA_LIMITS_FILE = path.join(STORAGE_DIR, 'beta-limits.json')

  let data: Record<string, { executions: number; date: string; projects: number }> = {}

  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
    const content = await fs.readFile(BETA_LIMITS_FILE, 'utf-8')
    data = JSON.parse(content)
  } catch {
    // File doesn't exist or is invalid
  }

  const today = new Date().toISOString().split('T')[0]
  const userData = data[userId] || { executions: 0, date: today, projects: 0 }

  // Reset if new day
  if (userData.date !== today) {
    userData.executions = 0
    userData.date = today
  }

  userData.executions += 1
  data[userId] = userData

  await fs.writeFile(BETA_LIMITS_FILE, JSON.stringify(data, null, 2))

  return userData.executions
}

/**
 * Server-side function to update project count
 */
export async function updateProjectCountServer(userId: string, count: number): Promise<void> {
  const fs = await import('fs/promises')
  const path = await import('path')

  const STORAGE_DIR = '/home/bill/projects/claudia-admin/.local-storage'
  const BETA_LIMITS_FILE = path.join(STORAGE_DIR, 'beta-limits.json')

  let data: Record<string, { executions: number; date: string; projects: number }> = {}

  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
    const content = await fs.readFile(BETA_LIMITS_FILE, 'utf-8')
    data = JSON.parse(content)
  } catch {
    // File doesn't exist or is invalid
  }

  const today = new Date().toISOString().split('T')[0]
  const userData = data[userId] || { executions: 0, date: today, projects: 0 }
  userData.projects = count
  data[userId] = userData

  await fs.writeFile(BETA_LIMITS_FILE, JSON.stringify(data, null, 2))
}

/**
 * Get a user-friendly message about why a route is restricted
 */
export function getRestrictionMessage(pathname: string): string {
  if (pathname.startsWith('/admin')) {
    return 'Admin features are not available for beta testers.'
  }
  if (pathname.startsWith('/claude-code')) {
    return 'The Claude Code development interface is not available for beta testers.'
  }
  if (pathname.startsWith('/settings/data')) {
    return 'Data management features are not available for beta testers.'
  }
  return 'This feature is not available for beta testers.'
}
