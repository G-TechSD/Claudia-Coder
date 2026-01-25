/**
 * Individual Emergent Module API
 *
 * GET - Get a specific module
 * PATCH - Update module (enable/disable)
 * DELETE - Remove a module
 */

import { NextRequest, NextResponse } from "next/server"
import {
  getModule,
  updateModuleStatus,
  deleteModule,
  recordModuleAccess,
} from "@/lib/emergent-modules/registry"
import { ModuleStatus } from "@/lib/emergent-modules/types"

// Force dynamic rendering
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/emergent-modules/[id]
 * Get a specific module
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const module = getModule(id)

    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    // Record access for analytics
    recordModuleAccess(id)

    return NextResponse.json({ module })
  } catch (error) {
    console.error("[emergent-modules] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get module" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/emergent-modules/[id]
 * Update module status
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, errorMessage } = body as { status?: ModuleStatus; errorMessage?: string }

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 })
    }

    if (!["active", "disabled", "error", "loading"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const module = updateModuleStatus(id, status, errorMessage)

    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      module,
      message: `Module "${module.name}" is now ${status}`,
    })
  } catch (error) {
    console.error("[emergent-modules] PATCH error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update module" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/emergent-modules/[id]
 * Remove a module
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const deleted = deleteModule(id)

    if (!deleted) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: `Module "${id}" has been deleted`,
    })
  } catch (error) {
    console.error("[emergent-modules] DELETE error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete module" },
      { status: 500 }
    )
  }
}
