/**
 * Individual Project Document API
 *
 * Manages individual typed documents stored in .local-storage/projects/{projectId}/docs/
 *
 * Endpoints:
 * - GET: Read a specific document
 * - PUT: Update a document
 * - DELETE: Delete a document
 */

import { NextRequest, NextResponse } from "next/server"
import {
  getDoc,
  updateDoc,
  deleteDoc,
  type ProjectDocType
} from "@/lib/data/project-docs"

interface RouteParams {
  params: Promise<{ id: string; docId: string }>
}

/**
 * GET /api/projects/[id]/docs/[docId]
 * Read a specific document
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId, docId } = await params

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    if (!docId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      )
    }

    const doc = await getDoc(projectId, docId)

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      doc
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get document"
    console.error("[docs/docId] GET error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/projects/[id]/docs/[docId]
 * Update a document
 *
 * Body: {
 *   title?: string
 *   content?: string
 *   type?: "vision" | "story" | "notes" | "specs"
 *   tags?: string[]
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId, docId } = await params
    const body = await request.json()

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    if (!docId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      )
    }

    // Check if document exists
    const existing = await getDoc(projectId, docId)
    if (!existing) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    // Validate type if provided
    if (body.type) {
      const validTypes: ProjectDocType[] = ["vision", "story", "notes", "specs"]
      if (!validTypes.includes(body.type)) {
        return NextResponse.json(
          { error: `Invalid document type. Must be one of: ${validTypes.join(", ")}` },
          { status: 400 }
        )
      }
    }

    // Build updates object
    const updates: {
      title?: string
      content?: string
      type?: ProjectDocType
      tags?: string[]
    } = {}

    if (body.title !== undefined) updates.title = body.title
    if (body.content !== undefined) updates.content = body.content
    if (body.type !== undefined) updates.type = body.type
    if (body.tags !== undefined) updates.tags = body.tags

    // Check if there are any updates
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      )
    }

    // Update the document
    const updated = await updateDoc(projectId, docId, updates)

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update document" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      doc: updated
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update document"
    console.error("[docs/docId] PUT error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/projects/[id]/docs/[docId]
 * Delete a document
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId, docId } = await params

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    if (!docId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      )
    }

    // Check if document exists
    const existing = await getDoc(projectId, docId)
    if (!existing) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    // Delete the document
    const deleted = await deleteDoc(projectId, docId)

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully"
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete document"
    console.error("[docs/docId] DELETE error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
