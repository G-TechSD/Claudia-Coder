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
}

// Order matters! More specific types should come before generic ones
const PROJECT_TYPES: Record<string, ProjectTypeConfig> = {
  flutter: {
    name: "Flutter",
    identifyingFiles: ["pubspec.yaml"],
    packageJsonDeps: [],
    fallbackFiles: []
  },
  rust: {
    name: "Rust",
    identifyingFiles: ["Cargo.toml"],
    packageJsonDeps: [],
    fallbackFiles: []
  },
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
  node: {
    name: "Node.js",
    identifyingFiles: [],
    packageJsonDeps: ["express", "fastify", "koa", "hapi"],
    fallbackFiles: ["server.js", "app.js", "index.js"]
  },
  python: {
    name: "Python",
    identifyingFiles: [],
    packageJsonDeps: [],
    fallbackFiles: ["main.py", "app.py", "requirements.txt"]
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

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { repoPath } = body

  if (!repoPath) {
    return NextResponse.json({ error: "repoPath required" }, { status: 400 })
  }

  try {
    // First, check if the directory exists
    const dirExists = await fileExists(repoPath)
    if (!dirExists) {
      console.log(`[detect] Directory does not exist: ${repoPath}`)
      return NextResponse.json({
        projectType: null,
        error: `Directory not found: ${repoPath}`,
        suggestion: "Set the working directory or local repo path in project settings"
      })
    }

    console.log(`[detect] Scanning directory: ${repoPath}`)

    // Phase 1: Check for identifying files (most reliable)
    for (const [typeName, config] of Object.entries(PROJECT_TYPES)) {
      for (const file of config.identifyingFiles) {
        const filePath = path.join(repoPath, file)
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
    const packageJson = await readPackageJson(repoPath)
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
    const requirements = await readRequirementsTxt(repoPath)
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
        console.log(`[detect] Found fastapi in requirements.txt -> fastapi`)
        return NextResponse.json({
          projectType: "fastapi",
          detectedBy: "requirements.txt:fastapi"
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
        const filePath = path.join(repoPath, file)
        if (await fileExists(filePath)) {
          console.log(`[detect] Found fallback ${file} -> ${typeName}`)
          return NextResponse.json({
            projectType: typeName,
            detectedBy: `fallback:${file}`
          })
        }
      }
    }

    // List files for debugging
    try {
      const files = await fs.readdir(repoPath)
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
