/**
 * Start Application API
 * POST /api/launch-test/start
 *
 * Launches a development server for the project in the specified directory.
 * Validates ports against reserved ports (e.g., port 3000 for Claudia).
 * Automatically installs dependencies if needed before launching.
 */

import { NextRequest, NextResponse } from "next/server"
import { spawn, ChildProcess, exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { validatePort, getSuggestedPorts } from "@/lib/execution/port-config"

const execAsync = promisify(exec)

/**
 * Runtime requirements for each project type
 */
const RUNTIME_REQUIREMENTS: Record<string, { command: string; name: string; installHint: string }> = {
  php: {
    command: "php",
    name: "PHP",
    installHint: "Install PHP: sudo apt install php (Ubuntu/Debian) or brew install php (macOS)"
  },
  python: {
    command: "python3",
    name: "Python 3",
    installHint: "Install Python: sudo apt install python3 (Ubuntu/Debian) or brew install python (macOS)"
  },
  django: {
    command: "python3",
    name: "Python 3",
    installHint: "Install Python: sudo apt install python3 (Ubuntu/Debian) or brew install python (macOS)"
  },
  fastapi: {
    command: "python3",
    name: "Python 3",
    installHint: "Install Python: sudo apt install python3 (Ubuntu/Debian) or brew install python (macOS)"
  },
  flask: {
    command: "python3",
    name: "Python 3",
    installHint: "Install Python: sudo apt install python3 (Ubuntu/Debian) or brew install python (macOS)"
  },
  rust: {
    command: "cargo",
    name: "Rust/Cargo",
    installHint: "Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  },
  flutter: {
    command: "flutter",
    name: "Flutter",
    installHint: "Install Flutter: https://docs.flutter.dev/get-started/install"
  }
}

/**
 * Check if a runtime is available
 */
async function checkRuntime(projectType: string): Promise<{ available: boolean; name?: string; installHint?: string }> {
  const requirement = RUNTIME_REQUIREMENTS[projectType]
  if (!requirement) {
    // Node.js based projects - check for node
    if (["nextjs", "react", "vue", "svelte", "nuxt", "node", "html"].includes(projectType)) {
      try {
        await execAsync("which node", { timeout: 5000 })
        return { available: true }
      } catch {
        return {
          available: false,
          name: "Node.js",
          installHint: "Install Node.js: https://nodejs.org/ or use nvm"
        }
      }
    }
    return { available: true } // Unknown type, assume available
  }

  try {
    await execAsync(`which ${requirement.command}`, { timeout: 5000 })
    return { available: true }
  } catch {
    return {
      available: false,
      name: requirement.name,
      installHint: requirement.installHint
    }
  }
}

/**
 * Expand ~ to the user's home directory
 */
function expandPath(p: string): string {
  if (!p) return p
  return p.replace(/^~/, os.homedir())
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

/**
 * List directories in the parent folder for debugging
 */
async function listParentDirectoryContents(dirPath: string): Promise<string[]> {
  try {
    const parentDir = path.dirname(dirPath)
    const parentExists = await directoryExists(parentDir)
    if (!parentExists) {
      return []
    }
    const entries = await fs.readdir(parentDir, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
  } catch {
    return []
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
  // Static HTML project files (check public/ folder first for security)
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
  if (await fileExists(path.join(repoPath, "pnpm-lock.yaml"))) {
    return { manager: "pnpm", lockFile: "pnpm-lock.yaml", installCmd: "pnpm install" }
  }
  if (await fileExists(path.join(repoPath, "yarn.lock"))) {
    return { manager: "yarn", lockFile: "yarn.lock", installCmd: "yarn install" }
  }
  return { manager: "npm", lockFile: "package-lock.json", installCmd: "npm install" }
}

interface DependencyCheckResult {
  needsInstall: boolean
  reason?: string
  installCommand?: string
  packageManager?: string
}

/**
 * Check if dependencies need to be installed based on project type
 */
async function checkDependencies(
  repoPath: string,
  projectType: string
): Promise<DependencyCheckResult> {
  // Node.js based projects
  if (["nextjs", "react", "vue", "svelte", "nuxt", "node"].includes(projectType)) {
    const packageJsonPath = path.join(repoPath, "package.json")
    const nodeModulesPath = path.join(repoPath, "node_modules")

    if (!(await fileExists(packageJsonPath))) {
      return { needsInstall: false }
    }

    const pkgManager = await detectNodePackageManager(repoPath)

    // Check if node_modules exists
    if (!(await fileExists(nodeModulesPath))) {
      return {
        needsInstall: true,
        reason: "node_modules not found",
        installCommand: pkgManager.installCmd,
        packageManager: pkgManager.manager
      }
    }

    // Check if lock file is newer than node_modules
    const lockFilePath = path.join(repoPath, pkgManager.lockFile)
    const lockFileMtime = await getFileModTime(lockFilePath)
    const nodeModulesMtime = await getFileModTime(nodeModulesPath)
    const packageJsonMtime = await getFileModTime(packageJsonPath)

    if (lockFileMtime && nodeModulesMtime && lockFileMtime > nodeModulesMtime) {
      return {
        needsInstall: true,
        reason: `${pkgManager.lockFile} updated`,
        installCommand: pkgManager.installCmd,
        packageManager: pkgManager.manager
      }
    }

    if (packageJsonMtime && nodeModulesMtime && packageJsonMtime > nodeModulesMtime) {
      return {
        needsInstall: true,
        reason: "package.json updated",
        installCommand: pkgManager.installCmd,
        packageManager: pkgManager.manager
      }
    }

    return { needsInstall: false, packageManager: pkgManager.manager }
  }

  // Python projects
  if (["python", "django", "fastapi", "flask"].includes(projectType)) {
    const requirementsPath = path.join(repoPath, "requirements.txt")
    const pyprojectPath = path.join(repoPath, "pyproject.toml")

    if (await fileExists(requirementsPath)) {
      return {
        needsInstall: true,
        reason: "Python dependencies",
        installCommand: "pip install -r requirements.txt",
        packageManager: "pip"
      }
    }

    if (await fileExists(pyprojectPath)) {
      const content = await fs.readFile(pyprojectPath, "utf-8")
      if (content.includes("[tool.poetry]")) {
        return {
          needsInstall: true,
          reason: "Poetry dependencies",
          installCommand: "poetry install",
          packageManager: "poetry"
        }
      }
      return {
        needsInstall: true,
        reason: "Python dependencies",
        installCommand: "pip install -e .",
        packageManager: "pip"
      }
    }

    return { needsInstall: false }
  }

  // Rust projects
  if (projectType === "rust") {
    const cargoTomlPath = path.join(repoPath, "Cargo.toml")
    const targetPath = path.join(repoPath, "target")

    if (!(await fileExists(cargoTomlPath))) {
      return { needsInstall: false }
    }

    if (!(await fileExists(targetPath))) {
      return {
        needsInstall: true,
        reason: "Rust target not built",
        installCommand: "cargo build",
        packageManager: "cargo"
      }
    }

    // Check if Cargo.toml is newer than target
    const cargoTomlMtime = await getFileModTime(cargoTomlPath)
    const targetMtime = await getFileModTime(targetPath)

    if (cargoTomlMtime && targetMtime && cargoTomlMtime > targetMtime) {
      return {
        needsInstall: true,
        reason: "Cargo.toml updated",
        installCommand: "cargo build",
        packageManager: "cargo"
      }
    }

    return { needsInstall: false, packageManager: "cargo" }
  }

  // Flutter projects
  if (projectType === "flutter") {
    const pubspecPath = path.join(repoPath, "pubspec.yaml")
    const dartToolPath = path.join(repoPath, ".dart_tool")
    const pubspecLockPath = path.join(repoPath, "pubspec.lock")

    if (!(await fileExists(pubspecPath))) {
      return { needsInstall: false }
    }

    if (!(await fileExists(dartToolPath))) {
      return {
        needsInstall: true,
        reason: "Flutter packages not fetched",
        installCommand: "flutter pub get",
        packageManager: "flutter"
      }
    }

    // Check if pubspec.yaml is newer than pubspec.lock
    const pubspecMtime = await getFileModTime(pubspecPath)
    const pubspecLockMtime = await getFileModTime(pubspecLockPath)

    if (pubspecMtime && pubspecLockMtime && pubspecMtime > pubspecLockMtime) {
      return {
        needsInstall: true,
        reason: "pubspec.yaml updated",
        installCommand: "flutter pub get",
        packageManager: "flutter"
      }
    }

    return { needsInstall: false, packageManager: "flutter" }
  }

  return { needsInstall: false }
}

/**
 * Install dependencies for the project
 */
async function installDependencies(
  repoPath: string,
  installCommand: string,
  timeoutMs: number = 300000
): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    console.log(`[Launch] Installing dependencies: ${installCommand}`)
    const { stdout, stderr } = await execAsync(installCommand, {
      cwd: repoPath,
      timeout: timeoutMs,
      maxBuffer: 50 * 1024 * 1024,
      env: {
        ...process.env,
        CI: "true",
        FORCE_COLOR: "0"
      }
    })

    console.log(`[Launch] Dependencies installed successfully`)
    if (stderr && stderr.trim()) {
      console.log(`[Launch] Install warnings: ${stderr.substring(0, 500)}`)
    }

    return { success: true, output: stdout }
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string }
    console.error(`[Launch] Dependency installation failed:`, execError.message)
    return {
      success: false,
      error: execError.message || "Installation failed",
      output: execError.stderr || execError.stdout
    }
  }
}

// Store running processes globally
declare global {
   
  var launchTestProcesses: Map<string, {
    process: ChildProcess
    projectId: string
    port: number
    startedAt: Date
  }>
}

if (!global.launchTestProcesses) {
  global.launchTestProcesses = new Map()
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { projectId, projectType, command, port } = body
  // Expand ~ to home directory for the repoPath
  const repoPath = body.repoPath ? expandPath(body.repoPath) : null

  if (!projectId || !repoPath || !command || !port) {
    return NextResponse.json(
      { error: "Missing required fields: projectId, repoPath, command, port" },
      { status: 400 }
    )
  }

  try {
    // Validate the directory exists BEFORE doing anything else
    const dirExists = await directoryExists(repoPath)
    if (!dirExists) {
      console.log(`[Launch] Directory does not exist: ${repoPath}`)

      // List folders in parent directory to help debug
      const parentDir = path.dirname(repoPath)
      const availableFolders = await listParentDirectoryContents(repoPath)
      const parentExists = await directoryExists(parentDir)

      let debugInfo = ""
      if (!parentExists) {
        debugInfo = `Parent directory also does not exist: ${parentDir}`
      } else if (availableFolders.length === 0) {
        debugInfo = `Parent directory exists but contains no subdirectories: ${parentDir}`
      } else {
        debugInfo = `Available folders in ${parentDir}: ${availableFolders.join(", ")}`
      }

      console.log(`[Launch] Debug: ${debugInfo}`)

      return NextResponse.json({
        success: false,
        error: `Project folder not found at: ${repoPath}`,
        parentDirectory: parentDir,
        parentExists,
        availableFolders,
        debugInfo,
        suggestion: "Check that the working directory path is correct in project settings"
      })
    }

    console.log(`[Launch] Directory validated: ${repoPath}`)

    // Check if project has actual code files before attempting to launch
    const projectFilesCheck = await checkProjectFiles(repoPath, projectType)
    if (!projectFilesCheck.hasFiles) {
      console.log(`[Launch] No project files found in: ${repoPath}`)
      console.log(`[Launch] Checked for: ${projectFilesCheck.checkedFiles.join(", ")}`)

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

    console.log(`[Launch] Project files found: ${projectFilesCheck.foundFiles.join(", ")}`)

    // Check if required runtime is available
    if (projectType) {
      const runtimeCheck = await checkRuntime(projectType)
      if (!runtimeCheck.available) {
        console.log(`[Launch] Runtime not found: ${runtimeCheck.name}`)
        return NextResponse.json({
          success: false,
          error: `${runtimeCheck.name} is not installed or not in PATH`,
          runtimeMissing: true,
          runtime: runtimeCheck.name,
          installHint: runtimeCheck.installHint,
          suggestion: runtimeCheck.installHint
        })
      }
      console.log(`[Launch] Runtime check passed for ${projectType}`)
    }

    // Check if already running for this project
    const entries = Array.from(global.launchTestProcesses.entries())
    for (const [processId, info] of entries) {
      if (info.projectId === projectId) {
        return NextResponse.json({
          success: true,
          processId,
          url: `http://localhost:${info.port}`,
          message: "App already running"
        })
      }
    }

    // Check if port is reserved by Claudia or other services
    const portValidation = validatePort(port)
    if (!portValidation.valid) {
      console.log(`[Launch] Port ${port} is reserved: ${portValidation.error}`)
      return NextResponse.json({
        success: false,
        error: portValidation.error,
        isReserved: true,
        suggestedPorts: portValidation.suggestedPorts || getSuggestedPorts(port)
      })
    }

    // Check if port is in use by another process
    try {
      await execAsync(`lsof -i :${port}`, { timeout: 5000 })
      return NextResponse.json({
        success: false,
        error: `Port ${port} is already in use by another process`,
        isInUse: true,
        suggestedPorts: getSuggestedPorts(port)
      })
    } catch {
      // Port is free, continue
    }

    // Generate process ID
    const processId = `launch-${projectId}-${Date.now()}`

    // Check and install dependencies if needed (before launching)
    const skipDependencyCheck = body.skipDependencyCheck === true
    if (!skipDependencyCheck && projectType) {
      console.log(`[Launch] Checking dependencies for ${projectType}...`)

      const depCheck = await checkDependencies(repoPath, projectType)

      if (depCheck.needsInstall && depCheck.installCommand) {
        console.log(`[Launch] Dependencies need to be installed: ${depCheck.reason}`)

        const installResult = await installDependencies(repoPath, depCheck.installCommand)

        if (!installResult.success) {
          console.error(`[Launch] Dependency installation failed`)
          return NextResponse.json({
            success: false,
            error: `Dependency installation failed: ${installResult.error}`,
            installOutput: installResult.output,
            phase: "installing",
            packageManager: depCheck.packageManager
          })
        }

        console.log(`[Launch] Dependencies installed, proceeding with launch`)
      } else {
        console.log(`[Launch] Dependencies are up to date`)
      }
    }

    // Determine the actual command based on project type
    let finalCommand = command

    // For Flutter web, ensure we use a specific port
    if (projectType === "flutter") {
      finalCommand = `flutter run -d chrome --web-port=${port}`
    }

    console.log(`[Launch] Starting: ${finalCommand} in ${repoPath}`)

    // Start the process
    const childProcess = spawn("bash", ["-c", finalCommand], {
      cwd: repoPath,
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: "development",
        BROWSER: "none" // Prevent auto-opening browser
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true
    })

    // Collect output for debugging
    let stdout = ""
    let stderr = ""

    childProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString()
      stdout += output
      console.log(`[Launch ${processId}] stdout:`, output.substring(0, 200))
    })

    childProcess.stderr?.on("data", (data: Buffer) => {
      const output = data.toString()
      stderr += output
      console.log(`[Launch ${processId}] stderr:`, output.substring(0, 200))
    })

    // Store process reference
    global.launchTestProcesses.set(processId, {
      process: childProcess,
      projectId,
      port,
      startedAt: new Date()
    })

    // Handle process exit
    childProcess.on("exit", (code) => {
      console.log(`[Launch ${processId}] Process exited with code ${code}`)
      global.launchTestProcesses.delete(processId)
    })

    childProcess.on("error", (err) => {
      console.error(`[Launch ${processId}] Process error:`, err)
      global.launchTestProcesses.delete(processId)
    })

    // Don't wait for the process - it's a long-running dev server
    // Just give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Check if process is still running
    if (!childProcess.pid || childProcess.exitCode !== null) {
      global.launchTestProcesses.delete(processId)
      return NextResponse.json({
        success: false,
        error: `Process failed to start: ${stderr || "Unknown error"}`,
        stdout,
        stderr
      })
    }

    // Unref so the process continues after API response
    childProcess.unref()

    return NextResponse.json({
      success: true,
      processId,
      url: `http://localhost:${port}`,
      pid: childProcess.pid
    })

  } catch (error) {
    console.error("[Launch] Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to start app"
    })
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get("projectId")

  if (projectId) {
    const entries = Array.from(global.launchTestProcesses.entries())
    for (const [processId, info] of entries) {
      if (info.projectId === projectId) {
        return NextResponse.json({
          running: true,
          processId,
          port: info.port,
          startedAt: info.startedAt
        })
      }
    }
    return NextResponse.json({ running: false })
  }

  const processes = Array.from(global.launchTestProcesses.entries()).map(([id, info]) => ({
    processId: id,
    projectId: info.projectId,
    port: info.port,
    startedAt: info.startedAt
  }))

  return NextResponse.json({ processes })
}
