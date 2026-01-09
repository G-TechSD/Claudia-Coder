/**
 * API Budget Management for Beta Testers
 * Tracks and enforces API usage budgets for beta users
 *
 * Beta testers can either:
 * - Use our provided API key with budget limits
 * - Bring their own Anthropic API key (no limits)
 */

import * as fs from "fs/promises"
import * as path from "path"
import type { ApiKeySource, UserApiBudget } from "@/lib/data/types"

// Default budget for beta testers (in dollars)
export const BETA_DEFAULT_BUDGET = 10.00

// Budget reset period in days
export const BETA_BUDGET_RESET_DAYS = 30

// Storage location
const STORAGE_DIR = "/home/bill/projects/claudia-admin/.local-storage"
const BUDGET_FILE = path.join(STORAGE_DIR, "api-budgets.json")

// Budget data structure stored in file
interface BudgetData {
  [userId: string]: UserApiBudget
}

/**
 * Budget check result
 */
export interface BudgetCheckResult {
  allowed: boolean
  remaining: number
  percentUsed: number
  message?: string
  usingOwnKey: boolean
}

/**
 * Full budget status report
 */
export interface BudgetStatusReport {
  userId: string
  apiKeySource: ApiKeySource
  hasOwnApiKey: boolean
  budget: number
  spent: number
  remaining: number
  percentUsed: number
  resetDate: string
  daysUntilReset: number
  isOverBudget: boolean
}

/**
 * Load budget data from file
 */
async function loadBudgetData(): Promise<BudgetData> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
    const content = await fs.readFile(BUDGET_FILE, "utf-8")
    return JSON.parse(content)
  } catch {
    // File doesn't exist or is invalid
    return {}
  }
}

/**
 * Save budget data to file
 */
async function saveBudgetData(data: BudgetData): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true })
  await fs.writeFile(BUDGET_FILE, JSON.stringify(data, null, 2))
}

/**
 * Get or create user budget record
 */
async function getOrCreateUserBudget(userId: string): Promise<UserApiBudget> {
  const data = await loadBudgetData()

  if (!data[userId]) {
    // Create default budget for new user
    const resetDate = new Date()
    resetDate.setDate(resetDate.getDate() + BETA_BUDGET_RESET_DAYS)

    data[userId] = {
      apiKeySource: "provided",
      apiUsageBudget: BETA_DEFAULT_BUDGET,
      apiUsageSpent: 0,
      apiUsageResetDate: resetDate.toISOString(),
    }

    await saveBudgetData(data)
  }

  // Check if budget needs to be reset
  const budget = data[userId]
  const resetDate = new Date(budget.apiUsageResetDate)
  const now = new Date()

  if (now >= resetDate) {
    // Reset the budget
    budget.apiUsageSpent = 0
    resetDate.setDate(now.getDate() + BETA_BUDGET_RESET_DAYS)
    budget.apiUsageResetDate = resetDate.toISOString()
    await saveBudgetData(data)
  }

  return budget
}

/**
 * Check if user has budget available for API usage
 * Returns whether execution is allowed and remaining budget
 */
export async function checkBudget(userId: string): Promise<BudgetCheckResult> {
  const budget = await getOrCreateUserBudget(userId)

  // If user is using their own API key, always allow
  if (budget.apiKeySource === "own" && budget.anthropicApiKey) {
    return {
      allowed: true,
      remaining: Infinity,
      percentUsed: 0,
      usingOwnKey: true,
    }
  }

  // Using provided key - check budget
  const remaining = Math.max(0, budget.apiUsageBudget - budget.apiUsageSpent)
  const percentUsed = (budget.apiUsageSpent / budget.apiUsageBudget) * 100

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      percentUsed: 100,
      message: `Budget exceeded. You have used $${budget.apiUsageSpent.toFixed(2)} of your $${budget.apiUsageBudget.toFixed(2)} monthly budget. Add your own API key in Settings to continue.`,
      usingOwnKey: false,
    }
  }

  // Warning at 80% usage
  let message: string | undefined
  if (percentUsed >= 80) {
    message = `Warning: You have used ${percentUsed.toFixed(0)}% of your monthly API budget ($${remaining.toFixed(2)} remaining).`
  }

  return {
    allowed: true,
    remaining,
    percentUsed,
    message,
    usingOwnKey: false,
  }
}

