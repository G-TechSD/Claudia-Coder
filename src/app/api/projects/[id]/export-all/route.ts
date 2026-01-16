/**
 * Project Complete Export API
 *
 * Exports ALL project data as a comprehensive ZIP file including:
 * - Project metadata
 * - Build plans
 * - Work packets
 * - Packet execution history
 * - Brain dumps with transcriptions
 * - User uploaded resources
 * - Business development plans
 * - Voice recordings
 * - Source code (optional)
 *
 * Endpoints:
 * - POST: Generate and download a complete project export ZIP
 *
 * Query params:
 * - includeSourceCode: Whether to include source code (default: true)
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import archiver from "archiver"
import { Readable } from "stream"
import type {
  Project,
  StoredBuildPlan,
  PacketRun,
  BrainDump,
  ProjectResource,
  BusinessDev,
  VoiceRecording,
} from "@/lib/data/types"

// Directories to skip when creating archive (for source code)
const SKIP_DIRECTORIES = [
  "node_modules",
  ".git",
  ".next",
  ".cache",
  "__pycache__",
  ".pytest_cache",
  ".venv",
  "venv",
  "dist",
  "build",
  "coverage",
  ".nyc_output",
  ".turbo",
  ".vercel",
  ".output",
  "vendor",
  "target",
  "bin",
  "obj",
]

// Files to skip
const SKIP_FILES = [
  ".DS_Store",
  "Thumbs.db",
]

// Maximum archive size (200MB for complete exports)
const MAX_ARCHIVE_SIZE = 200 * 1024 * 1024

interface RouteParams {
  params: Promise<{ id: string }>
}

// WorkPacket type (from build plans)
interface WorkPacket {
  id: string
  phaseId?: string
  title: string
  description: string
  type: string
  priority: string
  status?: string
  tasks: Array<{ id: string; description: string; completed: boolean; order?: number }>
  acceptanceCriteria: string[]
}

// Request body for complete export
interface ExportRequestBody {
  project: Project
  buildPlans: StoredBuildPlan[]
  packets: WorkPacket[]
  packetRuns: PacketRun[]
  brainDumps: BrainDump[]
  resources: ProjectResource[]
  resourceFiles: Array<{ id: string; name: string; data: string }> // base64 encoded
  businessDev: BusinessDev | null
  voiceRecordings: VoiceRecording[]
}

// Manifest structure
interface ExportManifest {
  exportVersion: string
  exportedAt: string
  projectId: string
  projectName: string
  counts: {
    buildPlans: number
    packets: number
    packetRuns: number
    brainDumps: number
    resources: number
    voiceRecordings: number
    sourceCodeIncluded: boolean
  }
  directories: string[]
}

/**
 * Get the effective project path for source code
 */
async function getProjectPath(projectId: string, basePath?: string): Promise<string | null> {
  if (basePath) {
    try {
      await fs.access(basePath)
      return basePath
    } catch {
      return null
    }
  }

  const claudiaProjectsBase = "/home/bill/claudia-projects"

  try {
    const entries = await fs.readdir(claudiaProjectsBase, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const claudiaMetaPath = path.join(claudiaProjectsBase, entry.name, ".claudia")
        try {
          const metaContent = await fs.readFile(claudiaMetaPath, "utf-8")
          const meta = JSON.parse(metaContent)
          if (meta.projectId === projectId) {
            return path.join(claudiaProjectsBase, entry.name)
          }
        } catch {
          // No .claudia file or invalid JSON, skip
        }
      }
    }
  } catch {
    // Base directory doesn't exist or not readable
  }

  return null
}

/**
 * Check if a path should be skipped
 */
function shouldSkip(itemPath: string, name: string, isDirectory: boolean): boolean {
  if (name.startsWith(".")) {
    const allowedHidden = [
      ".env",
      ".env.local",
      ".env.example",
      ".gitignore",
      ".dockerignore",
      ".editorconfig",
      ".prettierrc",
      ".eslintrc",
      ".claudia",
    ]
    if (!allowedHidden.some((h) => name.startsWith(h))) {
      return true
    }
  }

  if (isDirectory) {
    return SKIP_DIRECTORIES.includes(name)
  }

  return SKIP_FILES.includes(name)
}

/**
 * Calculate total size of files to be archived
 */
