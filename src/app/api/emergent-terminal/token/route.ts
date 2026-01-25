/**
 * Emergent Terminal Token Management API
 *
 * Allows the main Claudia Coder app to manage the Emergent Terminal access token.
 */

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/middleware"
import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"

const STORAGE_DIR = path.join(process.cwd(), ".local-storage")
const TOKEN_FILE = path.join(STORAGE_DIR, "emergent-token.json")

interface TokenData {
  token: string
  createdAt: string
  setBy?: string
}

function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
  }
}

function loadToken(): TokenData | null {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"))
    }
  } catch (err) {
    console.error("[Emergent Token] Error loading token:", err)
  }
  return null
}

function saveToken(token: string, userId: string): TokenData {
  ensureStorageDir()
  const data: TokenData = {
    token,
    createdAt: new Date().toISOString(),
    setBy: userId,
  }
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2))
  return data
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

// GET - Get current token info
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tokenData = loadToken()

    if (!tokenData) {
      return NextResponse.json({
        exists: false,
        message: "No token set. Start the Emergent Terminal server to generate one."
      })
    }

    return NextResponse.json({
      exists: true,
      createdAt: tokenData.createdAt,
      setBy: tokenData.setBy,
      // Return the token for admin viewing
      token: tokenData.token,
    })
  } catch (error) {
    console.error("[Emergent Token API] GET error:", error)
    return NextResponse.json(
      { error: "Failed to get token info" },
      { status: 500 }
    )
  }
}

// POST - Set a new token (or generate one)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { token: customToken, regenerate } = body

    let token: string

    if (regenerate || !customToken) {
      // Generate a new random token
      token = generateToken()
    } else {
      // Use custom token (must be at least 16 chars)
      if (customToken.length < 16) {
        return NextResponse.json(
          { error: "Token must be at least 16 characters" },
          { status: 400 }
        )
      }
      token = customToken
    }

    const tokenData = saveToken(token, user.id)

    return NextResponse.json({
      success: true,
      token,
      createdAt: tokenData.createdAt,
      message: "Token updated. Restart Emergent Terminal server to apply."
    })
  } catch (error) {
    console.error("[Emergent Token API] POST error:", error)
    return NextResponse.json(
      { error: "Failed to set token" },
      { status: 500 }
    )
  }
}
