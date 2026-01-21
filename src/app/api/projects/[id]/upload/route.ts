/**
 * Project Upload API
 *
 * POST /api/projects/[id]/upload
 *
 * Handles:
 * - Multiple file uploads with preserved folder structure
 * - Zip file uploads with automatic extraction
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import AdmZip from "adm-zip"

interface RouteParams {
  params: Promise<{ id: string }>
}

interface UploadedFile {
  name: string
  path: string
  size: number
  type: "file" | "directory"
}

// Max upload size (500MB)
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024

// Files/folders to skip
const SKIP_PATTERNS = [
  "node_modules",
  ".git",
  ".next",
  "__pycache__",
  ".DS_Store",
  "Thumbs.db",
  ".env.local",
]

/**
 * Expand ~ to home directory
 */
function expandPath(p: string): string {
  if (!p) return p
  return p.replace(/^~/, os.homedir())
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    // Ignore if already exists
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error
    }
  }
}

/**
 * Check if path should be skipped
 */
function shouldSkip(filePath: string): boolean {
  const parts = filePath.split("/")
  return parts.some((part) => SKIP_PATTERNS.includes(part))
}

/**
 * Extract zip file to directory
 */
async function extractZip(
  zipBuffer: Buffer,
  targetDir: string
): Promise<UploadedFile[]> {
  const uploadedFiles: UploadedFile[] = []
  const createdDirs = new Set<string>()

  const zip = new AdmZip(zipBuffer)
  const entries = zip.getEntries()

  for (const entry of entries) {
    const entryPath = entry.entryName

    // Skip unwanted files
    if (shouldSkip(entryPath)) {
      continue
    }

    const fullPath = path.join(targetDir, entryPath)
    const isDirectory = entry.isDirectory

    if (isDirectory) {
      // Create directory
      if (!createdDirs.has(fullPath)) {
        await ensureDir(fullPath)
        createdDirs.add(fullPath)
        uploadedFiles.push({
          name: path.basename(entryPath),
          path: entryPath,
          size: 0,
          type: "directory",
        })
      }
    } else {
      // Ensure parent directory exists
      const dirPath = path.dirname(fullPath)
      if (!createdDirs.has(dirPath)) {
        await ensureDir(dirPath)
        createdDirs.add(dirPath)
      }

      // Extract file
      const data = entry.getData()
      await fs.writeFile(fullPath, data)

      uploadedFiles.push({
        name: path.basename(entryPath),
        path: entryPath,
        size: data.length,
        type: "file",
      })
    }
  }

  return uploadedFiles
}

/**
 * POST /api/projects/[id]/upload
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const workingDirectory = formData.get("workingDirectory") as string

    if (!workingDirectory) {
      return NextResponse.json(
        { error: "workingDirectory is required" },
        { status: 400 }
      )
    }

    const targetDir = expandPath(workingDirectory)

    // Ensure target directory exists
    await ensureDir(targetDir)

    const uploadedFiles: UploadedFile[] = []

    // Check for zip file
    const zipFile = formData.get("zipFile") as File | null

    if (zipFile) {
      // Handle zip upload
      const arrayBuffer = await zipFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      if (buffer.length > MAX_UPLOAD_SIZE) {
        return NextResponse.json(
          { error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE / 1024 / 1024}MB` },
          { status: 413 }
        )
      }

      console.log(`[upload] Extracting zip: ${zipFile.name} (${buffer.length} bytes)`)

      const extracted = await extractZip(buffer, targetDir)
      uploadedFiles.push(...extracted)

      console.log(`[upload] Extracted ${extracted.length} files from zip`)

      return NextResponse.json({
        success: true,
        projectId,
        workingDirectory: targetDir,
        fileCount: uploadedFiles.length,
        files: uploadedFiles,
        source: "zip",
        zipName: zipFile.name,
      })
    }

    // Handle multiple file uploads
    const files = formData.getAll("files") as File[]
    const paths = formData.getAll("paths") as string[]

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      )
    }

    // Check total size
    const totalSize = files.reduce((sum, f) => sum + f.size, 0)
    if (totalSize > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: `Total size too large. Maximum is ${MAX_UPLOAD_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      )
    }

    console.log(`[upload] Uploading ${files.length} files (${totalSize} bytes)`)

    const createdDirs = new Set<string>()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const relativePath = paths[i] || file.name

      // Skip unwanted files
      if (shouldSkip(relativePath)) {
        continue
      }

      const fullPath = path.join(targetDir, relativePath)
      const dirPath = path.dirname(fullPath)

      // Ensure directory exists
      if (!createdDirs.has(dirPath)) {
        await ensureDir(dirPath)
        createdDirs.add(dirPath)
      }

      // Write file
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await fs.writeFile(fullPath, buffer)

      uploadedFiles.push({
        name: file.name,
        path: relativePath,
        size: file.size,
        type: "file",
      })
    }

    console.log(`[upload] Uploaded ${uploadedFiles.length} files`)

    return NextResponse.json({
      success: true,
      projectId,
      workingDirectory: targetDir,
      fileCount: uploadedFiles.length,
      files: uploadedFiles,
      source: "folder",
    })
  } catch (error) {
    console.error("[upload] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
}
