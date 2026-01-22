/**
 * Install Runtime API
 * POST /api/launch-test/install-runtime
 *
 * Installs missing runtimes (PHP, Python, etc.) based on the detected OS.
 * Uses appropriate package manager (apt, brew, etc.)
 */

import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import * as os from "os"

const execAsync = promisify(exec)

interface RuntimeInstallConfig {
  name: string
  // Package manager commands for different platforms
  apt?: string      // Debian/Ubuntu
  brew?: string     // macOS
  dnf?: string      // Fedora/RHEL
  pacman?: string   // Arch
  apk?: string      // Alpine
}

const RUNTIME_INSTALL_CONFIGS: Record<string, RuntimeInstallConfig> = {
  php: {
    name: "PHP",
    apt: "sudo apt-get update && sudo apt-get install -y php php-cli php-mysql php-curl php-json php-mbstring",
    brew: "brew install php",
    dnf: "sudo dnf install -y php php-cli php-mysqlnd php-curl php-json php-mbstring",
    pacman: "sudo pacman -S --noconfirm php",
    apk: "sudo apk add php php-cli php-mysqli php-curl php-json php-mbstring"
  },
  python: {
    name: "Python 3",
    apt: "sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv",
    brew: "brew install python3",
    dnf: "sudo dnf install -y python3 python3-pip",
    pacman: "sudo pacman -S --noconfirm python python-pip",
    apk: "sudo apk add python3 py3-pip"
  },
  node: {
    name: "Node.js",
    apt: "curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs",
    brew: "brew install node",
    dnf: "sudo dnf install -y nodejs npm",
    pacman: "sudo pacman -S --noconfirm nodejs npm",
    apk: "sudo apk add nodejs npm"
  },
  rust: {
    name: "Rust/Cargo",
    apt: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
    brew: "brew install rust",
    dnf: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
    pacman: "sudo pacman -S --noconfirm rust",
    apk: "sudo apk add rust cargo"
  },
  flutter: {
    name: "Flutter",
    apt: "sudo snap install flutter --classic",
    brew: "brew install --cask flutter",
    dnf: "sudo snap install flutter --classic",
    pacman: "yay -S --noconfirm flutter",
    apk: "echo 'Flutter not available via apk - install manually from https://flutter.dev'"
  }
}

/**
 * Detect the package manager available on the system
 */
async function detectPackageManager(): Promise<{
  platform: string
  packageManager: "apt" | "brew" | "dnf" | "pacman" | "apk" | null
  osInfo: string
}> {
  const platform = os.platform()
  const osInfo = `${platform} ${os.release()}`

  if (platform === "darwin") {
    // macOS - check for Homebrew
    try {
      await execAsync("which brew", { timeout: 5000 })
      return { platform: "macOS", packageManager: "brew", osInfo }
    } catch {
      return { platform: "macOS", packageManager: null, osInfo }
    }
  }

  if (platform === "linux") {
    // Try to detect the Linux distribution
    try {
      const { stdout } = await execAsync("cat /etc/os-release 2>/dev/null || cat /etc/lsb-release 2>/dev/null", { timeout: 5000 })
      const osRelease = stdout.toLowerCase()

      // Check for apt (Debian/Ubuntu)
      if (osRelease.includes("ubuntu") || osRelease.includes("debian") || osRelease.includes("mint")) {
        return { platform: "Ubuntu/Debian", packageManager: "apt", osInfo: stdout.split("\n")[0] }
      }

      // Check for dnf (Fedora/RHEL)
      if (osRelease.includes("fedora") || osRelease.includes("rhel") || osRelease.includes("centos") || osRelease.includes("rocky")) {
        return { platform: "Fedora/RHEL", packageManager: "dnf", osInfo: stdout.split("\n")[0] }
      }

      // Check for pacman (Arch)
      if (osRelease.includes("arch") || osRelease.includes("manjaro")) {
        return { platform: "Arch Linux", packageManager: "pacman", osInfo: stdout.split("\n")[0] }
      }

      // Check for apk (Alpine)
      if (osRelease.includes("alpine")) {
        return { platform: "Alpine Linux", packageManager: "apk", osInfo: stdout.split("\n")[0] }
      }
    } catch {
      // Fall back to checking for package managers directly
    }

    // Try to detect by checking which package managers exist
    try {
      await execAsync("which apt-get", { timeout: 3000 })
      return { platform: "Linux (apt)", packageManager: "apt", osInfo }
    } catch {}

    try {
      await execAsync("which dnf", { timeout: 3000 })
      return { platform: "Linux (dnf)", packageManager: "dnf", osInfo }
    } catch {}

    try {
      await execAsync("which pacman", { timeout: 3000 })
      return { platform: "Linux (pacman)", packageManager: "pacman", osInfo }
    } catch {}

    try {
      await execAsync("which apk", { timeout: 3000 })
      return { platform: "Linux (apk)", packageManager: "apk", osInfo }
    } catch {}
  }

  return { platform: platform, packageManager: null, osInfo }
}

