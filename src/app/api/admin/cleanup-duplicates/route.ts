/**
 * Admin Duplicate Project Cleanup API
 * GET - List duplicate projects (same name)
 * DELETE - Remove duplicates keeping most recent
 *
 * Checks both legacy storage (claudia_projects) and
 * user-scoped storage (claudia_user_{userId}_projects)
 */

import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/api-helpers"
import { getAllUsers } from "@/lib/data/users"

interface StoredProject {
  id: string
  name: string
  userId?: string
  createdAt: string
  updatedAt: string
  status?: string
  [key: string]: unknown
}

interface DuplicateGroup {
  name: string
  projects: StoredProject[]
  keepId: string
  removeIds: string[]
}

interface CleanupSummary {
  legacyDuplicates: DuplicateGroup[]
  userDuplicates: Record<string, DuplicateGroup[]>
  totalDuplicateGroups: number
  totalProjectsToRemove: number
}

/**
 * Find duplicate projects in an array (same name)
 * Groups by name and identifies which to keep (most recent) and remove
 */
function findDuplicates(projects: StoredProject[]): DuplicateGroup[] {
  // Group projects by normalized name
  const byName = new Map<string, StoredProject[]>()

  for (const project of projects) {
    const normalizedName = project.name.toLowerCase().trim()
    const existing = byName.get(normalizedName) || []
    existing.push(project)
    byName.set(normalizedName, existing)
  }

  // Find groups with more than one project (duplicates)
  const duplicateGroups: DuplicateGroup[] = []

  for (const [, group] of byName) {
    if (group.length > 1) {
      // Sort by updatedAt descending (most recent first)
      const sorted = [...group].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime()
        const dateB = new Date(b.updatedAt || b.createdAt).getTime()
        return dateB - dateA
      })

      const [keep, ...remove] = sorted

      duplicateGroups.push({
        name: keep.name,
        projects: sorted,
        keepId: keep.id,
        removeIds: remove.map((p) => p.id),
      })
    }
  }

  return duplicateGroups
}

/**
 * GET /api/admin/cleanup-duplicates
 * List all duplicate projects across legacy and user-scoped storage
 */
export const GET = withRole("admin")(async () => {
  try {
    // Note: This runs server-side so we need to read localStorage data from the client
    // For admin purposes, we'll provide instructions and a summary structure
    // The actual localStorage access must happen client-side

    // Get all users to check their storage
    const users = getAllUsers()

    const summary: CleanupSummary = {
      legacyDuplicates: [],
      userDuplicates: {},
      totalDuplicateGroups: 0,
      totalProjectsToRemove: 0,
    }

    return NextResponse.json({
      success: true,
      message:
        "Duplicate detection requires client-side execution. Use POST with storage data.",
      users: users.map((u) => ({ id: u.id, email: u.email, name: u.name })),
      storageKeys: {
        legacy: "claudia_projects",
        userPattern: "claudia_user_{userId}_projects",
      },
      summary,
      instructions: {
        step1:
          "Fetch localStorage data from client: localStorage.getItem('claudia_projects')",
        step2:
          "For each user, fetch: localStorage.getItem(`claudia_user_${userId}_projects`)",
        step3: "POST the collected data to this endpoint for analysis",
      },
    })
  } catch (error) {
    console.error("[Admin Cleanup] List error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to list duplicates" },
      { status: 500 }
    )
  }
})

/**
 * POST /api/admin/cleanup-duplicates
 * Analyze provided storage data for duplicates
 *
 * Body: {
 *   legacyProjects?: StoredProject[],
 *   userProjects?: Record<string, StoredProject[]>
 * }
 */
