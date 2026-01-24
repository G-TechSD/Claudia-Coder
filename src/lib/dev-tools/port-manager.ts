/**
 * Port Manager for VS Code (code-server)
 *
 * Manages port allocation for iframe-based dev tools
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import path from "path"
import { createServer } from "net"

// Storage file for port allocations
const PORTS_FILE = path.join(process.cwd(), ".local-storage", "vscode-ports.json")

// Port range for VS Code instances
const PORT_RANGE_START = 8100
const PORT_RANGE_END = 8199

// Port allocation record
interface PortAllocation {
  port: number
  instanceId: string
  projectId: string
  workingDirectory: string
  allocatedAt: string
  pid?: number
}

// In-memory port allocations
let allocatedPorts: Map<number, PortAllocation> = new Map()

/**
 * Load port allocations from file
 */
function loadAllocations(): void {
  try {
    if (existsSync(PORTS_FILE)) {
      const data = readFileSync(PORTS_FILE, "utf-8")
      const allocations: PortAllocation[] = JSON.parse(data)
      allocatedPorts = new Map(allocations.map(a => [a.port, a]))
    }
  } catch (error) {
    console.error("[port-manager] Error loading allocations:", error)
    allocatedPorts = new Map()
  }
}

/**
 * Save port allocations to file
 */
function saveAllocations(): void {
  try {
    const dir = path.dirname(PORTS_FILE)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const allocations = Array.from(allocatedPorts.values())
    writeFileSync(PORTS_FILE, JSON.stringify(allocations, null, 2))
  } catch (error) {
    console.error("[port-manager] Error saving allocations:", error)
  }
}

/**
 * Initialize port manager
 */
export function initPortManager(): void {
  loadAllocations()
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()

    server.once("error", () => {
      resolve(false)
    })

    server.once("listening", () => {
      server.close()
      resolve(true)
    })

    server.listen(port, "127.0.0.1")
  })
}

/**
 * Find an available port in the range
 */
export async function findAvailablePort(): Promise<number | null> {
  loadAllocations() // Refresh from file

  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    // Skip if already allocated in memory
    if (allocatedPorts.has(port)) {
      continue
    }

    // Check if port is actually available
    const available = await isPortAvailable(port)
    if (available) {
      return port
    }
  }

  return null
}

/**
 * Allocate a port for an instance
 */
export async function allocatePort(
  instanceId: string,
  projectId: string,
  workingDirectory: string,
  pid?: number
): Promise<number | null> {
  loadAllocations()

  // Check if this project already has a port allocated
  for (const [port, allocation] of allocatedPorts.entries()) {
    if (allocation.projectId === projectId) {
      // Verify the port is still in use
      const inUse = !(await isPortAvailable(port))
      if (inUse) {
        console.log(`[port-manager] Reusing existing port ${port} for project ${projectId}`)
        return port
      } else {
        // Port was freed, remove the stale allocation
        allocatedPorts.delete(port)
      }
    }
  }

  // Find a new available port
  const port = await findAvailablePort()
  if (!port) {
    console.error("[port-manager] No available ports in range")
    return null
  }

  // Record the allocation
  const allocation: PortAllocation = {
    port,
    instanceId,
    projectId,
    workingDirectory,
    allocatedAt: new Date().toISOString(),
    pid,
  }

  allocatedPorts.set(port, allocation)
  saveAllocations()

  console.log(`[port-manager] Allocated port ${port} for instance ${instanceId}`)
  return port
}

/**
 * Release a port allocation
 */
export function releasePort(port: number): void {
  loadAllocations()

  if (allocatedPorts.has(port)) {
    allocatedPorts.delete(port)
    saveAllocations()
    console.log(`[port-manager] Released port ${port}`)
  }
}

/**
 * Release all ports for a project
 */
export function releaseProjectPorts(projectId: string): void {
  loadAllocations()

  const portsToRelease: number[] = []
  for (const [port, allocation] of allocatedPorts.entries()) {
    if (allocation.projectId === projectId) {
      portsToRelease.push(port)
    }
  }

  for (const port of portsToRelease) {
    allocatedPorts.delete(port)
  }

  if (portsToRelease.length > 0) {
    saveAllocations()
    console.log(`[port-manager] Released ports for project ${projectId}:`, portsToRelease)
  }
}

/**
 * Get allocation for a port
 */
export function getPortAllocation(port: number): PortAllocation | undefined {
  loadAllocations()
  return allocatedPorts.get(port)
}

/**
 * Get allocation for a project
 */
export function getProjectPortAllocation(projectId: string): PortAllocation | undefined {
  loadAllocations()

  for (const allocation of allocatedPorts.values()) {
    if (allocation.projectId === projectId) {
      return allocation
    }
  }

  return undefined
}

/**
 * Get all port allocations
 */
export function getAllAllocations(): PortAllocation[] {
  loadAllocations()
  return Array.from(allocatedPorts.values())
}

/**
 * Update allocation with PID
 */
export function updateAllocationPid(port: number, pid: number): void {
  loadAllocations()

  const allocation = allocatedPorts.get(port)
  if (allocation) {
    allocation.pid = pid
    saveAllocations()
  }
}

/**
 * Clean up stale allocations (ports that are no longer in use)
 */
export async function cleanupStaleAllocations(): Promise<number> {
  loadAllocations()

  const stalePorts: number[] = []

  for (const [port, _allocation] of allocatedPorts.entries()) {
    const available = await isPortAvailable(port)
    if (available) {
      // Port is available, meaning the process has stopped
      stalePorts.push(port)
    }
  }

  for (const port of stalePorts) {
    allocatedPorts.delete(port)
  }

  if (stalePorts.length > 0) {
    saveAllocations()
    console.log(`[port-manager] Cleaned up ${stalePorts.length} stale allocations`)
  }

  return stalePorts.length
}

// Initialize on module load
initPortManager()
