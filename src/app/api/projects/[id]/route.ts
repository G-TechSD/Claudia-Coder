/**
 * Projects API - Single Project Route
 *
 * GET /api/projects/[id] - Get a single project by ID
 * PUT /api/projects/[id] - Update a project
 * DELETE /api/projects/[id] - Delete a project
 *
 * The server-side file (~/.claudia-data/projects.json) is the SOURCE OF TRUTH.
 */

import { NextRequest, NextResponse } from "next/server"
import {
  getProjectById,
  updateProject as serverUpdateProject,
  deleteProject as serverDeleteProject
} from "@/lib/data/server-projects"
import { Project } from "@/lib/data/types"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]
 *
 * Get a single project by ID.
 * Query params:
 * - userId: For access control (optional)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const userId = url.searchParams.get("userId") || undefined

    const project = await getProjectById(id, userId)

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      project
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch project"
    console.error("[api/projects/[id]] GET error:", error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/projects/[id]
 *
 * Update a project.
 * Body should contain partial project data to update.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Extract userId for access control, rest is updates
    const { userId, ...updates } = body as {
      userId?: string
      [key: string]: unknown
    }

    // Don't allow updating id, createdAt
    delete updates.id
    delete updates.createdAt

    const project = await serverUpdateProject(id, updates as Partial<Project>, userId)

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      )
    }

    console.log(`[api/projects/[id]] Updated project: ${id}`)

    return NextResponse.json({
      success: true,
      project
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project"
    console.error("[api/projects/[id]] PUT error:", error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/projects/[id]
 *
 * Delete a project.
 * Query params:
 * - userId: For access control (optional)
 * - permanent: If true, permanently delete. Otherwise, move to trash.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const userId = url.searchParams.get("userId") || undefined
    const permanent = url.searchParams.get("permanent") === "true"

    if (permanent) {
      // Permanent deletion
      const deleted = await serverDeleteProject(id, userId)

      if (!deleted) {
        return NextResponse.json(
          { success: false, error: "Project not found or access denied" },
          { status: 404 }
        )
      }

      console.log(`[api/projects/[id]] Permanently deleted project: ${id}`)

      return NextResponse.json({
        success: true,
        message: "Project permanently deleted"
      })
    } else {
      // Soft delete - move to trash
      const project = await getProjectById(id, userId)

      if (!project) {
        return NextResponse.json(
          { success: false, error: "Project not found or access denied" },
          { status: 404 }
        )
      }

      if (project.status === "trashed") {
        return NextResponse.json(
          { success: false, error: "Project is already trashed" },
          { status: 400 }
        )
      }

      const trashedProject = await serverUpdateProject(id, {
        previousStatus: project.status,
        status: "trashed",
        trashedAt: new Date().toISOString()
      }, userId)

      console.log(`[api/projects/[id]] Trashed project: ${id}`)

      return NextResponse.json({
        success: true,
        project: trashedProject
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete project"
    console.error("[api/projects/[id]] DELETE error:", error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/projects/[id]
 *
 * Partial update - same as PUT but semantically for partial updates.
 * Also used for special operations like restore from trash.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    const { userId, action, ...updates } = body as {
      userId?: string
      action?: "restore" | "star" | "unstar"
      [key: string]: unknown
    }

    // Handle special actions
    if (action === "restore") {
      const project = await getProjectById(id, userId)

      if (!project) {
        return NextResponse.json(
          { success: false, error: "Project not found" },
          { status: 404 }
        )
      }

      if (project.status !== "trashed") {
        return NextResponse.json(
          { success: false, error: "Project is not trashed" },
          { status: 400 }
        )
      }

      const restoredProject = await serverUpdateProject(id, {
        status: project.previousStatus || "active",
        previousStatus: undefined,
        trashedAt: undefined
      }, userId)

      console.log(`[api/projects/[id]] Restored project: ${id}`)

      return NextResponse.json({
        success: true,
        project: restoredProject
      })
    }

    if (action === "star") {
      const project = await serverUpdateProject(id, { starred: true }, userId)
      return NextResponse.json({ success: true, project })
    }

    if (action === "unstar") {
      const project = await serverUpdateProject(id, { starred: false }, userId)
      return NextResponse.json({ success: true, project })
    }

    // Regular partial update
    delete updates.id
    delete updates.createdAt

    const project = await serverUpdateProject(id, updates as Partial<Project>, userId)

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      project
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project"
    console.error("[api/projects/[id]] PATCH error:", error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
