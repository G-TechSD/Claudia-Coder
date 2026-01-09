/**
 * MCP Dependency Check API
 *
 * GET - Check all system dependencies for MCP servers
 * POST - Check dependencies for a specific server command
 */

import { NextRequest, NextResponse } from "next/server"
import {
  checkAllDependencies,
  checkServerRequirements,
  getInstallInstructions,
  getMissingSummary,
  DependencyCheckResult,
  ServerRequirements
} from "@/lib/mcp/dependencies"

// Cache the dependency check result for 5 minutes
let cachedResult: DependencyCheckResult | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * GET /api/mcp/check-dependencies
 * Returns the status of all MCP-related system dependencies
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get("refresh") === "true"

    // Check if we have a valid cached result
    const now = Date.now()
    if (!refresh && cachedResult && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        summary: getMissingSummary(cachedResult)
      })
    }

    // Perform fresh dependency check
    const result = await checkAllDependencies()

    // Update cache
    cachedResult = result
    cacheTimestamp = now

    // Get summary message
    const summary = getMissingSummary(result)

    // Get install instructions for missing dependencies
    const missingDeps = result.dependencies
      .filter(d => !d.installed)
      .map(d => d.name)
    const installInstructions = getInstallInstructions(missingDeps)

    return NextResponse.json({
      ...result,
      summary,
      installInstructions,
      cached: false
    })
  } catch (error) {
    console.error("[Dependency Check API] GET error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to check dependencies",
        dependencies: [],
        allRequiredInstalled: false,
        nodeAvailable: false,
        pythonAvailable: false
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/mcp/check-dependencies
 * Check if a specific server command has the required dependencies
 *
 * Request body:
 * {
 *   command: string,
 *   args?: string[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.command) {
      return NextResponse.json(
        { error: "Command is required" },
        { status: 400 }
      )
    }

    const { command, args = [] } = body

    // Get cached dependency status if available, otherwise check fresh
    const now = Date.now()
    let dependencyStatus: DependencyCheckResult

    if (cachedResult && (now - cacheTimestamp) < CACHE_TTL) {
      dependencyStatus = cachedResult
    } else {
      dependencyStatus = await checkAllDependencies()
      cachedResult = dependencyStatus
      cacheTimestamp = now
    }

    // Check requirements for this specific server
    const requirements = await checkServerRequirements(command, args, dependencyStatus)

    // Get install instructions for missing dependencies
    const installInstructions = getInstallInstructions(requirements.missing)

    // Build a user-friendly message
    let message: string
    if (requirements.canRun) {
      message = `All dependencies satisfied. This ${requirements.runtime} server is ready to run.`
    } else {
      const missingList = requirements.missing.join(", ")
      message = `Missing dependencies: ${missingList}. Install these before running this server.`
    }

    return NextResponse.json({
      ...requirements,
      message,
      installInstructions
    })
  } catch (error) {
    console.error("[Dependency Check API] POST error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to check server requirements",
        canRun: false,
        missing: [],
        dependencies: [],
        runtime: "unknown"
      },
      { status: 500 }
    )
  }
}
