/**
 * Individual Patent API
 * GET /api/patents/[id] - Get a single patent with all claims, prior art, and searches
 * PUT /api/patents/[id] - Update patent details (supports various _action operations)
 * DELETE /api/patents/[id] - Delete a patent
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionWithBypass } from "@/lib/auth/api-helpers"
import {
  getPatentResearchById,
  updatePatentResearch,
  deletePatentResearch,
  getPatentClaimsByPatentId,
  getPatentPriorArtByPatentId,
  getPatentSearchesByPatentId,
  createPatentPriorArt,
  deletePatentPriorArt,
  type PatentResearch as DbPatentResearch,
  type PatentClaim as DbPatentClaim,
  type PatentPriorArt as DbPatentPriorArt,
} from "@/lib/auth/patent-db"
import type { PatentResearch, PatentResearchStatus, PatentPriorArt, PatentResearchClaim } from "@/lib/data/types"

interface RouteParams {
  params: Promise<{ id: string }>
}

// Status mapping between database and frontend
const dbStatusToFrontend: Record<DbPatentResearch["status"], PatentResearchStatus> = {
  draft: "research",
  in_progress: "drafting",
  filed: "filed",
  granted: "approved",
  rejected: "rejected",
  abandoned: "rejected",
}

const frontendStatusToDb: Record<PatentResearchStatus, DbPatentResearch["status"]> = {
  research: "draft",
  drafting: "in_progress",
  review: "in_progress",
  filed: "filed",
  approved: "granted",
  rejected: "rejected",
}

// Transform database patent to frontend format
function transformPatentToFrontend(
  dbPatent: DbPatentResearch,
  claims: DbPatentClaim[] = [],
  priorArt: DbPatentPriorArt[] = []
): PatentResearch {
  return {
    id: dbPatent.id,
    title: dbPatent.title,
    status: dbStatusToFrontend[dbPatent.status] || "research",
    createdAt: dbPatent.createdAt,
    updatedAt: dbPatent.updatedAt,
    projectId: undefined,
    businessIdeaId: undefined,
    inventionDescription: {
      summary: dbPatent.description || "",
      technicalField: dbPatent.technicalField || undefined,
      background: dbPatent.inventionDescription || undefined,
    },
    priorArt: priorArt.map(transformPriorArtToFrontend),
    claims: claims.map(transformClaimToFrontend),
    attorneys: [],
    tags: dbPatent.tags || [],
    targetFilingDate: dbPatent.filingDeadline || undefined,
  }
}

function transformPriorArtToFrontend(dbPriorArt: DbPatentPriorArt): PatentPriorArt {
  return {
    id: dbPriorArt.id,
    title: dbPriorArt.title,
    patentNumber: dbPriorArt.patentNumber || undefined,
    inventor: dbPriorArt.inventor || undefined,
    abstract: dbPriorArt.abstract || undefined,
    url: dbPriorArt.url || undefined,
    publicationDate: dbPriorArt.publicationDate || undefined,
    relevance: dbPriorArt.relevanceScore >= 0.7 ? "high" : dbPriorArt.relevanceScore >= 0.4 ? "medium" : "low",
    notes: dbPriorArt.notes || "",
    addedAt: dbPriorArt.createdAt,
  }
}

function transformClaimToFrontend(dbClaim: DbPatentClaim): PatentResearchClaim {
  const statusMap: Record<DbPatentClaim["status"], PatentResearchClaim["status"]> = {
    draft: "draft",
    review: "reviewed",
    approved: "approved",
    rejected: "draft",
  }

  return {
    id: dbClaim.id,
    number: dbClaim.claimNumber || 1,
    type: dbClaim.type,
    dependsOn: dbClaim.dependencies?.length ? parseInt(dbClaim.dependencies[0]) : undefined,
    text: dbClaim.text,
    status: statusMap[dbClaim.status] || "draft",
    notes: dbClaim.notes || undefined,
    createdAt: dbClaim.createdAt,
    updatedAt: dbClaim.updatedAt,
  }
}

// Helper to get full patent with transformed data
function getFullPatent(id: string): PatentResearch | null {
  const dbPatent = getPatentResearchById(id)
  if (!dbPatent) return null

  const claims = getPatentClaimsByPatentId(id)
  const priorArt = getPatentPriorArtByPatentId(id)
  return transformPatentToFrontend(dbPatent, claims, priorArt)
}

/**
 * GET /api/patents/[id]
 * Get a single patent with all its claims, prior art, and searches
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    const dbPatent = getPatentResearchById(id)

    if (!dbPatent) {
      return NextResponse.json(
        { error: "Patent not found" },
        { status: 404 }
      )
    }

    // Verify ownership
    if (dbPatent.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Get related data and transform to frontend format
    const claims = getPatentClaimsByPatentId(id)
    const priorArt = getPatentPriorArtByPatentId(id)
    const patent = transformPatentToFrontend(dbPatent, claims, priorArt)

    return NextResponse.json({
      success: true,
      patent,
    })
  } catch (error) {
    console.error("[Patents API] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch patent" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/patents/[id]
 * Update patent details - supports various actions via _action field
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()

    const existing = getPatentResearchById(id)
    if (!existing) {
      return NextResponse.json(
        { error: "Patent not found" },
        { status: 404 }
      )
    }

    // Verify ownership
    if (existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Handle special actions
    const action = body._action

    if (action === "addPriorArt") {
      const priorArt = body.priorArt
      const relevanceScore = priorArt.relevance === "high" ? 0.8 : priorArt.relevance === "medium" ? 0.5 : 0.2

      createPatentPriorArt({
        patentId: id,
        title: priorArt.title,
        patentNumber: priorArt.patentNumber,
        inventor: priorArt.inventor,
        abstract: priorArt.abstract,
        url: priorArt.url,
        publicationDate: priorArt.publicationDate,
        relevanceScore,
        notes: priorArt.notes,
      })

      const patent = getFullPatent(id)
      return NextResponse.json({ success: true, patent })
    }

    if (action === "removePriorArt") {
      deletePatentPriorArt(body.priorArtId)
      const patent = getFullPatent(id)
      return NextResponse.json({ success: true, patent })
    }

    if (action === "updateInventionDescription") {
      const desc = body.description
      updatePatentResearch(id, {
        description: desc.summary,
        inventionDescription: desc.background,
        technicalField: desc.technicalField,
      })
      const patent = getFullPatent(id)
      return NextResponse.json({ success: true, patent })
    }

    // Handle frontend status to database status conversion
    let dbStatus = body.status
    if (body.status && Object.keys(frontendStatusToDb).includes(body.status)) {
      dbStatus = frontendStatusToDb[body.status as PatentResearchStatus]
    }

    // Handle inventionDescription from frontend format
    let description = body.description
    let inventionDescription = body.inventionDescription
    let technicalField = body.technicalField

    if (body.inventionDescription && typeof body.inventionDescription === "object") {
      description = body.inventionDescription.summary || description
      inventionDescription = body.inventionDescription.background || inventionDescription
      technicalField = body.inventionDescription.technicalField || technicalField
    }

    // Regular update
    const dbPatent = updatePatentResearch(id, {
      title: body.title,
      description,
      inventionDescription,
      technicalField,
      status: dbStatus,
      tags: body.tags,
      priority: body.priority,
      filingDeadline: body.targetFilingDate || body.filingDeadline,
    })

    if (!dbPatent) {
      return NextResponse.json(
        { error: "Failed to update patent" },
        { status: 500 }
      )
    }

    const patent = getFullPatent(id)

    return NextResponse.json({
      success: true,
      patent,
    })
  } catch (error) {
    console.error("[Patents API] PUT error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update patent" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/patents/[id]
 * Delete a patent
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    const existing = getPatentResearchById(id)
    if (!existing) {
      return NextResponse.json(
        { error: "Patent not found" },
        { status: 404 }
      )
    }

    // Verify ownership
    if (existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const deleted = deletePatentResearch(id)

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete patent" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Patent deleted successfully",
    })
  } catch (error) {
    console.error("[Patents API] DELETE error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete patent" },
      { status: 500 }
    )
  }
}
