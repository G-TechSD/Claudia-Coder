/**
 * Two-Factor Authentication Status API
 * Returns the current 2FA status for the authenticated user
 */

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/auth/db"

export async function GET() {
  try {
    // Get the current session
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Check if user has 2FA enabled
    const user = db.prepare(`
      SELECT twoFactorEnabled FROM user WHERE id = ?
    `).get(userId) as { twoFactorEnabled: number } | undefined

    // Check if TOTP is set up
    const twoFactorRecord = db.prepare(`
      SELECT id, backupCodes FROM twoFactor WHERE userId = ?
    `).get(userId) as { id: string; backupCodes: string } | undefined

    let backupCodesRemaining = 0
    if (twoFactorRecord?.backupCodes) {
      try {
        const codes = JSON.parse(twoFactorRecord.backupCodes)
        // Count codes that haven't been used (non-null)
        backupCodesRemaining = Array.isArray(codes)
          ? codes.filter((c: string | null) => c !== null).length
          : 0
      } catch {
        backupCodesRemaining = 0
      }
    }

    return NextResponse.json({
      enabled: !!user?.twoFactorEnabled,
      totpEnabled: !!twoFactorRecord,
      backupCodesRemaining,
    })
  } catch (error) {
    console.error("[2FA Status] Error:", error)
    return NextResponse.json(
      { error: "Failed to get 2FA status" },
      { status: 500 }
    )
  }
}
