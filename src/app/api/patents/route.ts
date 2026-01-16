/**
 * Patents API
 * GET /api/patents - List all patent research projects for the current user
 * POST /api/patents - Create a new patent research project
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionWithBypass } from "@/lib/auth/api-helpers"
import {
  getPatentResearchByUserId,
  createPatentResearch,
  getPatentResearchByStatus,
  getPatentResearchWithDetails,
  getPatentClaimsByPatentId,
  getPatentPriorArtByPatentId,
  type PatentResearch as DbPatentResearch,
  type PatentClaim as DbPatentClaim,
  type PatentPriorArt as DbPatentPriorArt,
} from "@/lib/auth/patent-db"
import type { PatentResearch, PatentResearchStatus, PatentPriorArt, PatentResearchClaim } from "@/lib/data/types"

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

// Calculate stats from patents
function calculateStats(patents: DbPatentResearch[]): {
  total: number
  byStatus: Record<PatentResearchStatus, number>
} {
  const byStatus: Record<PatentResearchStatus, number> = {
    research: 0,
    drafting: 0,
    review: 0,
    filed: 0,
    approved: 0,
    rejected: 0,
  }

  for (const patent of patents) {
    const frontendStatus = dbStatusToFrontend[patent.status] || "research"
    byStatus[frontendStatus]++
  }

  return {
    total: patents.length,
    byStatus,
  }
}

/**
 * GET /api/patents
 * List all patents for the current user with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const includeStats = searchParams.get("includeStats") === "true"

    let dbPatents: DbPatentResearch[]

    if (status && status !== "all") {
      // Map frontend status to db status and filter
      const dbStatus = frontendStatusToDb[status as PatentResearchStatus]
      if (dbStatus) {
        dbPatents = getPatentResearchByStatus(session.user.id, dbStatus)
      } else {
        dbPatents = getPatentResearchByUserId(session.user.id)
      }
    } else {
      // Get all patents for user
      dbPatents = getPatentResearchByUserId(session.user.id)
    }

    // Transform to frontend format with claims and prior art
    const patents = dbPatents.map(dbPatent => {
      const claims = getPatentClaimsByPatentId(dbPatent.id)
      const priorArt = getPatentPriorArtByPatentId(dbPatent.id)
      return transformPatentToFrontend(dbPatent, claims, priorArt)
    })

    const response: {
      success: boolean
      patents: PatentResearch[]
      stats?: ReturnType<typeof calculateStats>
    } = {
      success: true,
      patents,
    }

    if (includeStats) {
      response.stats = calculateStats(dbPatents)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Patents API] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch patents" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/patents
 * Create a new patent research project
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate required fields
    if (!body.title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      )
    }

    // Map frontend status to db status
    const dbStatus = body.status ? frontendStatusToDb[body.status as PatentResearchStatus] || "draft" : "draft"

    const dbPatent = createPatentResearch({
      userId: session.user.id,
      title: body.title,
      description: body.inventionDescription?.summary || body.description,
      inventionDescription: body.inventionDescription?.background,
      technicalField: body.inventionDescription?.technicalField || body.technicalField,
      status: dbStatus,
      tags: body.tags,
      priority: body.priority || "medium",
      filingDeadline: body.targetFilingDate || body.filingDeadline,
    })

    // Return in frontend format
    const patent = transformPatentToFrontend(dbPatent, [], [])

    return NextResponse.json(
      {
        success: true,
        patent,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("[Patents API] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create patent" },
      { status: 500 }
    )
  }
}
