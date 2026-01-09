/**
 * Build Plans Data Store
 * Persistent storage for generated build plans with user feedback
 */

import type {
  StoredBuildPlan,
  StoredBuildPlanStatus,
  PacketFeedback,
  EditedObjective,
  EditedNonGoal,
  SectionComment
} from "./types"

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

const STORAGE_KEY = "claudia_build_plans"

// ============ Storage Helpers ============

function getStoredBuildPlans(): StoredBuildPlan[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveBuildPlans(plans: StoredBuildPlan[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
}

// ============ Build Plan CRUD ============

export function getAllBuildPlans(): StoredBuildPlan[] {
  return getStoredBuildPlans()
}

export function getBuildPlan(id: string): StoredBuildPlan | null {
  const plans = getStoredBuildPlans()
  return plans.find(p => p.id === id) || null
}

export function getBuildPlanForProject(projectId: string): StoredBuildPlan | null {
  const plans = getStoredBuildPlans()
  // Return the most recent plan for this project
  const projectPlans = plans
    .filter(p => p.projectId === projectId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return projectPlans[0] || null
}

export function getBuildPlanHistory(projectId: string): StoredBuildPlan[] {
  const plans = getStoredBuildPlans()
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
}

export function createBuildPlan(input: CreateBuildPlanInput): StoredBuildPlan {
  const plans = getStoredBuildPlans()
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
  saveBuildPlans(plans)
  return plan
}

export function updateBuildPlan(
  id: string,
  updates: Partial<Omit<StoredBuildPlan, "id" | "projectId" | "createdAt">>
): StoredBuildPlan | null {
  const plans = getStoredBuildPlans()
  const index = plans.findIndex(p => p.id === id)

  if (index === -1) return null

  plans[index] = {
    ...plans[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveBuildPlans(plans)
  return plans[index]
}

export function deleteBuildPlan(id: string): boolean {
  const plans = getStoredBuildPlans()
  const filtered = plans.filter(p => p.id !== id)

  if (filtered.length === plans.length) return false

  saveBuildPlans(filtered)
  return true
}

// ============ Status Management ============

export function approveBuildPlan(id: string, approvedBy?: string): StoredBuildPlan | null {
  return updateBuildPlan(id, {
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedBy
  })
}

export function lockBuildPlan(id: string): StoredBuildPlan | null {
  return updateBuildPlan(id, {
    status: "locked",
    lockedAt: new Date().toISOString()
  })
}

export function unlockBuildPlan(id: string): StoredBuildPlan | null {
  const plan = getBuildPlan(id)
  if (!plan) return null

  return updateBuildPlan(id, {
    status: plan.approvedAt ? "approved" : "draft",
    lockedAt: undefined
  })
}

// ============ Feedback Management ============

export function updateObjectives(
  planId: string,
  objectives: EditedObjective[]
): StoredBuildPlan | null {
  return updateBuildPlan(planId, { editedObjectives: objectives })
}

export function updateNonGoals(
  planId: string,
  nonGoals: EditedNonGoal[]
): StoredBuildPlan | null {
  return updateBuildPlan(planId, { editedNonGoals: nonGoals })
}

export function updatePacketFeedback(
  planId: string,
  feedback: PacketFeedback[]
): StoredBuildPlan | null {
  return updateBuildPlan(planId, { packetFeedback: feedback })
}

export function addSectionComment(
  planId: string,
  sectionId: string,
  comment: string
): StoredBuildPlan | null {
  const plan = getBuildPlan(planId)
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

  return updateBuildPlan(planId, { sectionComments: updatedComments })
}

// ============ Revision Helpers ============

export interface RevisionContext {
  editedObjectives: EditedObjective[]
  editedNonGoals: EditedNonGoal[]
  packetFeedback: PacketFeedback[]
  sectionComments: SectionComment[]
}

export function getRevisionContext(planId: string): RevisionContext | null {
  const plan = getBuildPlan(planId)
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

export function getDraftPlans(): StoredBuildPlan[] {
  return getStoredBuildPlans().filter(p => p.status === "draft")
}

export function getApprovedPlans(): StoredBuildPlan[] {
  return getStoredBuildPlans().filter(p => p.status === "approved")
}

export function getLockedPlans(): StoredBuildPlan[] {
  return getStoredBuildPlans().filter(p => p.status === "locked")
}
