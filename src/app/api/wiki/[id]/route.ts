/**
 * Wiki Document API Routes
 *
 * GET - Get a single wiki document
 * PUT - Update a wiki document
 * DELETE - Delete a wiki document
 */

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/middleware"
import {
  getWikiDocumentById,
  updateWikiDocument,
  deleteWikiDocument,
} from "@/lib/data/server-wiki"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const document = await getWikiDocumentById(id)

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error("[Wiki API] GET error:", error)
    return NextResponse.json(
      { error: "Failed to fetch wiki document" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, content, type, tags, parentId, projectId, isPublished } = body

    const document = await updateWikiDocument(id, {
      title,
      content,
      type,
      tags,
      parentId,
      projectId,
      isPublished,
      updatedBy: user.id,
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error("[Wiki API] PUT error:", error)
    return NextResponse.json(
      { error: "Failed to update wiki document" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const success = await deleteWikiDocument(id)

    if (!success) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Wiki API] DELETE error:", error)
    return NextResponse.json(
      { error: "Failed to delete wiki document" },
      { status: 500 }
    )
  }
}
