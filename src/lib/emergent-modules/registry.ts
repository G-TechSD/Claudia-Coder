/**
 * Emergent Modules Registry
 *
 * Manages the lifecycle of emergent modules - modules created from within Claudia Coder.
 * These represent the evolution of the platform, features that emerge from user creativity.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import path from "path"
import {
  StoredModule,
  CreateModuleRequest,
  ModuleStatus,
  ModuleCategory,
  CLAUDIA_CODER_PROJECT,
} from "./types"

// Storage file path
const MODULES_FILE = path.join(process.cwd(), ".local-storage", "emergent-modules.json")

/**
 * Load all modules from storage
 */
export function loadModules(): StoredModule[] {
  try {
    if (existsSync(MODULES_FILE)) {
      const data = readFileSync(MODULES_FILE, "utf-8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error("[emergent-modules] Error loading modules:", error)
  }
  return getDefaultModules()
}

/**
 * Save modules to storage
 */
export function saveModules(modules: StoredModule[]): void {
  try {
    const dir = path.dirname(MODULES_FILE)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(MODULES_FILE, JSON.stringify(modules, null, 2))
    console.log(`[emergent-modules] Saved ${modules.length} modules`)
  } catch (error) {
    console.error("[emergent-modules] Error saving modules:", error)
  }
}

/**
 * Get active modules (for sidebar display)
 */
export function getActiveModules(): StoredModule[] {
  const modules = loadModules()
  return modules
    .filter((m) => m.status === "active")
    .sort((a, b) => (a.sidebarPriority || 100) - (b.sidebarPriority || 100))
}

/**
 * Get a single module by ID
 */
export function getModule(id: string): StoredModule | undefined {
  const modules = loadModules()
  return modules.find((m) => m.id === id)
}

/**
 * Register a new emergent module
 */
export function registerModule(request: CreateModuleRequest): StoredModule {
  const modules = loadModules()

  // Generate ID from name
  const id = request.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  // Check if already exists
  const existing = modules.find((m) => m.id === id)
  if (existing) {
    throw new Error(`Module with ID "${id}" already exists`)
  }

  const newModule: StoredModule = {
    id,
    name: request.name,
    description: request.description,
    icon: request.icon || "Sparkles",
    category: request.category || "other",
    version: "1.0.0",
    author: request.createdBy === "manual" ? "User" : `AI-assisted (${request.createdBy || "unknown"})`,
    route: `/modules/${id}`,
    createdAt: new Date().toISOString(),
    createdBy: request.createdBy || "unknown",
    createdInSession: request.sessionId,
    status: "active",
    sidebarPriority: 100,
    files: request.files,
    enabledAt: new Date().toISOString(),
    accessCount: 0,
  }

  modules.push(newModule)
  saveModules(modules)

  console.log(`[emergent-modules] Registered new module: ${newModule.name}`)
  return newModule
}

/**
 * Update a module's status
 */
export function updateModuleStatus(id: string, status: ModuleStatus, errorMessage?: string): StoredModule | null {
  const modules = loadModules()
  const index = modules.findIndex((m) => m.id === id)

  if (index === -1) {
    return null
  }

  modules[index].status = status
  if (errorMessage) {
    modules[index].errorMessage = errorMessage
  } else {
    delete modules[index].errorMessage
  }

  if (status === "active") {
    modules[index].enabledAt = new Date().toISOString()
  } else if (status === "disabled") {
    modules[index].disabledAt = new Date().toISOString()
  }

  saveModules(modules)
  return modules[index]
}

/**
 * Record module access (for analytics/sorting)
 */
export function recordModuleAccess(id: string): void {
  const modules = loadModules()
  const moduleRecord = modules.find((m) => m.id === id)

  if (moduleRecord) {
    moduleRecord.lastAccessedAt = new Date().toISOString()
    moduleRecord.accessCount = (moduleRecord.accessCount || 0) + 1
    saveModules(modules)
  }
}

/**
 * Delete a module
 */
export function deleteModule(id: string): boolean {
  const modules = loadModules()
  const filtered = modules.filter((m) => m.id !== id)

  if (filtered.length === modules.length) {
    return false
  }

  saveModules(filtered)
  console.log(`[emergent-modules] Deleted module: ${id}`)
  return true
}

/**
 * Get default modules (shipped with Claudia Coder as examples)
 */
export function getDefaultModules(): StoredModule[] {
  return [
    {
      id: "ascii-movies",
      name: "ASCII Movies",
      description: "Generate and play ASCII art animations. Create retro-style movies using text characters.",
      icon: "Film",
      category: "creative",
      version: "1.0.0",
      author: "AI-assisted (claude-code)",
      route: "/modules/ascii-movies",
      createdAt: new Date().toISOString(),
      createdBy: "claude-code",
      status: "active",
      sidebarPriority: 50,
      experimental: true,
      enabledAt: new Date().toISOString(),
      accessCount: 0,
      files: [
        "src/app/modules/ascii-movies/page.tsx",
        "src/components/modules/ascii-movie-player.tsx",
        "src/lib/ascii-movies/generator.ts",
      ],
    },
  ]
}

/**
 * Initialize the registry with default modules if empty
 */
export function initializeRegistry(): void {
  if (!existsSync(MODULES_FILE)) {
    const defaults = getDefaultModules()
    saveModules(defaults)
    console.log("[emergent-modules] Initialized registry with default modules")
  }
}

/**
 * Get Claudia Coder project info
 */
export function getClaudiaCoderProject() {
  return {
    ...CLAUDIA_CODER_PROJECT,
    workingDirectory: process.cwd(),
  }
}

/**
 * Generate module scaffold files
 */
export function getModuleScaffold(name: string, description: string, category: ModuleCategory): { path: string; content: string }[] {
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  const componentName = name.replace(/[^a-zA-Z0-9]/g, "")

  return [
    {
      path: `src/app/modules/${id}/page.tsx`,
      content: `"use client"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles } from "lucide-react"

export default function ${componentName}Page() {
  return (
    <AppShell>
      <div className="container max-w-4xl py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">${name}</h1>
              <Badge variant="outline" className="text-xs">Emergent Module</Badge>
            </div>
            <p className="text-sm text-muted-foreground">${description}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome to ${name}</CardTitle>
            <CardDescription>
              This is an emergent module - created from within Claudia Coder itself.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Start building your module here. This scaffold was generated to help you get started.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
`,
    },
  ]
}
