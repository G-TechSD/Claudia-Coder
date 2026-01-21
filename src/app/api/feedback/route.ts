/**
 * Feedback API
 *
 * Stores user feedback (bug reports, feature requests, general feedback)
 * locally in a JSON file.
 *
 * SAFETY FEATURES:
 * - Validates required fields before storing
 * - Atomic writes via temp file
 * - Creates data directory if it doesn't exist
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"
import * as path from "path"

// Path to stored feedback
const FEEDBACK_FILE = path.join(process.cwd(), "data", "feedback.json")

/**
 * Feedback entry format
 */
interface FeedbackEntry {
  id: string
  type: "bug" | "feature-request" | "general"
  title: string
  description: string
  url?: string
  userAgent?: string
  timestamp: string
}

/**
 * Read feedback from file with error handling
 */
async function readFeedbackFile(): Promise<FeedbackEntry[]> {
  try {
    const data = await fs.readFile(FEEDBACK_FILE, "utf-8")
    const parsed = JSON.parse(data)
    if (Array.isArray(parsed)) {
      return parsed
    }
    console.warn("[feedback] File contained non-array data")
    return []
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === "ENOENT") {
      return []
    }
    console.error("[feedback] Failed to read feedback file:", error)
    throw error
  }
}

/**
 * Write feedback to file with atomic write pattern
 */
async function writeFeedbackFile(feedback: FeedbackEntry[]): Promise<void> {
  // Ensure directory exists
  await fs.mkdir(path.dirname(FEEDBACK_FILE), { recursive: true })

  // Write to temp file first
  const tempFile = FEEDBACK_FILE + ".tmp"
  const jsonContent = JSON.stringify(feedback, null, 2)

  // Validate JSON before writing
  JSON.parse(jsonContent) // Will throw if invalid

  await fs.writeFile(tempFile, jsonContent, "utf-8")
  await fs.rename(tempFile, FEEDBACK_FILE)
}

/**
 * POST /api/feedback
 *
 * Submit new feedback.
 *
 * Body:
 * - type: "bug" | "feature-request" | "general" (required)
 * - title: string (required)
 * - description: string (required)
 * - url?: string (optional - where user was)
 * - userAgent?: string (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, title, description, url, userAgent } = body

    // Validate required fields
    if (!type) {
      return NextResponse.json(
        { error: "type is required" },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      )
    }

    if (!description) {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 }
      )
    }

    // Validate type value
    if (!["bug", "feature-request", "general"].includes(type)) {
      return NextResponse.json(
        { error: "type must be one of: bug, feature-request, general" },
        { status: 400 }
      )
    }

    // Read existing feedback
    const feedback = await readFeedbackFile()

    // Generate unique ID
    const id = `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Create new feedback entry
    const newEntry: FeedbackEntry = {
      id,
      type: type as FeedbackEntry["type"],
      title,
      description,
      timestamp: new Date().toISOString()
    }

    // Add optional fields if provided
    if (url) {
      newEntry.url = url
    }
    if (userAgent) {
      newEntry.userAgent = userAgent
    }

    // Add entry
    feedback.push(newEntry)

    // Write feedback
    await writeFeedbackFile(feedback)

    return NextResponse.json({
      success: true,
      id
    })
  } catch (error) {
    console.error("[feedback] POST error:", error)
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    )
  }
}
