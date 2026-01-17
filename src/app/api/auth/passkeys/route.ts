/**
 * Passkeys API
 * Lists and manages passkeys for the authenticated user
 */

import { NextResponse } from "next/server"
import { getSessionWithBypass } from "@/lib/auth/api-helpers"
import { db } from "@/lib/auth/db"

interface PasskeyRow {
  id: string
  name: string | null
  deviceType: string | null
  createdAt: string
}

export async function GET() {
  try {
    // Get the current session with beta auth bypass support
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Get all passkeys for the user
    const passkeys = db.prepare(`
      SELECT id, name, deviceType, createdAt
      FROM passkey
      WHERE userId = ?
      ORDER BY createdAt DESC
    `).all(userId) as PasskeyRow[]

    return NextResponse.json({
      passkeys: passkeys.map(p => ({
        id: p.id,
        name: p.name || "Unnamed Passkey",
        deviceType: p.deviceType || "unknown",
        createdAt: p.createdAt,
      })),
    })
  } catch (error) {
    console.error("[Passkeys] Error:", error)
    return NextResponse.json(
      { error: "Failed to get passkeys" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    // Get the current session with beta auth bypass support
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { passkeyId } = await request.json()

    if (!passkeyId) {
      return NextResponse.json(
        { error: "Passkey ID required" },
        { status: 400 }
      )
    }

    // Delete the passkey (only if it belongs to the user)
    const result = db.prepare(`
      DELETE FROM passkey
      WHERE id = ? AND userId = ?
    `).run(passkeyId, session.user.id)

    if (result.changes === 0) {
      return NextResponse.json(
        { error: "Passkey not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Passkeys] Delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete passkey" },
      { status: 500 }
    )
  }
}
