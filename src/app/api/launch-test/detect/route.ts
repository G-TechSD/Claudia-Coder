/**
 * Detect Project Type API
 * POST /api/launch-test/detect
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"
import * as path from "path"

const PROJECT_TYPES = {
  flutter: {
    files: ["pubspec.yaml"],
    packageJsonDeps: []
  },
  nextjs: {
    files: ["next.config.js", "next.config.mjs", "next.config.ts"],
    packageJsonDeps: ["next"]
  },
  react: {
    files: [],
    packageJsonDeps: ["react", "react-dom"]
  },
  vue: {
    files: ["vue.config.js", "src/App.vue"],
    packageJsonDeps: ["vue"]
  },
  django: {
    files: ["manage.py"],
    packageJsonDeps: []
  },
  node: {
    files: ["server.js", "app.js"],
    packageJsonDeps: ["express"]
  },
  python: {
    files: ["main.py", "app.py", "requirements.txt"],
    packageJsonDeps: []
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { repoPath } = body

  if (!repoPath) {
    return NextResponse.json({ error: "repoPath required" }, { status: 400 })
  }

  try {
    // Check for various project type indicators
    for (const [typeName, config] of Object.entries(PROJECT_TYPES)) {
      for (const file of config.files) {
        try {
          await fs.access(path.join(repoPath, file))
          return NextResponse.json({ projectType: typeName })
        } catch {
          // File doesn't exist, continue
        }
      }
    }

    // Check package.json for dependencies
    try {
      const packageJsonPath = path.join(repoPath, "package.json")
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"))
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }

      for (const [typeName, config] of Object.entries(PROJECT_TYPES)) {
        for (const dep of config.packageJsonDeps) {
          if (allDeps[dep]) {
            return NextResponse.json({ projectType: typeName })
          }
        }
      }

      return NextResponse.json({ projectType: "node" })
    } catch {
      // No package.json
    }

    // Check for Python projects
    try {
      await fs.access(path.join(repoPath, "requirements.txt"))
      return NextResponse.json({ projectType: "python" })
    } catch {
      // Not found
    }

    return NextResponse.json({ projectType: null })
  } catch (error) {
    return NextResponse.json({
      projectType: null,
      error: error instanceof Error ? error.message : "Detection failed"
    })
  }
}
