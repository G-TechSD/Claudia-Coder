/**
 * Wiki API Routes
 *
 * GET - List all wiki documents (with optional filters)
 * POST - Create a new wiki document
 */

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/middleware"
import {
  getWikiDocumentsForUser,
  getWikiDocumentsByType,
  getWikiDocumentsByProject,
  searchWikiDocuments,
  createWikiDocument,
  WikiDocType,
} from "@/lib/data/server-wiki"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") as WikiDocType | null
    const projectId = searchParams.get("projectId")
    const search = searchParams.get("search")

    let documents

    if (search) {
      documents = await searchWikiDocuments(search)
    } else if (type) {
      documents = await getWikiDocumentsByType(type)
    } else if (projectId) {
      documents = await getWikiDocumentsByProject(projectId)
    } else {
      documents = await getWikiDocumentsForUser(user.id)
    }

    return NextResponse.json({ documents })
  } catch (error) {
    console.error("[Wiki API] GET error:", error)
    return NextResponse.json(
      { error: "Failed to fetch wiki documents" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { title, content, type, tags, parentId, projectId, isPublished } = body

    if (!title || !content || !type) {
      return NextResponse.json(
        { error: "Title, content, and type are required" },
        { status: 400 }
      )
    }

    const document = await createWikiDocument({
      title,
      content,
      type,
      tags: tags || [],
      parentId,
      projectId,
      createdBy: user.id,
      updatedBy: user.id,
      isPublished: isPublished ?? true,
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error("[Wiki API] POST error:", error)
    return NextResponse.json(
      { error: "Failed to create wiki document" },
      { status: 500 }
    )
  }
}
