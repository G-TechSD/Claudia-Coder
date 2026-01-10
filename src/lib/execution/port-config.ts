/**
 * Port Configuration for Launch & Test
 *
 * Manages reserved ports and provides alternative port suggestions
 * to avoid conflicts with system services like Claudia.
 */

/**
 * Reserved ports that should not be used for launching projects.
 * These ports are in use by Claudia or other critical services.
 */
export const RESERVED_PORTS: Record<number, string> = {
  3000: "Claudia Coder",
  // Add other reserved ports here as needed
  // Example: 3001: "Claudia API"
}

/**
 * Get all reserved port numbers
 */
export function getReservedPorts(): number[] {
  return Object.keys(RESERVED_PORTS).map(Number)
}

/**
 * Check if a port is reserved by Claudia or other services
 */
export function isPortReserved(port: number): { reserved: boolean; usedBy?: string } {
  const usedBy = RESERVED_PORTS[port]
  return {
    reserved: !!usedBy,
    usedBy
  }
}

/**
 * Alternative ports to suggest when a default port is reserved or in use.
 * Ordered by preference.
 */
export const ALTERNATIVE_PORTS = [3001, 8080, 5000, 5173, 4000, 4200, 8000, 9000]

/**
 * Get suggested alternative ports for a given project type
 * Excludes reserved ports and the current port if specified
 */
export function getSuggestedPorts(excludePort?: number): number[] {
  const reservedPorts = getReservedPorts()
  return ALTERNATIVE_PORTS.filter(port =>
    !reservedPorts.includes(port) && port !== excludePort
  )
}

/**
 * Get the first available alternative port
 */
export function getFirstAlternativePort(excludePort?: number): number {
  const suggestions = getSuggestedPorts(excludePort)
  return suggestions[0] || 8080
}

/**
 * Validate a port for use, checking against reserved ports
 */
export function validatePort(port: number): {
  valid: boolean
  error?: string
  suggestedPorts?: number[]
} {
  const { reserved, usedBy } = isPortReserved(port)

  if (reserved) {
    return {
      valid: false,
      error: `Port ${port} is reserved for ${usedBy}`,
      suggestedPorts: getSuggestedPorts(port)
    }
  }

  return { valid: true }
}

/**
 * Get a safe default port for a project type, avoiding reserved ports
 */
export function getSafeDefaultPort(requestedPort: number): number {
  const { reserved } = isPortReserved(requestedPort)

  if (reserved) {
    return getFirstAlternativePort(requestedPort)
  }

  return requestedPort
}
