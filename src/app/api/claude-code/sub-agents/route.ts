/**
 * Sub-Agent Tracking API
 *
 * GET - List sub-agents for a session
 * POST - Register a new sub-agent
 * PATCH - Update sub-agent status
 * DELETE - Remove a sub-agent or clear all
 */

import { NextRequest, NextResponse } from "next/server"
import {
  createSubAgent,
  updateSubAgentStatus,
  getSubAgents,
  getSubAgent,
  clearSubAgents,
  removeSubAgent,
  serializeSubAgent,
  getSubAgentStats,
  type SubAgentStatus
} from "@/lib/claude-code/sub-agents"

/**
 * GET /api/claude-code/sub-agents
 *
 * List all sub-agents for a session
 *
 * Query params:
 * - sessionId (required): The session ID to get sub-agents for
 * - status (optional): Filter by status (pending, running, completed, failed)
 * - includeStats (optional): Include statistics in response
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")
    const statusFilter = searchParams.get("status") as SubAgentStatus | null
    const includeStats = searchParams.get("includeStats") === "true"

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId query parameter is required" },
        { status: 400 }
      )
    }

    let subAgents = getSubAgents(sessionId)

    // Apply status filter if provided
    if (statusFilter) {
      subAgents = subAgents.filter(agent => agent.status === statusFilter)
    }

    // Serialize for response
    const serializedAgents = subAgents.map(serializeSubAgent)

    const response: {
      success: boolean
      sessionId: string
      subAgents: ReturnType<typeof serializeSubAgent>[]
      count: number
      stats?: ReturnType<typeof getSubAgentStats>
    } = {
      success: true,
      sessionId,
      subAgents: serializedAgents,
      count: serializedAgents.length
    }

    // Include stats if requested
    if (includeStats) {
      response.stats = getSubAgentStats(sessionId)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[sub-agents API] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get sub-agents" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/claude-code/sub-agents
 *
 * Register a new sub-agent
 *
 * Body:
 * - sessionId (required): The session ID
 * - taskDescription (required): Description of the task
 * - metadata (optional): Additional metadata
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, taskDescription, metadata } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      )
    }

    if (!taskDescription) {
      return NextResponse.json(
        { error: "taskDescription is required" },
        { status: 400 }
      )
    }

    const subAgent = createSubAgent(sessionId, taskDescription, metadata)

    return NextResponse.json({
      success: true,
      subAgent: serializeSubAgent(subAgent)
    })
  } catch (error) {
    console.error("[sub-agents API] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sub-agent" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/claude-code/sub-agents
 *
 * Update sub-agent status
 *
 * Body:
 * - sessionId (required): The session ID
 * - subAgentId (required): The sub-agent ID
 * - status (required): New status (pending, running, completed, failed)
 * - result (optional): Result or output
 * - error (optional): Error message
 * - progress (optional): Progress percentage (0-100)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, subAgentId, status, result, error: errorMsg, progress } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      )
    }

    if (!subAgentId) {
      return NextResponse.json(
        { error: "subAgentId is required" },
        { status: 400 }
      )
    }

    if (!status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses: SubAgentStatus[] = ["pending", "running", "completed", "failed"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    const updatedAgent = updateSubAgentStatus(sessionId, subAgentId, status, {
      result,
      error: errorMsg,
      progress
    })

    if (!updatedAgent) {
      return NextResponse.json(
        { error: "Sub-agent not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      subAgent: serializeSubAgent(updatedAgent)
    })
  } catch (error) {
    console.error("[sub-agents API] PATCH error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update sub-agent" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/claude-code/sub-agents
 *
 * Remove a sub-agent or clear all sub-agents for a session
 *
 * Query params:
 * - sessionId (required): The session ID
 * - subAgentId (optional): Specific sub-agent to remove. If not provided, clears all.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")
    const subAgentId = searchParams.get("subAgentId")

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId query parameter is required" },
        { status: 400 }
      )
    }

    if (subAgentId) {
      // Remove specific sub-agent
      const removed = removeSubAgent(sessionId, subAgentId)
      if (!removed) {
        return NextResponse.json(
          { error: "Sub-agent not found" },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Sub-agent ${subAgentId} removed`
      })
    } else {
      // Clear all sub-agents for session
      clearSubAgents(sessionId)

      return NextResponse.json({
        success: true,
        message: `All sub-agents cleared for session ${sessionId}`
      })
    }
  } catch (error) {
    console.error("[sub-agents API] DELETE error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete sub-agent(s)" },
      { status: 500 }
    )
  }
}
