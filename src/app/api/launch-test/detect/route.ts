/**
 * Detect Project Type API
 * POST /api/launch-test/detect
 *
 * Auto-detects project type by examining files in the working directory.
 * Priority:
 * 1. Check for specific framework config files (pubspec.yaml, next.config.*, etc.)
 * 2. Check package.json dependencies (next before react, since Next.js includes React)
 * 3. Check for language-specific files (Cargo.toml, requirements.txt, etc.)
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"
import * as path from "path"

interface ProjectTypeConfig {
  name: string
  // Files that definitively identify this project type (checked first)
  identifyingFiles: string[]
  // package.json dependencies to check (in order of priority)
  packageJsonDeps: string[]
  // Additional files to check as fallback
  fallbackFiles: string[]
  // SECURITY: Directory to serve from (e.g., "public" for static sites)
  publicDir?: string
}

// Order matters! More specific types should come before generic ones
const PROJECT_TYPES: Record<string, ProjectTypeConfig> = {
  // Mobile / Cross-platform (check first - very specific)
  flutter: {
    name: "Flutter",
    identifyingFiles: ["pubspec.yaml"],
    packageJsonDeps: [],
    fallbackFiles: []
  },

  // Desktop Apps (Electron/Tauri)
  desktop: {
    name: "Desktop App",
    identifyingFiles: ["electron.config.js", "tauri.conf.json", "electron-builder.json"],
    packageJsonDeps: ["electron", "@tauri-apps/cli"],
    fallbackFiles: []
  },

  // Systems / Compiled
  rust: {
    name: "Rust",
    identifyingFiles: ["Cargo.toml"],
    packageJsonDeps: [],
    fallbackFiles: []
  },

  // n8n Workflows
  n8n: {
    name: "n8n Workflows",
    identifyingFiles: [".n8n", "n8n-config.json"],
    packageJsonDeps: ["n8n"],
    fallbackFiles: []
  },

  // Web Frameworks - JavaScript/TypeScript (order matters!)
  nextjs: {
    name: "Next.js",
    identifyingFiles: ["next.config.js", "next.config.mjs", "next.config.ts"],
    packageJsonDeps: ["next"], // Check BEFORE react
    fallbackFiles: []
  },
  nuxt: {
    name: "Nuxt",
    identifyingFiles: ["nuxt.config.js", "nuxt.config.ts"],
    packageJsonDeps: ["nuxt"],
    fallbackFiles: []
  },
  svelte: {
    name: "SvelteKit",
    identifyingFiles: ["svelte.config.js"],
    packageJsonDeps: ["@sveltejs/kit", "svelte"],
    fallbackFiles: []
  },
  vue: {
    name: "Vue",
    identifyingFiles: ["vue.config.js", "vite.config.ts"],
    packageJsonDeps: ["vue"],
    fallbackFiles: ["src/App.vue"]
  },
  react: {
    name: "React",
    identifyingFiles: [],
    packageJsonDeps: ["react"], // Checked AFTER nextjs
    fallbackFiles: ["src/App.tsx", "src/App.jsx", "src/App.js"]
  },

  // PHP / Traditional Web
  // SECURITY: Should serve from public/ folder
  php: {
    name: "PHP / MySQL",
    identifyingFiles: ["composer.json", "composer.lock"],
    packageJsonDeps: [],
    fallbackFiles: ["public/index.php", "index.php", "wp-config.php", "config.php"],
    publicDir: "public"
  },

  // Python Frameworks
  django: {
    name: "Django",
    identifyingFiles: ["manage.py"],
    packageJsonDeps: [],
    fallbackFiles: ["settings.py"]
  },
  fastapi: {
    name: "FastAPI",
    identifyingFiles: [],
    packageJsonDeps: [],
    fallbackFiles: [] // Detected via requirements.txt content
  },
  flask: {
    name: "Flask",
    identifyingFiles: [],
    packageJsonDeps: [],
    fallbackFiles: [] // Detected via requirements.txt content
  },

  // Generic Node.js
  node: {
    name: "Node.js",
    identifyingFiles: [],
    packageJsonDeps: ["express", "fastify", "koa", "hapi"],
    fallbackFiles: ["server.js", "app.js", "index.js"]
  },

  // Generic Python
  python: {
    name: "Python",
    identifyingFiles: [],
    packageJsonDeps: [],
    fallbackFiles: ["main.py", "app.py", "requirements.txt"]
  },

  // Static HTML (check last - very generic)
  // SECURITY: Should serve from public/ folder
  html: {
    name: "Static HTML",
    identifyingFiles: [],
    packageJsonDeps: [],
    fallbackFiles: ["public/index.html", "public/index.htm", "index.html", "index.htm", "dist/index.html"],
    publicDir: "public"
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readPackageJson(repoPath: string): Promise<Record<string, unknown> | null> {
  try {
    const packageJsonPath = path.join(repoPath, "package.json")
    const content = await fs.readFile(packageJsonPath, "utf-8")
    return JSON.parse(content)
  } catch {
    return null
  }
}

async function readRequirementsTxt(repoPath: string): Promise<string | null> {
  try {
    const requirementsPath = path.join(repoPath, "requirements.txt")
    return await fs.readFile(requirementsPath, "utf-8")
  } catch {
    return null
  }
}

/**
 * Find the FastAPI app module path by looking for main.py or app.py
 * Returns the module path for uvicorn (e.g., "main:app" or "src.main:app")
 */
