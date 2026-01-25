/**
 * Emergent Modules API
 *
 * GET - List all emergent modules
 * POST - Register a new emergent module
 */

import { NextRequest, NextResponse } from "next/server"
import {
  loadModules,
  registerModule,
  initializeRegistry,
  getClaudiaCoderProject,
} from "@/lib/emergent-modules/registry"
import { CreateModuleRequest, ModuleRegistryResponse } from "@/lib/emergent-modules/types"

// Force dynamic rendering
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Initialize registry on first load
initializeRegistry()

/**
 * GET /api/emergent-modules
 * List all emergent modules
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("active") === "true"
    const includeClaudia = searchParams.get("includeClaudia") === "true"

    let modules = loadModules()

    if (activeOnly) {
      modules = modules.filter((m) => m.status === "active")
    }

    // Sort by priority then by name
    modules.sort((a, b) => {
      const priorityDiff = (a.sidebarPriority || 100) - (b.sidebarPriority || 100)
      if (priorityDiff !== 0) return priorityDiff
      return a.name.localeCompare(b.name)
    })

    const response: ModuleRegistryResponse = {
      modules,
      activeCount: modules.filter((m) => m.status === "active").length,
      totalCount: modules.length,
      timestamp: new Date().toISOString(),
    }

    // Optionally include Claudia Coder project info
    if (includeClaudia) {
      return NextResponse.json({
        ...response,
        claudiaCoder: getClaudiaCoderProject(),
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[emergent-modules] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load modules" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/emergent-modules
 * Register a new emergent module
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateModuleRequest

    if (!body.name) {
      return NextResponse.json({ error: "Module name is required" }, { status: 400 })
    }

    if (!body.description) {
      return NextResponse.json({ error: "Module description is required" }, { status: 400 })
    }

    const module = registerModule(body)

    return NextResponse.json({
      success: true,
      module,
      message: `Emergent module "${module.name}" has been created!`,
    })
  } catch (error) {
    console.error("[emergent-modules] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create module" },
      { status: 500 }
    )
  }
}