/**
 * Record API usage cost for a user
 * Call this after successful API execution
 */
export async function recordUsage(userId: string, cost: number): Promise<{ newTotal: number; budget: number }> {
  const data = await loadBudgetData()
  const budget = await getOrCreateUserBudget(userId)

  // Don't record if using own key
  if (budget.apiKeySource === "own" && budget.anthropicApiKey) {
    return { newTotal: 0, budget: 0 }
  }

  // Update spent amount
  budget.apiUsageSpent += cost
  data[userId] = budget

  await saveBudgetData(data)

  return {
    newTotal: budget.apiUsageSpent,
    budget: budget.apiUsageBudget,
  }
}

/**
 * Reset a user's budget to zero
 * Admin function
 */
export async function resetBudget(userId: string): Promise<void> {
  const data = await loadBudgetData()

  if (!data[userId]) {
    // Create default if doesn't exist
    await getOrCreateUserBudget(userId)
    return
  }

  // Reset spent to zero
  data[userId].apiUsageSpent = 0

  // Set new reset date
  const resetDate = new Date()
  resetDate.setDate(resetDate.getDate() + BETA_BUDGET_RESET_DAYS)
  data[userId].apiUsageResetDate = resetDate.toISOString()

  await saveBudgetData(data)
}

/**
 * Get full budget status report for a user
 */
export async function getBudgetStatus(userId: string): Promise<BudgetStatusReport> {
  const budget = await getOrCreateUserBudget(userId)

  const remaining = Math.max(0, budget.apiUsageBudget - budget.apiUsageSpent)
  const percentUsed = (budget.apiUsageSpent / budget.apiUsageBudget) * 100

  // Calculate days until reset
  const resetDate = new Date(budget.apiUsageResetDate)
  const now = new Date()
  const msUntilReset = resetDate.getTime() - now.getTime()
  const daysUntilReset = Math.max(0, Math.ceil(msUntilReset / (1000 * 60 * 60 * 24)))

  return {
    userId,
    apiKeySource: budget.apiKeySource,
    hasOwnApiKey: !!(budget.apiKeySource === "own" && budget.anthropicApiKey),
    budget: budget.apiUsageBudget,
    spent: budget.apiUsageSpent,
    remaining,
    percentUsed,
    resetDate: budget.apiUsageResetDate,
    daysUntilReset,
    isOverBudget: remaining <= 0,
  }
}

/**
 * Update a user's budget settings
 * Admin function
 */
export async function updateBudgetSettings(
  userId: string,
  settings: {
    apiKeySource?: ApiKeySource
    anthropicApiKey?: string
    apiUsageBudget?: number
  }
): Promise<UserApiBudget> {
  const data = await loadBudgetData()
  const budget = await getOrCreateUserBudget(userId)

  if (settings.apiKeySource !== undefined) {
    budget.apiKeySource = settings.apiKeySource
  }

  if (settings.anthropicApiKey !== undefined) {
    // In production, encrypt this before storing
    budget.anthropicApiKey = settings.anthropicApiKey
  }

  if (settings.apiUsageBudget !== undefined) {
    budget.apiUsageBudget = settings.apiUsageBudget
  }

  data[userId] = budget
  await saveBudgetData(data)

  return budget
}

/**
 * Get a user's own API key (for making API calls)
 * Returns undefined if they don't have one set
 */
export async function getUserApiKey(userId: string): Promise<string | undefined> {
  const budget = await getOrCreateUserBudget(userId)

  if (budget.apiKeySource === "own" && budget.anthropicApiKey) {
    // In production, decrypt this before returning
    return budget.anthropicApiKey
  }

  return undefined
}

/**
 * Get all users with budget data (for admin)
 */
export async function getAllBudgets(): Promise<BudgetStatusReport[]> {
  const data = await loadBudgetData()
  const reports: BudgetStatusReport[] = []

  for (const userId of Object.keys(data)) {
    const report = await getBudgetStatus(userId)
    reports.push(report)
  }

  return reports
}