async function findFastAPIModule(repoPath: string): Promise<string> {
  // Common locations for FastAPI apps, in order of preference
  const searchPaths = [
    { file: "main.py", module: "main:app" },
    { file: "app.py", module: "app:app" },
    { file: "src/main.py", module: "src.main:app" },
    { file: "src/app.py", module: "src.app:app" },
    { file: "app/main.py", module: "app.main:app" },
    { file: "api/main.py", module: "api.main:app" },
  ]

  for (const { file, module } of searchPaths) {
    const filePath = path.join(repoPath, file)
    if (await fileExists(filePath)) {
      // Also check if the file contains a FastAPI app
      try {
        const content = await fs.readFile(filePath, "utf-8")
        if (content.includes("FastAPI") || content.includes("app =") || content.includes("app=")) {
          console.log(`[detect] Found FastAPI app at ${file} -> ${module}`)
          return module
        }
      } catch {
        // File exists but couldn't read, still return the module
        return module
      }
    }
  }

  // Default fallback
  return "main:app"
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { repoPath } = body

  if (!repoPath) {
    return NextResponse.json({ error: "repoPath required" }, { status: 400 })
  }

  // Expand ~ to home directory
  const expandedPath = repoPath.replace(/^~/, process.env.HOME || require("os").homedir())

  try {
    // First, check if the directory exists
    const dirExists = await fileExists(expandedPath)
    if (!dirExists) {
      console.log(`[detect] Directory does not exist: ${expandedPath}`)
      return NextResponse.json({
        projectType: null,
        error: `Directory not found: ${expandedPath}`,
        suggestion: "Set the working directory or local repo path in project settings"
      })
    }

    console.log(`[detect] Scanning directory: ${expandedPath}`)

    // Phase 1: Check for identifying files (most reliable)
    for (const [typeName, config] of Object.entries(PROJECT_TYPES)) {
      for (const file of config.identifyingFiles) {
        const filePath = path.join(expandedPath, file)
        if (await fileExists(filePath)) {
          console.log(`[detect] Found ${file} -> ${typeName}`)
          return NextResponse.json({
            projectType: typeName,
            detectedBy: `file:${file}`
          })
        }
      }
    }

    // Phase 2: Check package.json dependencies (order matters!)
    const packageJson = await readPackageJson(expandedPath)
    if (packageJson) {
      const deps = packageJson.dependencies as Record<string, string> | undefined
      const devDeps = packageJson.devDependencies as Record<string, string> | undefined
      const allDeps = { ...deps, ...devDeps }

      console.log(`[detect] Found package.json with deps:`, Object.keys(allDeps).slice(0, 10))

      // Check in order - nextjs before react is critical!
      for (const [typeName, config] of Object.entries(PROJECT_TYPES)) {
        for (const dep of config.packageJsonDeps) {
          if (allDeps[dep]) {
            console.log(`[detect] Found ${dep} in package.json -> ${typeName}`)
            return NextResponse.json({
              projectType: typeName,
              detectedBy: `package.json:${dep}`
            })
          }
        }
      }

      // Has package.json but no known framework - generic Node.js
      console.log(`[detect] package.json with no known framework -> node`)
      return NextResponse.json({
        projectType: "node",
        detectedBy: "package.json:generic"
      })
    }

    // Phase 3: Check requirements.txt for Python frameworks
    const requirements = await readRequirementsTxt(expandedPath)
    if (requirements) {
      const reqLower = requirements.toLowerCase()

      if (reqLower.includes("django")) {
        console.log(`[detect] Found django in requirements.txt -> django`)
        return NextResponse.json({
          projectType: "django",
          detectedBy: "requirements.txt:django"
        })
      }

      if (reqLower.includes("fastapi")) {
        // Find the correct module path for the FastAPI app
        const modulePath = await findFastAPIModule(expandedPath)
        const suggestedCommand = `uvicorn ${modulePath} --host 0.0.0.0 --port 8000 --reload`
        console.log(`[detect] Found fastapi in requirements.txt -> fastapi (module: ${modulePath})`)
        return NextResponse.json({
          projectType: "fastapi",
          detectedBy: "requirements.txt:fastapi",
          modulePath,
          suggestedCommand
        })
      }

      if (reqLower.includes("flask")) {
        console.log(`[detect] Found flask in requirements.txt -> flask`)
        return NextResponse.json({
          projectType: "flask",
          detectedBy: "requirements.txt:flask"
        })
      }

      // Generic Python project
      console.log(`[detect] requirements.txt with no known framework -> python`)
      return NextResponse.json({
        projectType: "python",
        detectedBy: "requirements.txt:generic"
      })
    }

    // Phase 4: Check fallback files
    for (const [typeName, config] of Object.entries(PROJECT_TYPES)) {
      for (const file of config.fallbackFiles) {
        const filePath = path.join(expandedPath, file)
        if (await fileExists(filePath)) {
          console.log(`[detect] Found fallback ${file} -> ${typeName}`)

          // For types that should use public/ folder, check structure and warn
          const response: Record<string, unknown> = {
            projectType: typeName,
            detectedBy: `fallback:${file}`
          }

          if (config.publicDir) {
            const publicDirPath = path.join(expandedPath, config.publicDir)
            const hasPublicDir = await fileExists(publicDirPath)
            const isFileInPublicDir = file.startsWith(config.publicDir + "/")

            response.publicDir = config.publicDir
            response.hasPublicDir = hasPublicDir

            // SECURITY: Warn if serving from root instead of public folder
            if (!isFileInPublicDir && !hasPublicDir) {
              response.securityWarning = `For security, create a '${config.publicDir}/' folder and move web-accessible files there. This prevents exposing config files, .env, etc.`
              console.log(`[detect] SECURITY WARNING: ${typeName} project serving from root, not ${config.publicDir}/`)
            } else if (!isFileInPublicDir && hasPublicDir) {
              response.structureWarning = `Found '${config.publicDir}/' folder but entry file is in root. Move ${file} to ${config.publicDir}/ for proper security.`
            }
          }

          return NextResponse.json(response)
        }
      }
    }

    // List files for debugging
    try {
      const files = await fs.readdir(expandedPath)
      console.log(`[detect] No project type detected. Files in directory:`, files.slice(0, 20))
    } catch {
      // Ignore
    }

    return NextResponse.json({
      projectType: null,
      error: "Could not determine project type from files"
    })
  } catch (error) {
    console.error("[detect] Error:", error)
    return NextResponse.json({
      projectType: null,
      error: error instanceof Error ? error.message : "Detection failed"
    })
  }
}
