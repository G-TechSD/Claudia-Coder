/**
 * Bake API Endpoint
 *
 * POST /api/bake - Start baking a project
 * GET /api/bake - Get baking status (for SSE streaming)
 */

import { NextRequest, NextResponse } from "next/server"
import { bakeProject, ralphWiggumLoop, type BakeConfig, type BakeUpdate, type BakeResult } from "@/lib/execution"
import type { WorkPacket } from "@/lib/ai/build-plan"
import type { LinkedRepo, Project } from "@/lib/data/types"

// Store for active baking sessions
const activeBakes = new Map<string, {
  status: "running" | "completed" | "failed"
  updates: BakeUpdate[]
  result?: BakeResult
  startTime: Date
}>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectId,
      project,
      packets,
      repo,
      config,
      useRalphWiggum = false
    }: {
      projectId: string
      project: Project
      packets: WorkPacket[]
      repo: LinkedRepo
      config?: Partial<BakeConfig>
      useRalphWiggum?: boolean
    } = body

    if (!project || !packets || !repo) {
      return NextResponse.json(
        { error: "Missing required fields: project, packets, repo" },
        { status: 400 }
      )
    }

    // Generate session ID
    const sessionId = `bake-${projectId}-${Date.now()}`

    // Initialize session
    activeBakes.set(sessionId, {
      status: "running",
      updates: [],
      startTime: new Date()
    })

    // Start baking in background
    const bakeConfig: Partial<BakeConfig> = {
      ...config,
      dryRun: config?.dryRun ?? false
    }

    // Run in background (fire and forget)
    runBakeInBackground(sessionId, project, packets, repo, bakeConfig, useRalphWiggum)

    return NextResponse.json({
      sessionId,
      status: "started",
      message: `Started baking ${project.name} with ${packets.length} packets`
    })
  } catch (error) {
    console.error("[Bake API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start baking" },
      { status: 500 }
    )
  }
}

async function runBakeInBackground(
  sessionId: string,
  project: Project,
  packets: WorkPacket[],
  repo: LinkedRepo,
  config: Partial<BakeConfig>,
  useRalphWiggum: boolean
) {
  const session = activeBakes.get(sessionId)
  if (!session) return

  try {
    let result: BakeResult | undefined

    if (useRalphWiggum) {
      const oven = ralphWiggumLoop(project, packets, repo, config)

      for await (const update of oven) {
        session.updates.push(update)
      }

      const { value } = await oven.next()
      result = value as BakeResult
    } else {
      const oven = bakeProject(project, packets, repo, config)

      for await (const update of oven) {
        session.updates.push(update)
      }

      const { value } = await oven.next()
      result = value as BakeResult
    }

    session.status = result?.success ? "completed" : "failed"
    session.result = result
  } catch (error) {
    session.status = "failed"
    session.updates.push({
      state: "burnt",
      packetIndex: 0,
      totalPackets: packets.length,
      message: error instanceof Error ? error.message : "Baking failed",
      errors: [error instanceof Error ? error.message : "Unknown error"],
      timestamp: new Date()
    })
  }
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")

  if (!sessionId) {
    // Return all active sessions
    const sessions = Array.from(activeBakes.entries()).map(([id, session]) => ({
      id,
      status: session.status,
      updatesCount: session.updates.length,
      startTime: session.startTime,
      lastUpdate: session.updates[session.updates.length - 1]
    }))

    return NextResponse.json({ sessions })
  }

  const session = activeBakes.get(sessionId)

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    )
  }

  // Get updates since last check (use query param for offset)
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0")
  const newUpdates = session.updates.slice(offset)

  return NextResponse.json({
    sessionId,
    status: session.status,
    updates: newUpdates,
    offset: session.updates.length,
    result: session.status !== "running" ? session.result : undefined
  })
}

// SSE endpoint for real-time updates
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  })
}