/**
 * GET: Get info about the system and available install command
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const runtime = url.searchParams.get("runtime")?.toLowerCase()

  if (!runtime) {
    return NextResponse.json({ error: "runtime parameter required" }, { status: 400 })
  }

  const config = RUNTIME_INSTALL_CONFIGS[runtime]
  if (!config) {
    return NextResponse.json({
      error: `Unknown runtime: ${runtime}`,
      supportedRuntimes: Object.keys(RUNTIME_INSTALL_CONFIGS)
    }, { status: 400 })
  }

  const { platform, packageManager, osInfo } = await detectPackageManager()

  if (!packageManager) {
    return NextResponse.json({
      runtime,
      runtimeName: config.name,
      platform,
      osInfo,
      canInstall: false,
      error: "Could not detect a supported package manager",
      manualInstructions: `Please install ${config.name} manually for your system`
    })
  }

  const installCommand = config[packageManager]

  return NextResponse.json({
    runtime,
    runtimeName: config.name,
    platform,
    osInfo,
    packageManager,
    canInstall: !!installCommand,
    installCommand
  })
}

/**
 * POST: Actually install the runtime
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { runtime } = body

  if (!runtime) {
    return NextResponse.json({ error: "runtime is required" }, { status: 400 })
  }

  const config = RUNTIME_INSTALL_CONFIGS[runtime.toLowerCase()]
  if (!config) {
    return NextResponse.json({
      success: false,
      error: `Unknown runtime: ${runtime}`
    }, { status: 400 })
  }

  const { platform, packageManager, osInfo } = await detectPackageManager()

  if (!packageManager) {
    return NextResponse.json({
      success: false,
      error: "Could not detect a supported package manager",
      platform,
      osInfo
    })
  }

  const installCommand = config[packageManager]
  if (!installCommand) {
    return NextResponse.json({
      success: false,
      error: `No install command available for ${packageManager}`,
      platform,
      osInfo
    })
  }

  console.log(`[install-runtime] Installing ${config.name} on ${platform} using ${packageManager}`)
  console.log(`[install-runtime] Command: ${installCommand}`)

  try {
    const { stdout, stderr } = await execAsync(installCommand, {
      timeout: 600000, // 10 minutes max
      maxBuffer: 50 * 1024 * 1024,
      env: {
        ...process.env,
        DEBIAN_FRONTEND: "noninteractive" // Prevent apt from asking questions
      }
    })

    console.log(`[install-runtime] Installation completed`)

    // Verify the installation worked
    let verified = false
    try {
      const verifyCmd = runtime === "php" ? "php --version" :
                        runtime === "python" ? "python3 --version" :
                        runtime === "node" ? "node --version" :
                        runtime === "rust" ? "cargo --version" :
                        runtime === "flutter" ? "flutter --version" : null

      if (verifyCmd) {
        const { stdout: verifyOut } = await execAsync(verifyCmd, { timeout: 10000 })
        verified = true
        console.log(`[install-runtime] Verified: ${verifyOut.trim()}`)
      }
    } catch {
      console.log(`[install-runtime] Could not verify installation`)
    }

    return NextResponse.json({
      success: true,
      runtime,
      runtimeName: config.name,
      platform,
      packageManager,
      command: installCommand,
      verified,
      output: stdout.substring(0, 5000),
      warnings: stderr ? stderr.substring(0, 2000) : undefined
    })

  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string }
    console.error(`[install-runtime] Installation failed:`, execError.message)

    return NextResponse.json({
      success: false,
      error: execError.message || "Installation failed",
      runtime,
      runtimeName: config.name,
      platform,
      packageManager,
      command: installCommand,
      output: execError.stdout?.substring(0, 5000),
      stderr: execError.stderr?.substring(0, 2000)
    })
  }
}
