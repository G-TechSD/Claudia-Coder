/**
 * Admin API: Migrate Interview Data
 *
 * This endpoint migrates legacy creationInterview data to the new
 * multi-interview system (interviewIds array).
 *
 * POST /api/admin/migrate-interviews
 * - Finds all projects with creationInterview but no interviewIds
 * - Migrates each to the new system
 * - Returns migration results
 */

import { NextResponse } from "next/server"
import { migrateCreationInterview, getProjects } from "@/lib/data/projects"

export async function POST() {
  try {
    // Get all projects
    const allProjects = getProjects()

    // Find projects that need migration (have creationInterview but no interviewIds)
    const projectsToMigrate = allProjects.filter(
      (p) => p.creationInterview && (!p.interviewIds || p.interviewIds.length === 0)
    )

    const results = {
      totalProjects: allProjects.length,
      projectsWithLegacyInterview: projectsToMigrate.length,
      migratedSuccessfully: 0,
      migrationFailed: 0,
      details: [] as Array<{
        projectId: string
        projectName: string
        status: "success" | "failed"
        error?: string
      }>
    }

    // Migrate each project
    for (const project of projectsToMigrate) {
      try {
        const migrated = migrateCreationInterview(project.id)

        if (migrated) {
          results.migratedSuccessfully++
          results.details.push({
            projectId: project.id,
            projectName: project.name,
            status: "success"
          })
        } else {
          results.migrationFailed++
          results.details.push({
            projectId: project.id,
            projectName: project.name,
            status: "failed",
            error: "Migration returned null"
          })
        }
      } catch (error) {
        results.migrationFailed++
        results.details.push({
          projectId: project.id,
          projectName: project.name,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration complete: ${results.migratedSuccessfully} of ${results.projectsWithLegacyInterview} projects migrated`,
      results
    })
  } catch (error) {
    console.error("[migrate-interviews] Migration failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get migration status without performing migration
    const allProjects = getProjects()

    const stats = {
      totalProjects: allProjects.length,
      projectsWithLegacyInterview: 0,
      projectsAlreadyMigrated: 0,
      projectsWithoutInterview: 0
    }

    for (const project of allProjects) {
      if (project.creationInterview && (!project.interviewIds || project.interviewIds.length === 0)) {
        stats.projectsWithLegacyInterview++
      } else if (project.interviewIds && project.interviewIds.length > 0) {
        stats.projectsAlreadyMigrated++
      } else {
        stats.projectsWithoutInterview++
      }
    }

    return NextResponse.json({
      success: true,
      stats,
      needsMigration: stats.projectsWithLegacyInterview > 0
    })
  } catch (error) {
    console.error("[migrate-interviews] Status check failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
