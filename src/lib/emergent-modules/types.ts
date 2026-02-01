/**
 * Emergent Modules Types
 *
 * Emergent modules are functionality created from within Claudia Coder itself.
 * They represent capabilities that emerge after deployment - features that didn't
 * exist in the original codebase but were created by users working with AI assistants.
 *
 * This is the evolution of software: code that writes code that becomes part of the system.
 */

// Module status
export type ModuleStatus = "active" | "disabled" | "error" | "loading"

// Module category for organization
export type ModuleCategory =
  | "creative"      // Art, music, content generation
  | "productivity"  // Tools, utilities, automation
  | "development"   // Code tools, debugging, analysis
  | "data"          // Data visualization, analysis
  | "communication" // Chat, notifications, sharing
  | "experimental"  // Cutting-edge, unstable features
  | "other"

// Icon can be a Lucide icon name or an emoji
export type ModuleIcon = string

// Module manifest - defines what the module is
export interface EmergentModuleManifest {
  id: string                    // Unique identifier (kebab-case)
  name: string                  // Display name
  description: string           // What the module does
  icon: ModuleIcon              // Lucide icon name or emoji
  category: ModuleCategory      // For grouping in sidebar
  version: string               // Semantic version
  author?: string               // Who created it (could be "AI-assisted" or user name)
  route: string                 // URL path (e.g., "/modules/ascii-movies")

  // Creation metadata
  createdAt: string             // ISO date
  createdBy: "claude-code" | "ganesha" | "manual" | "unknown"
  createdInSession?: string     // Session ID where it was created

  // Module state
  status: ModuleStatus
  errorMessage?: string

  // Optional features
  sidebarPriority?: number      // Lower = higher in list (default: 100)
  requiresAuth?: boolean        // Does it need authentication?
  experimental?: boolean        // Show experimental badge?

  // Files this module created/modified
  files?: string[]
}

// Stored module (in JSON file)
export interface StoredModule extends EmergentModuleManifest {
  enabledAt?: string            // When it was enabled
  disabledAt?: string           // When it was disabled
  lastAccessedAt?: string       // For sorting by recency
  accessCount?: number          // Usage tracking
}

// Module registry response
export interface ModuleRegistryResponse {
  modules: StoredModule[]
  activeCount: number
  totalCount: number
  timestamp: string
}

// Request to create a new module
export interface CreateModuleRequest {
  name: string
  description: string
  icon?: ModuleIcon
  category?: ModuleCategory
  createdBy?: "claude-code" | "ganesha" | "manual"
  sessionId?: string
  files?: string[]
}

// Module template - scaffolding for new modules
export interface ModuleTemplate {
  id: string
  name: string
  description: string
  files: {
    path: string
    content: string
  }[]
}

// Event emitted when a module is created
export interface ModuleCreatedEvent {
  type: "module_created"
  module: StoredModule
  timestamp: string
}

// Claudia Coder's own project info
// We calculate the path relative to this file's location to ensure reliability
// This file is at: src/lib/emergent-modules/types.ts
// So we go up 4 levels to get to the repo root
import path from "path"
import { fileURLToPath } from "url"

// Get the directory of this file and calculate repo root
const getRepoRoot = (): string => {
  // Check for environment variable first (for containerized/remote deployments)
  if (process.env.CLAUDIA_ROOT) {
    return process.env.CLAUDIA_ROOT
  }

  // In server context, we can use __dirname or calculate from this file
  // This file is at: <repo>/src/lib/emergent-modules/types.ts
  // We need to go up 3 directories to get to <repo>
  try {
    // Try using the file URL approach for ESM
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    return path.resolve(__dirname, "..", "..", "..")
  } catch {
    // Fallback to process.cwd() - works when running from repo root
    return process.cwd()
  }
}

export const CLAUDIA_CODER_PROJECT = {
  id: "claudia-coder",
  name: "Claudia Coder",
  description: "AI-powered development orchestration platform - the system you're using right now",
  workingDirectory: getRepoRoot(),
  isSystem: true,
}