async function calculateTotalSize(dirPath: string): Promise<number> {
  let totalSize = 0

  async function traverse(currentPath: string) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)

        if (shouldSkip(fullPath, entry.name, entry.isDirectory())) {
          continue
        }

        if (entry.isDirectory()) {
          await traverse(fullPath)
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath)
            totalSize += stats.size
          } catch {
            // Skip files we can't stat
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await traverse(dirPath)
  return totalSize
}

/**
 * Convert Node.js stream to Web ReadableStream
 */
function nodeStreamToWebStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk))
      })

      nodeStream.on("end", () => {
        controller.close()
      })

      nodeStream.on("error", (error) => {
        controller.error(error)
      })
    },

    cancel() {
      nodeStream.destroy()
    },
  })
}

/**
 * Sanitize filename for safe filesystem use
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .substring(0, 100)
}

/**
 * POST /api/projects/[id]/export-all
 *
 * Generate and stream a complete project export ZIP
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const includeSourceCode = searchParams.get("includeSourceCode") !== "false"

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    // Parse the request body
    let body: ExportRequestBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      )
    }

    const {
      project,
      buildPlans = [],
      packets = [],
      packetRuns = [],
      brainDumps = [],
      resources = [],
      resourceFiles = [],
      businessDev,
      voiceRecordings = [],
    } = body

    if (!project) {
      return NextResponse.json(
        { error: "Project data is required" },
        { status: 400 }
      )
    }

    // Get project path if including source code
    let projectPath: string | null = null
    let sourceCodeSize = 0

    if (includeSourceCode) {
      projectPath = await getProjectPath(projectId, project.basePath || project.workingDirectory)

      if (projectPath) {
        sourceCodeSize = await calculateTotalSize(projectPath)

        if (sourceCodeSize > MAX_ARCHIVE_SIZE) {
          return NextResponse.json(
            {
              error: "Project too large",
              message: `Total file size (${(sourceCodeSize / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size (200 MB)`
            },
            { status: 413 }
          )
        }
      }
    }

    // Create safe project name for ZIP
    const safeProjectName = sanitizeFilename(project.name || `project-${projectId}`)
    const exportFolderName = `${safeProjectName}-export`
    const zipFilename = `${safeProjectName}-complete-export.zip`

    // Create archiver instance
    const archive = archiver("zip", {
      zlib: { level: 6 },
    })

    // Handle archive errors
    archive.on("error", (err) => {
      console.error("[export-all] Archive error:", err)
      throw err
    })

    // Track file counts
    const counts = {
      buildPlans: 0,
      packets: 0,
      packetRuns: 0,
      brainDumps: 0,
      resources: 0,
      voiceRecordings: 0,
      sourceFiles: 0,
    }

    // === 1. Add project metadata ===
    archive.append(
      JSON.stringify(project, null, 2),
      { name: `${exportFolderName}/metadata/project.json` }
    )

    // === 2. Add build plans ===
    for (const buildPlan of buildPlans) {
      const filename = `${buildPlan.id}.json`
      archive.append(
        JSON.stringify(buildPlan, null, 2),
        { name: `${exportFolderName}/build-plans/${filename}` }
      )
      counts.buildPlans++
    }

    // === 3. Add work packets ===
    for (const packet of packets) {
      const filename = `${packet.id}.json`
      archive.append(
        JSON.stringify(packet, null, 2),
        { name: `${exportFolderName}/packets/${filename}` }
      )
      counts.packets++
    }

    // === 4. Add packet runs ===
    for (const run of packetRuns) {
      const filename = `${run.id}.json`
      archive.append(
        JSON.stringify(run, null, 2),
        { name: `${exportFolderName}/packet-runs/${filename}` }
      )
      counts.packetRuns++
    }

    // === 5. Add brain dumps ===
    for (const dump of brainDumps) {
      const filename = `${dump.id}.json`
      archive.append(
        JSON.stringify(dump, null, 2),
        { name: `${exportFolderName}/brain-dumps/${filename}` }
      )
      counts.brainDumps++
    }

    // === 6. Add resources metadata and files ===
    // First, add the resources index
    if (resources.length > 0) {
      archive.append(
        JSON.stringify(resources, null, 2),
        { name: `${exportFolderName}/resources/index.json` }
      )
    }

    // Add actual resource files (base64 decoded)
    for (const resourceFile of resourceFiles) {
      try {
        const buffer = Buffer.from(resourceFile.data, "base64")
        archive.append(buffer, {
          name: `${exportFolderName}/resources/${resourceFile.name}`
        })
        counts.resources++
      } catch (err) {
        console.error(`[export-all] Error adding resource file ${resourceFile.name}:`, err)
      }
    }

    // === 7. Add business development plan ===
    if (businessDev) {
      archive.append(
        JSON.stringify(businessDev, null, 2),
        { name: `${exportFolderName}/business-dev/business-plan.json` }
      )
    }

    // === 8. Add voice recordings metadata ===
    if (voiceRecordings.length > 0) {
      archive.append(
        JSON.stringify(voiceRecordings, null, 2),
        { name: `${exportFolderName}/voice-recordings/index.json` }
      )
      counts.voiceRecordings = voiceRecordings.length
    }

    // === 9. Add source code (if requested and available) ===
    if (includeSourceCode && projectPath) {
      async function addSourceToArchive(currentPath: string, relativePath: string = "") {
        try {
          const entries = await fs.readdir(currentPath, { withFileTypes: true })

          for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name)
            const entryRelativePath = relativePath
              ? path.join(relativePath, entry.name)
              : entry.name

            if (shouldSkip(fullPath, entry.name, entry.isDirectory())) {
              continue
            }

            if (entry.isDirectory()) {
              await addSourceToArchive(fullPath, entryRelativePath)
            } else if (entry.isFile()) {
              archive.file(fullPath, {
                name: `${exportFolderName}/source-code/${entryRelativePath}`
              })
              counts.sourceFiles++
            }
          }
        } catch (error) {
          console.error(`[export-all] Error adding ${currentPath}:`, error)
        }
      }

      await addSourceToArchive(projectPath)
    }

    // === 10. Create and add manifest ===
    const manifest: ExportManifest = {
      exportVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      projectId,
      projectName: project.name,
      counts: {
        buildPlans: counts.buildPlans,
        packets: counts.packets,
        packetRuns: counts.packetRuns,
        brainDumps: counts.brainDumps,
        resources: counts.resources,
        voiceRecordings: counts.voiceRecordings,
        sourceCodeIncluded: includeSourceCode && !!projectPath,
      },
      directories: [
        "metadata",
        "build-plans",
        "packets",
        "packet-runs",
        "brain-dumps",
        "resources",
        "business-dev",
        "voice-recordings",
        ...(includeSourceCode && projectPath ? ["source-code"] : []),
      ],
    }

    archive.append(
      JSON.stringify(manifest, null, 2),
      { name: `${exportFolderName}/manifest.json` }
    )

    // Finalize the archive
    archive.finalize()

    console.log(`[export-all] Created complete export for project ${projectId}:`, {
      buildPlans: counts.buildPlans,
      packets: counts.packets,
      packetRuns: counts.packetRuns,
      brainDumps: counts.brainDumps,
      resources: counts.resources,
      voiceRecordings: counts.voiceRecordings,
      sourceFiles: counts.sourceFiles,
    })

    // Convert Node.js stream to Web ReadableStream
    const webStream = nodeStreamToWebStream(archive as unknown as Readable)

    // Return streaming response
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create export archive"
    console.error("[export-all] POST error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/projects/[id]/export-all
 *
 * Returns information about the export endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: projectId } = await params

  return NextResponse.json({
    message: "Use POST method to export project data",
    projectId,
    usage: {
      method: "POST",
      queryParams: {
        includeSourceCode: "true|false (default: true)"
      },
      body: {
        project: "Project object (required)",
        buildPlans: "Array of StoredBuildPlan objects",
        packets: "Array of WorkPacket objects",
        packetRuns: "Array of PacketRun objects",
        brainDumps: "Array of BrainDump objects",
        resources: "Array of ProjectResource objects",
        resourceFiles: "Array of { id, name, data (base64) } objects",
        businessDev: "BusinessDev object or null",
        voiceRecordings: "Array of VoiceRecording objects",
      },
      response: "ZIP file stream",
    },
    zipStructure: {
      "manifest.json": "Index of all exported data with counts",
      "metadata/project.json": "Project metadata",
      "build-plans/*.json": "All build plans",
      "packets/*.json": "All work packets",
      "packet-runs/*.json": "Execution history",
      "brain-dumps/*.json": "Brain dump data with transcriptions",
      "resources/*": "User uploaded files",
      "business-dev/*.json": "Business development plans",
      "voice-recordings/index.json": "Voice recording metadata",
      "source-code/...": "Project source files (if includeSourceCode=true)",
    }
  })
}
