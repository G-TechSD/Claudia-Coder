/**
 * Build Plans Data Store
 * Persistent storage for generated build plans with user feedback
 *
 * IMPORTANT: All build plan data is user-scoped. Build plans belong to specific users
 * and are stored in user-specific localStorage keys.
 */

import type {
  StoredBuildPlan,
  StoredBuildPlanStatus,
  PacketFeedback,
  EditedObjective,
  EditedNonGoal,
  SectionComment
} from "./types"
import {
  getUserStorageItem,
  setUserStorageItem,
  USER_STORAGE_KEYS,
  dispatchStorageChange
} from "./user-storage"

// UUID generator that works in all contexts (HTTP, HTTPS, localhost)
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Legacy storage key (kept for migration purposes)
const LEGACY_STORAGE_KEY = "claudia_build_plans"

// ============ Storage Helpers ============

/**
 * Get all build plans for a specific user from user-scoped storage
 */
function getStoredBuildPlansForUser(userId: string): StoredBuildPlan[] {
  if (typeof window === "undefined") return []

  const userPlans = getUserStorageItem<StoredBuildPlan[]>(userId, USER_STORAGE_KEYS.BUILD_PLANS)
  if (userPlans) return userPlans

  // Fallback to legacy storage and filter by userId
  const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (stored) {
    const allPlans: StoredBuildPlan[] = JSON.parse(stored)
    // For build plans, we filter by projectId ownership
    // This is handled at the query level since build plans are linked to projects
    return allPlans
  }

  return []
}

/**
 * Save build plans for a specific user
 */
function saveBuildPlansForUser(userId: string, plans: StoredBuildPlan[]): void {
  if (typeof window === "undefined") return
  setUserStorageItem(userId, USER_STORAGE_KEYS.BUILD_PLANS, plans)
  dispatchStorageChange(userId, USER_STORAGE_KEYS.BUILD_PLANS, plans)
}

/**
 * @deprecated Use getStoredBuildPlansForUser instead
 */
