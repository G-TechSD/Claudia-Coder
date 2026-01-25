/**
 * Project Recovery API
 *
 * Scans ~/claudia-projects/ for .claudia/config.json files
 * and reconstructs project records from disk.
 *
 * GET - Scan and return recoverable projects
 * POST - Recover projects (add to response for client to save)
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { createProject, readProjectsFile } from "@/lib/data/server-projects"

const PROJECTS_BASE = process.env.CLAUDIA_PROJECTS_BASE || path.join(os.homedir(), "claudia-projects")

interface RecoveredProject {
  id: string
  name: string
  description: string
  status: string
  priority: string
  workingDirectory: string
  basePath: string
  repos: unknown[]
  packetIds: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
  // From config
  buildPlanId?: string
  packets?: unknown[]
}

interface ConfigJson {
  projectId: string
  projectName: string
  createdAt: string
  updatedAt: string
  buildPlanId?: string
  buildPlanVersion?: number
  packets?: Array<{ id: string; title: string; status: string }>
  lastActivityAt?: string
}

/**
 * Scan a single project folder for recoverable data
 */
async function scanProjectFolder(folderPath: string): Promise<RecoveredProject | null> {
  try {
    const configPath = path.join(folderPath, ".claudia", "config.json")

    // Check if config exists
    try {
      await fs.access(configPath)
    } catch {
      // No .claudia/config.json - try to create minimal record from folder name
      const folderName = path.basename(folderPath)
      // Extract name and potential ID from folder name like "project-name-abc12345"
      const match = folderName.match(/^(.+?)-([a-f0-9]{8})$/)

      if (match) {
        const [, namePart, idSuffix] = match
        const name = namePart.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())

        // Get folder stats for dates
        const stats = await fs.stat(folderPath)

        return {
          id: `${idSuffix}-0000-0000-0000-000000000000`, // Partial ID
          name,
          description: `Recovered from ${folderName}`,
          status: "planning",
          priority: "medium",
          workingDirectory: folderPath,
          basePath: folderPath,
          repos: [],
          packetIds: [],
          tags: ["recovered"],
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString(),
        }
      }

      return null
    }

    // Read config.json
    const configContent = await fs.readFile(configPath, "utf-8")
    const config: ConfigJson = JSON.parse(configContent)

    // Build project record
    const project: RecoveredProject = {
      id: config.projectId,
      name: config.projectName,
      description: `Recovered project: ${config.projectName}`,
      status: "planning",
      priority: "medium",
      workingDirectory: folderPath,
      basePath: folderPath,
      repos: [],
      packetIds: config.packets?.map(p => p.id) || [],
      tags: ["recovered"],
      createdAt: config.createdAt,
      updatedAt: config.updatedAt || config.lastActivityAt || config.createdAt,
      buildPlanId: config.buildPlanId,
      packets: config.packets,
    }

    // Try to read PRD for better description
    try {
      const prdPath = path.join(folderPath, "docs", "PRD.md")
      const prdContent = await fs.readFile(prdPath, "utf-8")
      // Extract first paragraph or executive summary
      const summaryMatch = prdContent.match(/## Executive Summary\n\n([^\n]+)/) ||
                          prdContent.match(/## Overview\n\n([^\n]+)/) ||
                          prdContent.match(/# .+\n\n([^\n]+)/)
      if (summaryMatch) {
        project.description = summaryMatch[1].substring(0, 500)
      }
    } catch {
      // No PRD, use default description
    }

    return project
  } catch (error) {
    console.error(`[recover] Error scanning ${folderPath}:`, error)
    return null
  }
}

/**
 * GET - Scan and return all recoverable projects
 */
export async function GET(request: NextRequest) {
  try {
    // Get list of project folders
    const entries = await fs.readdir(PROJECTS_BASE, { withFileTypes: true })
    const folders = entries.filter(e => e.isDirectory()).map(e => e.name)

    console.log(`[recover] Scanning ${folders.length} folders in ${PROJECTS_BASE}`)

    // Scan each folder
    const results = await Promise.all(
      folders.map(folder => scanProjectFolder(path.join(PROJECTS_BASE, folder)))
    )

    // Filter out nulls
    const recovered = results.filter((p): p is RecoveredProject => p !== null)

    // Sort by updatedAt descending
    recovered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    console.log(`[recover] Found ${recovered.length} recoverable projects`)

    return NextResponse.json({
      success: true,
      projectsBase: PROJECTS_BASE,
      scannedFolders: folders.length,
      recoveredCount: recovered.length,
      projects: recovered,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recovery scan failed"
    console.error("[recover] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST - Recover projects and save to server-side storage
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectIds, userId, saveToServer = true } = body as {
      projectIds?: string[]
      userId?: string
      saveToServer?: boolean
    }

    // Get all recoverable projects
    const entries = await fs.readdir(PROJECTS_BASE, { withFileTypes: true })
    const folders = entries.filter(e => e.isDirectory()).map(e => e.name)

    const results = await Promise.all(
      folders.map(folder => scanProjectFolder(path.join(PROJECTS_BASE, folder)))
    )

    let recovered = results.filter((p): p is RecoveredProject => p !== null)

    // Filter to specific IDs if provided
    if (projectIds && projectIds.length > 0) {
      recovered = recovered.filter(p => projectIds.includes(p.id))
    }

    // Get existing projects to avoid duplicates
    const existingProjects = await readProjectsFile()
    const existingIds = new Set(existingProjects.map(p => p.id))

    // Filter out already-existing projects
    const newProjects = recovered.filter(p => !existingIds.has(p.id))

    // Format for storage (match Project type)
    const projects = recovered.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status as "planning" | "active" | "paused" | "completed" | "archived" | "trashed",
      priority: p.priority as "low" | "medium" | "high" | "critical",
      workingDirectory: p.workingDirectory,
      basePath: p.basePath,
      repos: p.repos as [],
      packetIds: p.packetIds,
      tags: p.tags,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      userId,
    }))

    // Save new projects to server-side storage
    let savedCount = 0
    if (saveToServer && newProjects.length > 0) {
      for (const proj of newProjects) {
        try {
          await createProject({
            name: proj.name,
            description: proj.description,
            status: proj.status as "planning" | "active" | "paused" | "completed" | "archived" | "trashed",
            priority: proj.priority as "low" | "medium" | "high" | "critical",
            workingDirectory: proj.workingDirectory,
            basePath: proj.basePath,
            repos: [],
            packetIds: proj.packetIds,
            tags: proj.tags,
            userId,
          }, userId)
          savedCount++
          console.log(`[recover] Saved project to server: ${proj.name}`)
        } catch (err) {
          console.error(`[recover] Failed to save project ${proj.name}:`, err)
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: projects.length,
      projects,
      savedToServer: savedCount,
      skippedDuplicates: recovered.length - newProjects.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recovery failed"
    console.error("[recover] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