export const POST = withRole("admin")(async (_auth, request) => {
  try {
    const body = await request.json()
    const { legacyProjects, userProjects } = body as {
      legacyProjects?: StoredProject[]
      userProjects?: Record<string, StoredProject[]>
    }

    const summary: CleanupSummary = {
      legacyDuplicates: [],
      userDuplicates: {},
      totalDuplicateGroups: 0,
      totalProjectsToRemove: 0,
    }

    // Find duplicates in legacy storage
    if (legacyProjects && Array.isArray(legacyProjects)) {
      summary.legacyDuplicates = findDuplicates(legacyProjects)
      summary.totalDuplicateGroups += summary.legacyDuplicates.length
      summary.totalProjectsToRemove += summary.legacyDuplicates.reduce(
        (acc, g) => acc + g.removeIds.length,
        0
      )
    }

    // Find duplicates in each user's storage
    if (userProjects && typeof userProjects === "object") {
      for (const [userId, projects] of Object.entries(userProjects)) {
        if (Array.isArray(projects)) {
          const duplicates = findDuplicates(projects)
          if (duplicates.length > 0) {
            summary.userDuplicates[userId] = duplicates
            summary.totalDuplicateGroups += duplicates.length
            summary.totalProjectsToRemove += duplicates.reduce(
              (acc, g) => acc + g.removeIds.length,
              0
            )
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary,
      message:
        summary.totalDuplicateGroups > 0
          ? `Found ${summary.totalDuplicateGroups} duplicate groups with ${summary.totalProjectsToRemove} projects to remove`
          : "No duplicates found",
    })
  } catch (error) {
    console.error("[Admin Cleanup] Analyze error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to analyze duplicates" },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/admin/cleanup-duplicates
 * Remove duplicate projects, keeping the most recent
 *
 * Body: {
 *   legacyProjects?: StoredProject[],
 *   userProjects?: Record<string, StoredProject[]>,
 *   dryRun?: boolean
 * }
 *
 * Returns cleaned data that should be saved back to localStorage
 */
export const DELETE = withRole("admin")(async (_auth, request) => {
  try {
    const body = await request.json()
    const { legacyProjects, userProjects, dryRun = false } = body as {
      legacyProjects?: StoredProject[]
      userProjects?: Record<string, StoredProject[]>
      dryRun?: boolean
    }

    const result = {
      cleanedLegacyProjects: null as StoredProject[] | null,
      cleanedUserProjects: {} as Record<string, StoredProject[]>,
      removed: {
        legacy: [] as string[],
        users: {} as Record<string, string[]>,
      },
      summary: {
        totalRemoved: 0,
        legacyRemoved: 0,
        usersAffected: 0,
      },
    }

    // Clean legacy projects
    if (legacyProjects && Array.isArray(legacyProjects)) {
      const duplicates = findDuplicates(legacyProjects)
      const idsToRemove = new Set(duplicates.flatMap((g) => g.removeIds))

      result.cleanedLegacyProjects = legacyProjects.filter(
        (p) => !idsToRemove.has(p.id)
      )
      result.removed.legacy = Array.from(idsToRemove)
      result.summary.legacyRemoved = idsToRemove.size
      result.summary.totalRemoved += idsToRemove.size
    }

    // Clean user projects
    if (userProjects && typeof userProjects === "object") {
      for (const [userId, projects] of Object.entries(userProjects)) {
        if (Array.isArray(projects)) {
          const duplicates = findDuplicates(projects)
          const idsToRemove = new Set(duplicates.flatMap((g) => g.removeIds))

          if (idsToRemove.size > 0) {
            result.cleanedUserProjects[userId] = projects.filter(
              (p) => !idsToRemove.has(p.id)
            )
            result.removed.users[userId] = Array.from(idsToRemove)
            result.summary.totalRemoved += idsToRemove.size
            result.summary.usersAffected++
          } else {
            // No duplicates - keep original
            result.cleanedUserProjects[userId] = projects
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      result,
      message: dryRun
        ? `Dry run: Would remove ${result.summary.totalRemoved} duplicate projects`
        : `Cleanup complete: Removed ${result.summary.totalRemoved} duplicate projects`,
      instructions: dryRun
        ? "Set dryRun: false to perform actual cleanup"
        : "Save the cleaned data back to localStorage",
    })
  } catch (error) {
    console.error("[Admin Cleanup] Delete error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to cleanup duplicates" },
      { status: 500 }
    )
  }
})
