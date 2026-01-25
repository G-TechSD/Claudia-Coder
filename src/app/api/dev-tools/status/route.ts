/**
 * Dev Tools Status API
 *
 * GET - Check installation status of all development tools
 */

import { NextRequest, NextResponse } from "next/server"
import { checkAllTools } from "@/lib/dev-tools/tool-registry"
import { DevToolsStatusResponse, DevToolStatus } from "@/lib/dev-tools/types"

// Force dynamic rendering
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Cache the status check result for 5 minutes
let cachedResult: DevToolStatus[] | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * GET /api/dev-tools/status
 * Returns the installation status of all development tools
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get("refresh") === "true"
    const toolId = searchParams.get("toolId")

    const now = Date.now()

    // Check if we have a valid cached result
    if (!refresh && cachedResult && (now - cacheTimestamp) < CACHE_TTL) {
      const response: DevToolsStatusResponse = {
        tools: toolId
          ? cachedResult.filter(t => t.id === toolId)
          : cachedResult,
        timestamp: new Date(cacheTimestamp).toISOString(),
        cached: true,
      }
      return NextResponse.json(response)
    }

    // Perform fresh status check
    console.log("[dev-tools/status] Checking all tools...")
    const tools = await checkAllTools()

    // Update cache
    cachedResult = tools
    cacheTimestamp = now

    const response: DevToolsStatusResponse = {
      tools: toolId ? tools.filter(t => t.id === toolId) : tools,
      timestamp: new Date().toISOString(),
      cached: false,
    }

    console.log("[dev-tools/status] Status check complete:", tools.map(t => `${t.id}:${t.status}`).join(", "))

    return NextResponse.json(response)
  } catch (error) {
    console.error("[dev-tools/status] Error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to check tool status",
        tools: [],
        timestamp: new Date().toISOString(),
        cached: false,
      },
      { status: 500 }
    )
  }
}
