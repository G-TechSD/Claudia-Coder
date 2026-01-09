/**
 * MCP Server Dependency Checker
 *
 * Checks if required tools (node, npm, npx, python, pip, uv, etc.) are installed
 * on the system for running MCP servers.
 */

import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

// Dependency information
export interface DependencyInfo {
  name: string
  command: string
  versionCommand: string
  description: string
  required: boolean
  installUrl: string
  installInstructions: string
  category: "nodejs" | "python" | "other"
}

// Dependency status result
export interface DependencyStatus {
  name: string
  installed: boolean
  version?: string
  path?: string
  description: string
  installUrl: string
  installInstructions: string
  category: "nodejs" | "python" | "other"
  required: boolean
  error?: string
}

// Full dependency check result
export interface DependencyCheckResult {
  dependencies: DependencyStatus[]
  allRequiredInstalled: boolean
  nodeAvailable: boolean
  pythonAvailable: boolean
  timestamp: string
}

// Define all dependencies to check
export const MCP_DEPENDENCIES: DependencyInfo[] = [
  // Node.js ecosystem
  {
    name: "Node.js",
    command: "node",
    versionCommand: "node --version",
    description: "JavaScript runtime required for npx-based MCP servers",
    required: true,
    installUrl: "https://nodejs.org/",
    installInstructions: "Download and install from nodejs.org, or use your package manager:\n- macOS: brew install node\n- Ubuntu/Debian: sudo apt install nodejs\n- Windows: Download installer from nodejs.org",
    category: "nodejs"
  },
  {
    name: "npm",
    command: "npm",
    versionCommand: "npm --version",
    description: "Node package manager, installed with Node.js",
    required: true,
    installUrl: "https://nodejs.org/",
    installInstructions: "npm comes bundled with Node.js. Install Node.js to get npm.",
    category: "nodejs"
  },
  {
    name: "npx",
    command: "npx",
    versionCommand: "npx --version",
    description: "Node package executor for running MCP servers directly",
    required: true,
    installUrl: "https://nodejs.org/",
    installInstructions: "npx comes bundled with npm (and Node.js). Install Node.js to get npx.",
    category: "nodejs"
  },

  // Python ecosystem
  {
    name: "Python",
    command: "python3",
    versionCommand: "python3 --version",
    description: "Required for Python-based and uvx MCP servers",
    required: false,
    installUrl: "https://www.python.org/downloads/",
    installInstructions: "Download from python.org, or use your package manager:\n- macOS: brew install python3\n- Ubuntu/Debian: sudo apt install python3\n- Windows: Download installer from python.org",
    category: "python"
  },
  {
    name: "pip",
    command: "pip3",
    versionCommand: "pip3 --version",
    description: "Python package installer",
    required: false,
    installUrl: "https://pip.pypa.io/en/stable/installation/",
    installInstructions: "pip usually comes with Python. If not:\n- python3 -m ensurepip --upgrade\n- Or: curl https://bootstrap.pypa.io/get-pip.py | python3",
    category: "python"
  },
  {
    name: "uv",
    command: "uv",
    versionCommand: "uv --version",
    description: "Fast Python package installer, required for uvx MCP servers",
    required: false,
    installUrl: "https://docs.astral.sh/uv/",
    installInstructions: "Install uv:\n- macOS/Linux: curl -LsSf https://astral.sh/uv/install.sh | sh\n- Windows: powershell -c \"irm https://astral.sh/uv/install.ps1 | iex\"\n- Or with pip: pip install uv",
    category: "python"
  },
  {
    name: "uvx",
    command: "uvx",
    versionCommand: "uvx --version",
    description: "UV package executor for running Python MCP servers",
    required: false,
    installUrl: "https://docs.astral.sh/uv/",
    installInstructions: "uvx comes with uv. Install uv to get uvx.",
    category: "python"
  },

  // Other common tools
  {
    name: "Git",
    command: "git",
    versionCommand: "git --version",
    description: "Version control system, required for some MCP servers",
    required: false,
    installUrl: "https://git-scm.com/downloads",
    installInstructions: "Download from git-scm.com, or use your package manager:\n- macOS: brew install git\n- Ubuntu/Debian: sudo apt install git\n- Windows: Download installer from git-scm.com",
    category: "other"
  },
  {
    name: "Docker",
    command: "docker",
    versionCommand: "docker --version",
    description: "Container runtime for Docker-based MCP servers",
    required: false,
    installUrl: "https://www.docker.com/products/docker-desktop/",
    installInstructions: "Install Docker Desktop from docker.com, or:\n- macOS: brew install --cask docker\n- Ubuntu: sudo apt install docker.io\n- Windows: Download Docker Desktop installer",
    category: "other"
  }
]

/**
 * Check if a single command is available
 */
async function checkCommand(command: string): Promise<{ available: boolean; path?: string; error?: string }> {
  try {
    // Use 'which' on Unix-like systems, 'where' on Windows
    const isWindows = process.platform === "win32"
    const whichCommand = isWindows ? "where" : "which"

    const { stdout } = await execAsync(`${whichCommand} ${command}`)
    return {
      available: true,
      path: stdout.trim().split("\n")[0] // Take first result if multiple
    }
  } catch {
    return {
      available: false,
      error: `${command} not found in PATH`
    }
  }
}

/**
 * Get version of a command
 */
