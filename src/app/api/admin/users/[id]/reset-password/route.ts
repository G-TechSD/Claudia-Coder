/**
 * Admin Password Reset API
 * POST - Reset a user's password
 * Only accessible by admin role
 */

import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/api-helpers"
import { getUserById } from "@/lib/data/users"
import { db } from "@/lib/auth/db"
import { hashPassword } from "better-auth/crypto"

/**
 * Generate a secure random password
 * Uses a mix of characters that are easy to read and type
 */
function generateSecurePassword(length = 16): string {
  const lowercase = "abcdefghjkmnpqrstuvwxyz" // Removed i, l, o to avoid confusion
  const uppercase = "ABCDEFGHJKMNPQRSTUVWXYZ" // Removed I, L, O to avoid confusion
  const numbers = "23456789" // Removed 0, 1 to avoid confusion
  const special = "!@#$%^&*"
  const allChars = lowercase + uppercase + numbers + special

  let password = ""

  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += special[Math.floor(Math.random() * special.length)]

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("")
}

/**
 * POST /api/admin/users/[id]/reset-password
 * Reset a user's password
 */
export const POST = withRole("admin")(async (auth, request) => {
  try {
    // Extract id from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split("/")
    // URL format: /api/admin/users/[id]/reset-password
    const idIndex = pathParts.findIndex((p) => p === "users") + 1
    const id = pathParts[idIndex]

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

    // Prevent admin from resetting their own password through this endpoint
    if (id === auth.user.id) {
      return NextResponse.json(
        { success: false, error: "Cannot reset your own password through admin panel" },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { password: providedPassword, autoGenerate = true } = body

    // Determine the new password
    let newPassword: string
    if (providedPassword && !autoGenerate) {
      // Validate provided password
      if (typeof providedPassword !== "string" || providedPassword.length < 8) {
        return NextResponse.json(
          { success: false, error: "Password must be at least 8 characters long" },
          { status: 400 }
        )
      }
      newPassword = providedPassword
    } else {
      // Auto-generate a secure password
      newPassword = generateSecurePassword(16)
    }

    // Hash the password
    const hashedPassword = await hashPassword(newPassword)

    // Update the account record
    const now = new Date().toISOString()

    // Check if account exists for this user
    const existingAccount = db
      .prepare(
        `SELECT id FROM account WHERE userId = ? AND providerId = 'credential'`
      )
      .get(id) as { id: string } | undefined

    if (existingAccount) {
      // Update existing account
      db.prepare(
        `UPDATE account SET password = ?, updatedAt = ? WHERE id = ?`
      ).run(hashedPassword, now, existingAccount.id)
    } else {
      // Create new credential account for this user
      const crypto = await import("crypto")
      const accountId = crypto.randomUUID()
      db.prepare(
        `INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
         VALUES (?, ?, 'credential', ?, ?, ?, ?)`
      ).run(accountId, user.email, id, hashedPassword, now, now)
    }

    // Log the password reset for audit purposes (without the actual password)
    console.log(
      `[Admin] Password reset for user ${user.email} (${id}) by admin ${auth.user.email}`
    )

    return NextResponse.json({
      success: true,
      message: "Password reset successfully",
      newPassword, // Return to admin so they can share it with the user
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("[Admin Password Reset] Error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to reset password" },
      { status: 500 }
    )
  }
})