function getStoredBuildPlans(): StoredBuildPlan[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * @deprecated Use saveBuildPlansForUser instead
 */
function saveBuildPlans(plans: StoredBuildPlan[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(plans))
}

// ============ Build Plan CRUD ============

/**
 * Get all build plans for a user
 * @param userId - Required: The user ID
 */
export function getAllBuildPlans(userId?: string): StoredBuildPlan[] {
  if (!userId) {
    console.warn("getAllBuildPlans called without userId - returning empty array for safety")
    return []
  }
  return getStoredBuildPlansForUser(userId)
}

/**
 * Get a build plan by ID
 * @param id - The build plan ID
 * @param userId - The user ID (for access control)
 */
export function getBuildPlan(id: string, userId?: string): StoredBuildPlan | null {
  const plans = userId ? getStoredBuildPlansForUser(userId) : getStoredBuildPlans()
  return plans.find(p => p.id === id) || null
}

/**
 * Get the most recent build plan for a project
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function getBuildPlanForProject(projectId: string, userId?: string): StoredBuildPlan | null {
  const plans = userId ? getStoredBuildPlansForUser(userId) : getStoredBuildPlans()
  // Return the most recent plan for this project
  const projectPlans = plans
    .filter(p => p.projectId === projectId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  if (projectPlans[0]) {
    return projectPlans[0]
  }

  // Fallback: Check claudia_build_plans_raw (used by lib/ai/build-plan.ts)
  // This handles the case where build plans were saved via saveBuildPlan() from the AI module
  if (typeof window !== "undefined") {
    const rawStorage = localStorage.getItem("claudia_build_plans_raw")
    if (rawStorage) {
      try {
        const rawPlans = JSON.parse(rawStorage) as Record<string, unknown>
        const rawPlan = rawPlans[projectId]
        if (rawPlan && typeof rawPlan === "object") {
          // Convert raw BuildPlan to StoredBuildPlan format
          const plan = rawPlan as {
            id?: string
            projectId?: string
            createdAt?: string
            status?: string
            spec?: { objectives?: string[]; nonGoals?: string[] }
            packets?: Array<{ id: string; priority?: string }>
          }

          const now = plan.createdAt || new Date().toISOString()
          const objectives = plan.spec?.objectives || []
          const nonGoals = plan.spec?.nonGoals || []
          const packets = plan.packets || []

          const storedPlan: StoredBuildPlan = {
            id: plan.id || generateUUID(),
            projectId: projectId,
            status: (plan.status as StoredBuildPlanStatus) || "approved",
            createdAt: now,
            updatedAt: now,
            originalPlan: rawPlan as StoredBuildPlan["originalPlan"],
            editedObjectives: objectives.map((text: string, i: number) => ({
              id: `obj-${i}`,
              text,
              isOriginal: true,
              isDeleted: false
            })),
            editedNonGoals: nonGoals.map((text: string, i: number) => ({
              id: `ng-${i}`,
              text,
              isOriginal: true,
              isDeleted: false
            })),
            packetFeedback: packets.map((p: { id: string; priority?: string }) => ({
              packetId: p.id,
              approved: null,
              priority: (p.priority || "medium") as PacketFeedback["priority"],
              comment: ""
            })),
            sectionComments: [],
            generatedBy: { server: "local", model: "unknown" },
            revisionNumber: 1
          }

          return storedPlan
        }
      } catch (e) {
        console.error("Failed to parse claudia_build_plans_raw:", e)
      }
    }
  }

  return null
}

/**
 * Get all build plans for a project (history)
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function getBuildPlanHistory(projectId: string, userId?: string): StoredBuildPlan[] {
  const plans = userId ? getStoredBuildPlansForUser(userId) : getStoredBuildPlans()
  return plans
    .filter(p => p.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export interface CreateBuildPlanInput {
  projectId: string
  originalPlan: StoredBuildPlan["originalPlan"]
  generatedBy: { server: string; model: string }
  previousVersionId?: string
  revisionNotes?: string
  userId?: string  // The user creating the build plan
}

/**
 * Create a new build plan
 * @param input - Build plan input data including optional userId
 */
export function createBuildPlan(input: CreateBuildPlanInput): StoredBuildPlan {
  const userId = input.userId
  const plans = userId ? getStoredBuildPlansForUser(userId) : getStoredBuildPlans()
  const now = new Date().toISOString()

  // Get revision number for this project
  const previousPlans = plans.filter(p => p.projectId === input.projectId)
  const revisionNumber = previousPlans.length + 1

  // Ensure arrays exist with fallbacks to prevent .map() errors
  const objectives = input.originalPlan.spec.objectives || []
  const nonGoals = input.originalPlan.spec.nonGoals || []
  const packets = input.originalPlan.packets || []

  const plan: StoredBuildPlan = {
    id: generateUUID(),
    projectId: input.projectId,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    originalPlan: input.originalPlan,
    editedObjectives: objectives.map((text, i) => ({
      id: `obj-${i}`,
      text,
      isOriginal: true,
      isDeleted: false
    })),
    editedNonGoals: nonGoals.map((text, i) => ({
      id: `ng-${i}`,
      text,
      isOriginal: true,
      isDeleted: false
    })),
    packetFeedback: packets.map(p => ({
      packetId: p.id,
      approved: null,
      priority: p.priority as PacketFeedback["priority"],
      comment: ""
    })),
    sectionComments: [],
    generatedBy: input.generatedBy,
    revisionNumber,
    previousVersionId: input.previousVersionId,
    revisionNotes: input.revisionNotes
  }

  plans.push(plan)

  if (userId) {
    saveBuildPlansForUser(userId, plans)
  } else {
    saveBuildPlans(plans)
  }

  return plan
}

/**
 * Update a build plan
 * @param id - The build plan ID
 * @param updates - Partial updates
 * @param userId - The user ID (for access control)
 */
export function updateBuildPlan(
  id: string,
  updates: Partial<Omit<StoredBuildPlan, "id" | "projectId" | "createdAt">>,
  userId?: string
): StoredBuildPlan | null {
  const plans = userId ? getStoredBuildPlansForUser(userId) : getStoredBuildPlans()
  const index = plans.findIndex(p => p.id === id)

  if (index === -1) return null

  plans[index] = {
    ...plans[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  if (userId) {
    saveBuildPlansForUser(userId, plans)
  } else {
    saveBuildPlans(plans)
  }

  return plans[index]
}

/**
 * Delete a build plan
 * @param id - The build plan ID
 * @param userId - The user ID (for access control)
 */
export function deleteBuildPlan(id: string, userId?: string): boolean {
  const plans = userId ? getStoredBuildPlansForUser(userId) : getStoredBuildPlans()
  const filtered = plans.filter(p => p.id !== id)

  if (filtered.length === plans.length) return false

  if (userId) {
    saveBuildPlansForUser(userId, filtered)
  } else {
    saveBuildPlans(filtered)
  }

  return true
}

// ============ Status Management ============

/**
 * Approve a build plan
 * @param id - The build plan ID
 * @param approvedBy - Optional approver name
 * @param userId - The user ID (for access control)
 */
export function approveBuildPlan(id: string, approvedBy?: string, userId?: string): StoredBuildPlan | null {
  return updateBuildPlan(id, {
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedBy
  }, userId)
}

/**
 * Lock a build plan
 * @param id - The build plan ID
 * @param userId - The user ID (for access control)
 */
export function lockBuildPlan(id: string, userId?: string): StoredBuildPlan | null {
  return updateBuildPlan(id, {
    status: "locked",
    lockedAt: new Date().toISOString()
  }, userId)
}

/**
 * Unlock a build plan
 * @param id - The build plan ID
 * @param userId - The user ID (for access control)
 */
export function unlockBuildPlan(id: string, userId?: string): StoredBuildPlan | null {
  const plan = getBuildPlan(id, userId)
  if (!plan) return null

  return updateBuildPlan(id, {
    status: plan.approvedAt ? "approved" : "draft",
    lockedAt: undefined
  }, userId)
}

// ============ Feedback Management ============

/**
 * Update objectives for a build plan
 * @param planId - The build plan ID
 * @param objectives - Updated objectives
 * @param userId - The user ID (for access control)
 */
export function updateObjectives(
  planId: string,
  objectives: EditedObjective[],
  userId?: string
): StoredBuildPlan | null {
  return updateBuildPlan(planId, { editedObjectives: objectives }, userId)
}

/**
 * Update non-goals for a build plan
 * @param planId - The build plan ID
 * @param nonGoals - Updated non-goals
 * @param userId - The user ID (for access control)
 */
export function updateNonGoals(
  planId: string,
  nonGoals: EditedNonGoal[],
  userId?: string
): StoredBuildPlan | null {
  return updateBuildPlan(planId, { editedNonGoals: nonGoals }, userId)
}

/**
 * Update packet feedback for a build plan
 * @param planId - The build plan ID
 * @param feedback - Updated feedback
 * @param userId - The user ID (for access control)
 */
export function updatePacketFeedback(
  planId: string,
  feedback: PacketFeedback[],
  userId?: string
): StoredBuildPlan | null {
  return updateBuildPlan(planId, { packetFeedback: feedback }, userId)
}

/**
 * Add a section comment to a build plan
 * @param planId - The build plan ID
 * @param sectionId - The section ID
 * @param comment - The comment text
 * @param userId - The user ID (for access control)
 */
export function addSectionComment(
  planId: string,
  sectionId: string,
  comment: string,
  userId?: string
): StoredBuildPlan | null {
  const plan = getBuildPlan(planId, userId)
  if (!plan) return null

  const existingIndex = plan.sectionComments.findIndex(c => c.sectionId === sectionId)
  const updatedComments = [...plan.sectionComments]

  if (existingIndex >= 0) {
    updatedComments[existingIndex] = {
      sectionId,
      comment,
      createdAt: new Date().toISOString()
    }
  } else {
    updatedComments.push({
      sectionId,
      comment,
      createdAt: new Date().toISOString()
    })
  }

  return updateBuildPlan(planId, { sectionComments: updatedComments }, userId)
}

// ============ Revision Helpers ============

export interface RevisionContext {
  editedObjectives: EditedObjective[]
  editedNonGoals: EditedNonGoal[]
  packetFeedback: PacketFeedback[]
  sectionComments: SectionComment[]
}

/**
 * Get revision context for a build plan
 * @param planId - The build plan ID
 * @param userId - The user ID (for access control)
 */
export function getRevisionContext(planId: string, userId?: string): RevisionContext | null {
  const plan = getBuildPlan(planId, userId)
  if (!plan) return null

  return {
    editedObjectives: plan.editedObjectives,
    editedNonGoals: plan.editedNonGoals,
    packetFeedback: plan.packetFeedback,
    sectionComments: plan.sectionComments
  }
}

// Format user feedback for LLM revision prompt
export function formatFeedbackForRevision(context: RevisionContext): string {
  const parts: string[] = []

  // Added objectives
  const addedObjectives = context.editedObjectives.filter(o => !o.isOriginal && !o.isDeleted)
  if (addedObjectives.length > 0) {
    parts.push(`ADDED OBJECTIVES:\n${addedObjectives.map(o => `- ${o.text}`).join("\n")}`)
  }

  // Removed objectives
  const removedObjectives = context.editedObjectives.filter(o => o.isOriginal && o.isDeleted)
  if (removedObjectives.length > 0) {
    parts.push(`REMOVED OBJECTIVES (user doesn't want these):\n${removedObjectives.map(o => `- ${o.text}`).join("\n")}`)
  }

  // Added non-goals
  const addedNonGoals = context.editedNonGoals.filter(ng => !ng.isOriginal && !ng.isDeleted)
  if (addedNonGoals.length > 0) {
    parts.push(`ADDED OUT-OF-SCOPE ITEMS:\n${addedNonGoals.map(ng => `- ${ng.text}`).join("\n")}`)
  }

  // Removed non-goals
  const removedNonGoals = context.editedNonGoals.filter(ng => ng.isOriginal && ng.isDeleted)
  if (removedNonGoals.length > 0) {
    parts.push(`ITEMS USER WANTS BACK IN SCOPE:\n${removedNonGoals.map(ng => `- ${ng.text}`).join("\n")}`)
  }

  // Rejected packets
  const rejectedPackets = context.packetFeedback.filter(pf => pf.approved === false)
  if (rejectedPackets.length > 0) {
    parts.push(`REJECTED WORK PACKETS (user doesn't want these):\n${rejectedPackets.map(pf =>
      `- Packet ${pf.packetId}${pf.comment ? `: "${pf.comment}"` : ""}`
    ).join("\n")}`)
  }

  // Priority changes
  const priorityChanges = context.packetFeedback.filter(pf => pf.approved === true && pf.comment)
  if (priorityChanges.length > 0) {
    parts.push(`PACKET NOTES:\n${priorityChanges.map(pf =>
      `- Packet ${pf.packetId}: ${pf.comment}`
    ).join("\n")}`)
  }

  // Section comments
  const comments = context.sectionComments.filter(sc => sc.comment.trim())
  if (comments.length > 0) {
    parts.push(`USER COMMENTS ON SECTIONS:\n${comments.map(sc =>
      `- ${sc.sectionId}: "${sc.comment}"`
    ).join("\n")}`)
  }

  return parts.join("\n\n")
}

// ============ Query Helpers ============

/**
 * Get all draft build plans for a user
 * @param userId - Required: The user ID
 */
export function getDraftPlans(userId: string): StoredBuildPlan[] {
  if (!userId) return []
  return getStoredBuildPlansForUser(userId).filter(p => p.status === "draft")
}

/**
 * Get all approved build plans for a user
 * @param userId - Required: The user ID
 */
export function getApprovedPlans(userId: string): StoredBuildPlan[] {
  if (!userId) return []
  return getStoredBuildPlansForUser(userId).filter(p => p.status === "approved")
}

/**
 * Get all locked build plans for a user
 * @param userId - Required: The user ID
 */
export function getLockedPlans(userId: string): StoredBuildPlan[] {
  if (!userId) return []
  return getStoredBuildPlansForUser(userId).filter(p => p.status === "locked")
}