async function getVersion(versionCommand: string): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await execAsync(versionCommand)
    // Some tools output version to stderr
    const output = stdout.trim() || stderr.trim()
    // Extract version number (handles formats like "v18.0.0", "Python 3.11.0", "npm 9.0.0")
    const versionMatch = output.match(/v?(\d+\.\d+\.?\d*)/i)
    return versionMatch ? versionMatch[0] : output.split("\n")[0]
  } catch {
    return undefined
  }
}

/**
 * Check a single dependency
 */
export async function checkDependency(dep: DependencyInfo): Promise<DependencyStatus> {
  const cmdCheck = await checkCommand(dep.command)

  let version: string | undefined
  if (cmdCheck.available) {
    version = await getVersion(dep.versionCommand)
  }

  return {
    name: dep.name,
    installed: cmdCheck.available,
    version,
    path: cmdCheck.path,
    description: dep.description,
    installUrl: dep.installUrl,
    installInstructions: dep.installInstructions,
    category: dep.category,
    required: dep.required,
    error: cmdCheck.error
  }
}

/**
 * Check all MCP dependencies
 */
export async function checkAllDependencies(): Promise<DependencyCheckResult> {
  const results = await Promise.all(
    MCP_DEPENDENCIES.map(dep => checkDependency(dep))
  )

  // Check if all required dependencies are installed
  const allRequiredInstalled = results
    .filter(d => d.required)
    .every(d => d.installed)

  // Check if Node.js ecosystem is available
  const nodeAvailable = results
    .filter(d => d.category === "nodejs" && d.required)
    .every(d => d.installed)

  // Check if Python ecosystem is available (uv specifically)
  const pythonAvailable = results
    .filter(d => d.name === "Python" || d.name === "uv")
    .every(d => d.installed)

  return {
    dependencies: results,
    allRequiredInstalled,
    nodeAvailable,
    pythonAvailable,
    timestamp: new Date().toISOString()
  }
}

/**
 * Determine what dependencies are needed for a specific MCP server command
 */
export type RequiredRuntime = "nodejs" | "python" | "docker" | "unknown"

export interface ServerRequirements {
  runtime: RequiredRuntime
  dependencies: string[]
  missing: string[]
  canRun: boolean
}

/**
 * Analyze an MCP server command to determine its requirements
 */
export function analyzeServerCommand(command: string, args: string[] = []): RequiredRuntime {
  const fullCommand = `${command} ${args.join(" ")}`.toLowerCase()

  // Check for npx-based servers
  if (command === "npx" || command === "node" || command === "npm") {
    return "nodejs"
  }

  // Check for uvx/uv-based servers
  if (command === "uvx" || command === "uv" || command === "python" || command === "python3" || command === "pip" || command === "pip3") {
    return "python"
  }

  // Check for docker-based servers
  if (command === "docker" || fullCommand.includes("docker")) {
    return "docker"
  }

  // Check args for hints
  if (args.some(arg => arg.includes("npx") || arg.includes("node"))) {
    return "nodejs"
  }

  if (args.some(arg => arg.includes("uvx") || arg.includes("python"))) {
    return "python"
  }

  return "unknown"
}

/**
 * Check if a specific server can run based on its command
 */
export async function checkServerRequirements(
  command: string,
  args: string[] = [],
  dependencyStatus?: DependencyCheckResult
): Promise<ServerRequirements> {
  // Get dependency status if not provided
  const status = dependencyStatus || await checkAllDependencies()
  const runtime = analyzeServerCommand(command, args)

  let requiredDeps: string[] = []
  let missingDeps: string[] = []

  switch (runtime) {
    case "nodejs":
      requiredDeps = ["Node.js", "npm", "npx"]
      missingDeps = status.dependencies
        .filter(d => requiredDeps.includes(d.name) && !d.installed)
        .map(d => d.name)
      break

    case "python":
      requiredDeps = ["Python", "uv", "uvx"]
      missingDeps = status.dependencies
        .filter(d => requiredDeps.includes(d.name) && !d.installed)
        .map(d => d.name)
      break

    case "docker":
      requiredDeps = ["Docker"]
      missingDeps = status.dependencies
        .filter(d => d.name === "Docker" && !d.installed)
        .map(d => d.name)
      break

    default:
      // Unknown runtime - just check if the command exists
      const cmdCheck = await checkCommand(command)
      if (!cmdCheck.available) {
        missingDeps = [command]
      }
      requiredDeps = [command]
  }

  return {
    runtime,
    dependencies: requiredDeps,
    missing: missingDeps,
    canRun: missingDeps.length === 0
  }
}

/**
 * Get install instructions for missing dependencies
 */
export function getInstallInstructions(missingDeps: string[]): Record<string, string> {
  const instructions: Record<string, string> = {}

  for (const depName of missingDeps) {
    const dep = MCP_DEPENDENCIES.find(d => d.name === depName)
    if (dep) {
      instructions[depName] = dep.installInstructions
    }
  }

  return instructions
}

/**
 * Get a summary message about missing dependencies
 */
export function getMissingSummary(status: DependencyCheckResult): string {
  const missing = status.dependencies.filter(d => !d.installed && d.required)

  if (missing.length === 0) {
    return "All required dependencies are installed."
  }

  const names = missing.map(d => d.name).join(", ")
  return `Missing required dependencies: ${names}. These are needed to run MCP servers.`
}
