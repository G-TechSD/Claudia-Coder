/**
 * Install Dependencies API
 * POST /api/launch-test/install-deps
 *
 * Checks if dependencies need to be installed and installs them if needed.
 * Supports: Node.js (npm/yarn/pnpm), Python (pip), Rust (cargo), Flutter (pub)
 */

import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs/promises"
import * as path from "path"

const execAsync = promisify(exec)

/**
 * Expand ~ to home directory in paths
 */
function expandPath(p: string): string {
  return p.replace(/^~/, process.env.HOME || require("os").homedir())
}

interface DependencyCheck {
  needsInstall: boolean
  reason?: string
  packageManager?: string
  installCommand?: string
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Check if the project has actual code files based on project type
 * Returns an object indicating if files were found and what was checked
 */
async function checkProjectFiles(repoPath: string, projectType?: string): Promise<{
  hasFiles: boolean
  checkedFiles: string[]
  foundFiles: string[]
  projectTypeDetected: string | null
}> {
  const checkedFiles: string[] = []
  const foundFiles: string[] = []
  let projectTypeDetected: string | null = null

  // Node.js project files (Next.js, React, Vue, etc.)
  const nodeFiles = ["package.json"]
  // Python project files
  const pythonFiles = ["main.py", "app.py", "requirements.txt", "pyproject.toml", "manage.py"]
  // Rust project files
  const rustFiles = ["Cargo.toml"]
  // Flutter project files
  const flutterFiles = ["pubspec.yaml"]
  // Static HTML project files (check multiple common locations including public/ for security)
  const htmlFiles = ["public/index.html", "public/index.htm", "index.html", "index.htm", "dist/index.html"]
  // PHP project files (check public/ folder first for security)
  const phpFiles = ["public/index.php", "index.php", "composer.json"]

  // Check based on project type if specified
  if (projectType) {
    if (["nextjs", "react", "vue", "svelte", "nuxt", "node"].includes(projectType)) {
      for (const file of nodeFiles) {
        const filePath = path.join(repoPath, file)
        checkedFiles.push(file)
        if (await fileExists(filePath)) {
          foundFiles.push(file)
          projectTypeDetected = projectType
        }
      }
    } else if (["python", "django", "fastapi", "flask"].includes(projectType)) {
      for (const file of pythonFiles) {
        const filePath = path.join(repoPath, file)
        checkedFiles.push(file)
        if (await fileExists(filePath)) {
          foundFiles.push(file)
          projectTypeDetected = projectType
        }
      }
    } else if (projectType === "rust") {
      for (const file of rustFiles) {
        const filePath = path.join(repoPath, file)
        checkedFiles.push(file)
        if (await fileExists(filePath)) {
          foundFiles.push(file)
          projectTypeDetected = projectType
        }
      }
    } else if (projectType === "flutter") {
      for (const file of flutterFiles) {
        const filePath = path.join(repoPath, file)
        checkedFiles.push(file)
        if (await fileExists(filePath)) {
          foundFiles.push(file)
          projectTypeDetected = projectType
        }
      }
    } else if (projectType === "html") {
      // Static HTML - check multiple locations
      for (const file of htmlFiles) {
        const filePath = path.join(repoPath, file)
        checkedFiles.push(file)
        if (await fileExists(filePath)) {
          foundFiles.push(file)
          projectTypeDetected = "html"
        }
      }
    } else if (projectType === "php") {
      for (const file of phpFiles) {
        const filePath = path.join(repoPath, file)
        checkedFiles.push(file)
        if (await fileExists(filePath)) {
          foundFiles.push(file)
          projectTypeDetected = projectType
        }
      }
    }
  }

  // If no project type specified or no files found, check all common files
  if (!projectType || foundFiles.length === 0) {
    const allFiles = [...nodeFiles, ...pythonFiles, ...rustFiles, ...flutterFiles, ...htmlFiles, ...phpFiles]
    for (const file of allFiles) {
      if (!checkedFiles.includes(file)) {
        const filePath = path.join(repoPath, file)
        checkedFiles.push(file)
        if (await fileExists(filePath)) {
          foundFiles.push(file)
          // Detect project type from found file
          if (!projectTypeDetected) {
            if (nodeFiles.includes(file)) projectTypeDetected = "node"
            else if (pythonFiles.includes(file)) projectTypeDetected = "python"
            else if (rustFiles.includes(file)) projectTypeDetected = "rust"
            else if (flutterFiles.includes(file)) projectTypeDetected = "flutter"
            else if (htmlFiles.includes(file)) projectTypeDetected = "html"
            else if (phpFiles.includes(file)) projectTypeDetected = "php"
          }
        }
      }
    }
  }

  return {
    hasFiles: foundFiles.length > 0,
    checkedFiles,
    foundFiles,
    projectTypeDetected
  }
}

async function getFileModTime(filePath: string): Promise<number | null> {
  try {
    const stat = await fs.stat(filePath)
    return stat.mtimeMs
  } catch {
    return null
  }
}

/**
 * Detect which package manager to use for Node.js projects
 */
async function detectNodePackageManager(repoPath: string): Promise<{
  manager: "npm" | "yarn" | "pnpm"
  lockFile: string
  installCmd: string
}> {
  // Check for lock files in priority order
  if (await fileExists(path.join(repoPath, "pnpm-lock.yaml"))) {
    return { manager: "pnpm", lockFile: "pnpm-lock.yaml", installCmd: "pnpm install" }
  }
  if (await fileExists(path.join(repoPath, "yarn.lock"))) {
    return { manager: "yarn", lockFile: "yarn.lock", installCmd: "yarn install" }
  }
  // Default to npm
  return { manager: "npm", lockFile: "package-lock.json", installCmd: "npm install" }
}

/**
 * Check if Node.js dependencies need to be installed
 */
async function checkNodeDependencies(repoPath: string): Promise<DependencyCheck> {
  const packageJsonPath = path.join(repoPath, "package.json")
  const nodeModulesPath = path.join(repoPath, "node_modules")

  // Check if package.json exists
  if (!(await fileExists(packageJsonPath))) {
    return { needsInstall: false, reason: "No package.json found" }
  }

  const pkgManager = await detectNodePackageManager(repoPath)

  // Check if node_modules exists
  if (!(await fileExists(nodeModulesPath))) {
    return {
      needsInstall: true,
      reason: "node_modules directory does not exist",
      packageManager: pkgManager.manager,
      installCommand: pkgManager.installCmd
    }
  }

  // Check if lock file is newer than node_modules
  const lockFilePath = path.join(repoPath, pkgManager.lockFile)
  const lockFileMtime = await getFileModTime(lockFilePath)
  const nodeModulesMtime = await getFileModTime(nodeModulesPath)

  if (lockFileMtime && nodeModulesMtime && lockFileMtime > nodeModulesMtime) {
    return {
      needsInstall: true,
      reason: `${pkgManager.lockFile} is newer than node_modules`,
      packageManager: pkgManager.manager,
      installCommand: pkgManager.installCmd
    }
  }

  // Check if package.json is newer than node_modules
  const packageJsonMtime = await getFileModTime(packageJsonPath)
  if (packageJsonMtime && nodeModulesMtime && packageJsonMtime > nodeModulesMtime) {
    return {
      needsInstall: true,
      reason: "package.json is newer than node_modules",
      packageManager: pkgManager.manager,
      installCommand: pkgManager.installCmd
    }
  }

  return { needsInstall: false, packageManager: pkgManager.manager }
}

/**
 * Check if Python dependencies need to be installed
 */
async function checkPythonDependencies(repoPath: string): Promise<DependencyCheck> {
  const requirementsPath = path.join(repoPath, "requirements.txt")
  const pyprojectPath = path.join(repoPath, "pyproject.toml")

  // Check for requirements.txt
  if (await fileExists(requirementsPath)) {
    // For Python, we generally want to install/update dependencies before each run
    // since we can't easily tell if they're installed in the current environment
    return {
      needsInstall: true,
      reason: "Python dependencies from requirements.txt",
      packageManager: "pip",
      installCommand: "pip install -r requirements.txt"
    }
  }

  // Check for pyproject.toml (poetry/pipenv)
  if (await fileExists(pyprojectPath)) {
    const content = await fs.readFile(pyprojectPath, "utf-8")

    // Check if it's a poetry project
    if (content.includes("[tool.poetry]")) {
      return {
        needsInstall: true,
        reason: "Python dependencies from pyproject.toml (Poetry)",
        packageManager: "poetry",
        installCommand: "poetry install"
      }
    }

    return {
      needsInstall: true,
      reason: "Python dependencies from pyproject.toml",
      packageManager: "pip",
      installCommand: "pip install -e ."
    }
  }

  return { needsInstall: false }
}

/**
 * Check if Rust dependencies need to be built
 */
async function checkRustDependencies(repoPath: string): Promise<DependencyCheck> {
  const cargoTomlPath = path.join(repoPath, "Cargo.toml")
  const targetPath = path.join(repoPath, "target")

  if (!(await fileExists(cargoTomlPath))) {
    return { needsInstall: false }
  }

  // Check if target directory exists
  if (!(await fileExists(targetPath))) {
    return {
      needsInstall: true,
      reason: "Rust target directory does not exist",
      packageManager: "cargo",
      installCommand: "cargo build"
    }
  }

  // Check if Cargo.toml or Cargo.lock is newer than target
  const cargoTomlMtime = await getFileModTime(cargoTomlPath)
  const cargoLockMtime = await getFileModTime(path.join(repoPath, "Cargo.lock"))
  const targetMtime = await getFileModTime(targetPath)

  const newestSrc = Math.max(cargoTomlMtime || 0, cargoLockMtime || 0)

  if (targetMtime && newestSrc > targetMtime) {
    return {
      needsInstall: true,
      reason: "Cargo.toml or Cargo.lock is newer than target",
      packageManager: "cargo",
      installCommand: "cargo build"
    }
  }

  return { needsInstall: false, packageManager: "cargo" }
}

/**
 * Check if Flutter dependencies need to be installed
 */
async function checkFlutterDependencies(repoPath: string): Promise<DependencyCheck> {
  const pubspecPath = path.join(repoPath, "pubspec.yaml")
  const pubspecLockPath = path.join(repoPath, "pubspec.lock")
  const dartToolPath = path.join(repoPath, ".dart_tool")

  if (!(await fileExists(pubspecPath))) {
    return { needsInstall: false }
  }

  // Check if .dart_tool directory exists (indicates flutter pub get has run)
  if (!(await fileExists(dartToolPath))) {
    return {
      needsInstall: true,
      reason: ".dart_tool directory does not exist",
      packageManager: "flutter",
      installCommand: "flutter pub get"
    }
  }

  // Check if pubspec.yaml is newer than pubspec.lock
  const pubspecMtime = await getFileModTime(pubspecPath)
  const pubspecLockMtime = await getFileModTime(pubspecLockPath)

  if (pubspecMtime && pubspecLockMtime && pubspecMtime > pubspecLockMtime) {
    return {
      needsInstall: true,
      reason: "pubspec.yaml is newer than pubspec.lock",
      packageManager: "flutter",
      installCommand: "flutter pub get"
    }
  }

  return { needsInstall: false, packageManager: "flutter" }
}

/**
 * Main dependency check function
 */
async function checkDependencies(
  repoPath: string,
  projectType: string
): Promise<DependencyCheck> {
  console.log(`[install-deps] Checking dependencies for ${projectType} in ${repoPath}`)

  switch (projectType) {
    case "nextjs":
    case "react":
    case "vue":
    case "svelte":
    case "nuxt":
    case "node":
      return checkNodeDependencies(repoPath)

    case "python":
    case "django":
    case "fastapi":
    case "flask":
      return checkPythonDependencies(repoPath)

    case "rust":
      return checkRustDependencies(repoPath)

    case "flutter":
      return checkFlutterDependencies(repoPath)

    case "html":
      // Static HTML projects don't need dependencies
      return { needsInstall: false, reason: "Static HTML project - no dependencies needed" }

    case "php":
      // Check for composer.json for PHP projects
      if (await fileExists(path.join(repoPath, "composer.json"))) {
        const vendorPath = path.join(repoPath, "vendor")
        if (!(await fileExists(vendorPath))) {
          return {
            needsInstall: true,
            reason: "vendor directory does not exist",
            packageManager: "composer",
            installCommand: "composer install"
          }
        }
      }
      return { needsInstall: false, packageManager: "composer" }

    default:
      // Unknown project type - check for common patterns
      if (await fileExists(path.join(repoPath, "package.json"))) {
        return checkNodeDependencies(repoPath)
      }
      if (await fileExists(path.join(repoPath, "requirements.txt"))) {
        return checkPythonDependencies(repoPath)
      }
      if (await fileExists(path.join(repoPath, "Cargo.toml"))) {
        return checkRustDependencies(repoPath)
      }
      if (await fileExists(path.join(repoPath, "pubspec.yaml"))) {
        return checkFlutterDependencies(repoPath)
      }
      return { needsInstall: false }
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { projectType, forceInstall } = body
  const repoPath = body.repoPath ? expandPath(body.repoPath) : null

  if (!repoPath) {
    return NextResponse.json(
      { error: "repoPath is required" },
      { status: 400 }
    )
  }

  try {
    // Check if directory exists
    if (!(await fileExists(repoPath))) {
      return NextResponse.json({
        success: false,
        error: `Directory does not exist: ${repoPath}`
      })
    }

    // Check if project has actual code files before attempting to install dependencies
    const projectFilesCheck = await checkProjectFiles(repoPath, projectType)
    if (!projectFilesCheck.hasFiles) {
      console.log(`[install-deps] No project files found in: ${repoPath}`)
      console.log(`[install-deps] Checked for: ${projectFilesCheck.checkedFiles.join(", ")}`)

      // Determine what files were expected based on project type
      let expectedFiles = "package.json, requirements.txt, Cargo.toml, or pubspec.yaml"
      if (projectType) {
        if (["nextjs", "react", "vue", "svelte", "nuxt", "node"].includes(projectType)) {
          expectedFiles = "package.json"
        } else if (["python", "django", "fastapi", "flask"].includes(projectType)) {
          expectedFiles = "main.py, app.py, or requirements.txt"
        } else if (projectType === "rust") {
          expectedFiles = "Cargo.toml"
        } else if (projectType === "flutter") {
          expectedFiles = "pubspec.yaml"
        } else if (projectType === "html") {
          expectedFiles = "index.html (in public/, root, or dist/)"
        } else if (projectType === "php") {
          expectedFiles = "public/index.php, index.php, or composer.json"
        }
      }

      return NextResponse.json({
        success: false,
        error: "No project files found. Generate code first or check the project folder.",
        noProjectFiles: true,
        checkedFiles: projectFilesCheck.checkedFiles,
        expectedFiles,
        suggestion: "Use 'Generate Code' to create project files, or verify the working directory contains your code.",
        details: `Looked for ${expectedFiles} in ${repoPath}`
      })
    }

    console.log(`[install-deps] Project files found: ${projectFilesCheck.foundFiles.join(", ")}`)

    // Check if dependencies need to be installed
    const check = await checkDependencies(repoPath, projectType || "")

    if (!check.needsInstall && !forceInstall) {
      console.log(`[install-deps] Dependencies are up to date`)
      return NextResponse.json({
        success: true,
        installed: false,
        message: "Dependencies are up to date",
        packageManager: check.packageManager
      })
    }

    // Install dependencies
    const installCommand = check.installCommand || "npm install"
    console.log(`[install-deps] Installing: ${installCommand}`)
    console.log(`[install-deps] Reason: ${check.reason}`)

    const startTime = Date.now()

    try {
      const { stdout, stderr } = await execAsync(installCommand, {
        cwd: repoPath,
        timeout: 600000, // 10 minutes max
        maxBuffer: 50 * 1024 * 1024, // 50MB
        env: {
          ...process.env,
          CI: "true", // Prevents interactive prompts
          FORCE_COLOR: "0" // Cleaner output
        }
      })

      const duration = Date.now() - startTime
      console.log(`[install-deps] Installation completed in ${duration}ms`)

      return NextResponse.json({
        success: true,
        installed: true,
        message: `Dependencies installed successfully`,
        reason: check.reason,
        packageManager: check.packageManager,
        command: installCommand,
        duration,
        output: stdout.substring(0, 5000), // Truncate long output
        warnings: stderr ? stderr.substring(0, 2000) : undefined
      })

    } catch (installError) {
      const execError = installError as { stdout?: string; stderr?: string; message?: string }
      console.error(`[install-deps] Installation failed:`, execError.message)

      return NextResponse.json({
        success: false,
        error: `Installation failed: ${execError.message}`,
        command: installCommand,
        output: execError.stdout?.substring(0, 5000),
        stderr: execError.stderr?.substring(0, 2000)
      })
    }

  } catch (error) {
    console.error("[install-deps] Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to check/install dependencies"
    })
  }
}

/**
 * GET: Check if dependencies need to be installed (without installing)
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const rawRepoPath = url.searchParams.get("repoPath")
  const projectType = url.searchParams.get("projectType") || ""
  const repoPath = rawRepoPath ? expandPath(rawRepoPath) : null

  if (!repoPath) {
    return NextResponse.json(
      { error: "repoPath query param is required" },
      { status: 400 }
    )
  }

  try {
    if (!(await fileExists(repoPath))) {
      return NextResponse.json({
        needsInstall: false,
        error: `Directory does not exist: ${repoPath}`
      })
    }

    // Check if project has actual code files
    const projectFilesCheck = await checkProjectFiles(repoPath, projectType)
    if (!projectFilesCheck.hasFiles) {
      // Determine what files were expected based on project type
      let expectedFiles = "package.json, requirements.txt, Cargo.toml, or pubspec.yaml"
      if (projectType) {
        if (["nextjs", "react", "vue", "svelte", "nuxt", "node"].includes(projectType)) {
          expectedFiles = "package.json"
        } else if (["python", "django", "fastapi", "flask"].includes(projectType)) {
          expectedFiles = "main.py, app.py, or requirements.txt"
        } else if (projectType === "rust") {
          expectedFiles = "Cargo.toml"
        } else if (projectType === "flutter") {
          expectedFiles = "pubspec.yaml"
        } else if (projectType === "html") {
          expectedFiles = "index.html (in public/, root, or dist/)"
        } else if (projectType === "php") {
          expectedFiles = "public/index.php, index.php, or composer.json"
        }
      }

      return NextResponse.json({
        needsInstall: false,
        noProjectFiles: true,
        error: "No project files found. Generate code first or check the project folder.",
        checkedFiles: projectFilesCheck.checkedFiles,
        expectedFiles,
        suggestion: "Use 'Generate Code' to create project files, or verify the working directory contains your code."
      })
    }

    const check = await checkDependencies(repoPath, projectType)

    return NextResponse.json({
      needsInstall: check.needsInstall,
      reason: check.reason,
      packageManager: check.packageManager,
      installCommand: check.installCommand
    })

  } catch (error) {
    console.error("[install-deps] Check error:", error)
    return NextResponse.json({
      needsInstall: false,
      error: error instanceof Error ? error.message : "Failed to check dependencies"
    })
  }
}
