/**
 * Resources API Route
 *
 * GET /api/resources - List resources (with optional projectId filter)
 * POST /api/resources - Create a new resource
 * PUT /api/resources - Update a resource
 * DELETE /api/resources - Delete a resource
 */

import { NextRequest, NextResponse } from "next/server"
import {
  readResourcesFile,
  addResource,
  updateResource,
  deleteResource,
  getResourcesForProject,
  Resource
} from "@/lib/data/server-resources"
import { getSessionWithBypass, unauthorizedResponse } from "@/lib/auth/api-helpers"

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionWithBypass()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    let resources: Resource[]
    if (projectId) {
      resources = await getResourcesForProject(projectId)
    } else {
      resources = await readResourcesFile()
      // Filter by user
      resources = resources.filter(r => r.userId === session.user.id || !r.userId)
    }

    return NextResponse.json({
      success: true,
      resources
    })
  } catch (error) {
    console.error("[resources] GET error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch resources" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithBypass()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const resource: Resource = {
      id: body.id || `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId: body.projectId,
      type: body.type || "other",
      name: body.name,
      url: body.url,
      content: body.content,
      description: body.description,
      tags: body.tags || [],
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: session.user.id
    }

    const created = await addResource(resource)

    return NextResponse.json({
      success: true,
      resource: created
    })
  } catch (error) {
    console.error("[resources] POST error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create resource" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionWithBypass()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Resource ID required" },
        { status: 400 }
      )
    }

    const updated = await updateResource(id, updates)

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Resource not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      resource: updated
    })
  } catch (error) {
    console.error("[resources] PUT error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update resource" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionWithBypass()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Resource ID required" },
        { status: 400 }
      )
    }

    const deleted = await deleteResource(id)

    return NextResponse.json({
      success: deleted,
      error: deleted ? undefined : "Resource not found"
    })
  } catch (error) {
    console.error("[resources] DELETE error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete resource" },
      { status: 500 }
    )
  }
}
