/**
 * API endpoint to load the pre-generated HyperHealth project data
 *
 * GET /api/projects/load-hyperhealth
 *
 * This endpoint reads the generated hyperhealth-project.json and hyperhealth-packets.json
 * files and returns them for the frontend to store in localStorage.
 *
 * This allows loading HyperHealth with a single button click instead of
 * pasting console scripts.
 *
 * Returns: { project, buildPlan, packets }
 */

import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

// Paths to the generated files
const GENERATED_DIR = "/home/bill/projects/claudia-admin/generated"
const PROJECT_FILE = path.join(GENERATED_DIR, "hyperhealth-project.json")
const PACKETS_FILE = path.join(GENERATED_DIR, "hyperhealth-packets.json")

interface ProjectData {
  project: unknown
  buildPlan: unknown
  packets: unknown[]
}

/**
 * GET - Load the pre-generated HyperHealth project data
 *
 * Returns the complete project, build plan, and packets data ready to be
 * stored in localStorage by the frontend.
 */
export async function GET() {
  try {
    // Check if the required files exist
    if (!existsSync(PROJECT_FILE)) {
      console.error(`[load-hyperhealth] Project file not found: ${PROJECT_FILE}`)
      return NextResponse.json(
        {
          success: false,
          error: "HyperHealth project file not found. Please generate it first."
        },
        { status: 404 }
      )
    }

    if (!existsSync(PACKETS_FILE)) {
      console.error(`[load-hyperhealth] Packets file not found: ${PACKETS_FILE}`)
      return NextResponse.json(
        {
          success: false,
          error: "HyperHealth packets file not found. Please generate it first."
        },
        { status: 404 }
      )
    }

    // Read the project file (contains project and buildPlan)
    const projectFileContent = await readFile(PROJECT_FILE, "utf-8")
    const projectData = JSON.parse(projectFileContent) as ProjectData

    // Read the packets file
    const packetsFileContent = await readFile(PACKETS_FILE, "utf-8")
    const packetsData = JSON.parse(packetsFileContent)

    // The packets file contains an array of packets
    const packets = Array.isArray(packetsData) ? packetsData : packetsData.packets || []

    console.log(`[load-hyperhealth] Loaded project: ${(projectData.project as { name?: string })?.name}`)
    console.log(`[load-hyperhealth] Loaded ${packets.length} packets`)

    return NextResponse.json({
      success: true,
      project: projectData.project,
      buildPlan: projectData.buildPlan,
      packets: packets,
      message: "HyperHealth data loaded successfully. Store in localStorage using the appropriate methods."
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load HyperHealth data"
    console.error("[load-hyperhealth] Error:", error)

    // Check for specific errors
    if (message.includes("ENOENT")) {
      return NextResponse.json(
        {
          success: false,
          error: "Generated files not found. Please run the generation script first."
        },
        { status: 404 }
      )
    }

    if (message.includes("JSON")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in generated files. Please regenerate the data."
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    )
  }
}
