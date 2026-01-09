/**
 * Admin Single User API
 * GET - Get user details
 * PATCH - Update user role, NDA status, or disabled status
 */

import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/api-helpers"
import {
  getUserById,
  updateUserRole,
  setUserDisabled,
  setUserNdaSigned,
  type UserRole,
} from "@/lib/data/users"

/**
 * GET /api/admin/users/[id]
 * Get a single user by ID
 */
export const GET = withRole("admin")(async (_auth, request) => {
  try {
    // Extract id from URL
    const url = new URL(request.url)
    const id = url.pathname.split("/").pop()

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      )
    }

    const user = getUserById(id)

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user,
    })
  } catch (error) {
    console.error("[Admin User] Get error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get user" },
      { status: 500 }
    )
  }
})

/**
 * PATCH /api/admin/users/[id]
 * Update user role, NDA status, or disabled status
 */
export const PATCH = withRole("admin")(async (auth, request) => {
  try {
    // Extract id from URL
    const url = new URL(request.url)
    const id = url.pathname.split("/").pop()

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      )
    }

    const user = getUserById(id)

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    // Prevent admin from modifying themselves (for safety)
    if (id === auth.user.id) {
      return NextResponse.json(
        { success: false, error: "Cannot modify your own account" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { role, disabled, ndaSigned } = body

    const updates: string[] = []

    // Update role if provided
    if (role !== undefined) {
      const validRoles: UserRole[] = ["admin", "beta_tester", "user"]
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { success: false, error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
          { status: 400 }
        )
      }
      updateUserRole(id, role)
      updates.push(`role: ${role}`)
    }

    // Update disabled status if provided
    if (disabled !== undefined) {
      setUserDisabled(id, !!disabled)
      updates.push(`disabled: ${disabled}`)
    }

    // Update NDA status if provided
    if (ndaSigned !== undefined) {
      setUserNdaSigned(id, !!ndaSigned)
      updates.push(`ndaSigned: ${ndaSigned}`)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid updates provided" },
        { status: 400 }
      )
    }

    // Get updated user
    const updatedUser = getUserById(id)

    return NextResponse.json({
      success: true,
      message: `User updated: ${updates.join(", ")}`,
      user: updatedUser,
    })
  } catch (error) {
    console.error("[Admin User] Update error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    )
  }
})
