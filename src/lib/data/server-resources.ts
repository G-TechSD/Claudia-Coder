/**
 * Server-Side Resources Storage
 *
 * This module provides server-side file operations for project resources and brain dumps.
 * The file ~/.claudia-data/resources.json is the SOURCE OF TRUTH.
 *
 * IMPORTANT: This module should ONLY be imported in server-side code (API routes).
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

// Server-side storage location
const DATA_DIR = process.env.CLAUDIA_DATA_DIR || path.join(os.homedir(), ".claudia-data")
const RESOURCES_FILE = path.join(DATA_DIR, "resources.json")
const BRAIN_DUMPS_FILE = path.join(DATA_DIR, "brain-dumps.json")
const RESEARCH_FILE = path.join(DATA_DIR, "research.json")

export interface Resource {
  id: string
  projectId: string
  type: "document" | "image" | "video" | "link" | "file" | "other"
  name: string
  url?: string
  content?: string
  description?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
  userId?: string
}

export interface BrainDump {
  id: string
  projectId?: string
  content: string
  createdAt: string
  updatedAt: string
  tags?: string[]
  userId?: string
}

export interface ResearchEntry {
  id: string
  projectId: string
  title: string
  content: string
  url?: string
  type: "article" | "patent" | "paper" | "website" | "other"
  notes?: string
  createdAt: string
  updatedAt: string
  userId?: string
}

/**
 * Ensure the data directory exists
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
  } catch {
    // Directory might already exist
  }
}

// ============ RESOURCES ============

export async function readResourcesFile(): Promise<Resource[]> {
  try {
    await ensureDataDir()
    const content = await fs.readFile(RESOURCES_FILE, "utf-8")
    return JSON.parse(content) as Resource[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    console.error("[server-resources] Error reading file:", error)
    throw error
  }
}

export async function writeResourcesFile(resources: Resource[]): Promise<void> {
  await ensureDataDir()
  const tempPath = `${RESOURCES_FILE}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(resources, null, 2), "utf-8")
  await fs.rename(tempPath, RESOURCES_FILE)
}

export async function getResourcesForProject(projectId: string): Promise<Resource[]> {
  const all = await readResourcesFile()
  return all.filter(r => r.projectId === projectId)
}

export async function addResource(resource: Resource): Promise<Resource> {
  const all = await readResourcesFile()
  all.push(resource)
  await writeResourcesFile(all)
  return resource
}

export async function updateResource(id: string, updates: Partial<Resource>): Promise<Resource | null> {
  const all = await readResourcesFile()
  const index = all.findIndex(r => r.id === id)
  if (index === -1) return null
  all[index] = { ...all[index], ...updates, updatedAt: new Date().toISOString() }
  await writeResourcesFile(all)
  return all[index]
}

export async function deleteResource(id: string): Promise<boolean> {
  const all = await readResourcesFile()
  const filtered = all.filter(r => r.id !== id)
  if (filtered.length === all.length) return false
  await writeResourcesFile(filtered)
  return true
}

// ============ BRAIN DUMPS ============

export async function readBrainDumpsFile(): Promise<BrainDump[]> {
  try {
    await ensureDataDir()
    const content = await fs.readFile(BRAIN_DUMPS_FILE, "utf-8")
    return JSON.parse(content) as BrainDump[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    console.error("[server-resources] Error reading brain dumps:", error)
    throw error
  }
}

export async function writeBrainDumpsFile(dumps: BrainDump[]): Promise<void> {
  await ensureDataDir()
  const tempPath = `${BRAIN_DUMPS_FILE}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(dumps, null, 2), "utf-8")
  await fs.rename(tempPath, BRAIN_DUMPS_FILE)
}

export async function getBrainDumpsForProject(projectId: string): Promise<BrainDump[]> {
  const all = await readBrainDumpsFile()
  return all.filter(d => d.projectId === projectId)
}

export async function addBrainDump(dump: BrainDump): Promise<BrainDump> {
  const all = await readBrainDumpsFile()
  all.push(dump)
  await writeBrainDumpsFile(all)
  return dump
}

export async function deleteBrainDump(id: string): Promise<boolean> {
  const all = await readBrainDumpsFile()
  const filtered = all.filter(d => d.id !== id)
  if (filtered.length === all.length) return false
  await writeBrainDumpsFile(filtered)
  return true
}

// ============ RESEARCH ============

export async function readResearchFile(): Promise<ResearchEntry[]> {
  try {
    await ensureDataDir()
    const content = await fs.readFile(RESEARCH_FILE, "utf-8")
    return JSON.parse(content) as ResearchEntry[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    console.error("[server-resources] Error reading research:", error)
    throw error
  }
}

export async function writeResearchFile(entries: ResearchEntry[]): Promise<void> {
  await ensureDataDir()
  const tempPath = `${RESEARCH_FILE}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(entries, null, 2), "utf-8")
  await fs.rename(tempPath, RESEARCH_FILE)
}

export async function getResearchForProject(projectId: string): Promise<ResearchEntry[]> {
  const all = await readResearchFile()
  return all.filter(e => e.projectId === projectId)
}

export async function addResearchEntry(entry: ResearchEntry): Promise<ResearchEntry> {
  const all = await readResearchFile()
  all.push(entry)
  await writeResearchFile(all)
  return entry
}

export async function deleteResearchEntry(id: string): Promise<boolean> {
  const all = await readResearchFile()
  const filtered = all.filter(e => e.id !== id)
  if (filtered.length === all.length) return false
  await writeResearchFile(filtered)
  return true
}
