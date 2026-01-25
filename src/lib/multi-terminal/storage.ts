/**
 * Multi-Terminal localStorage persistence
 * Handles saving and loading of terminal layout configuration
 */

import { MultiTerminalLayout, DEFAULT_LAYOUT } from './types'

const STORAGE_KEY = 'multi-terminal-layout'
const DEBOUNCE_MS = 500

let debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Load layout from localStorage
 * Returns default layout if nothing stored or on error
 */
export function loadLayout(): MultiTerminalLayout {
  if (typeof window === 'undefined') {
    return DEFAULT_LAYOUT
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return DEFAULT_LAYOUT
    }

    const parsed = JSON.parse(stored) as MultiTerminalLayout

    // Validate version
    if (parsed.version !== 1) {
      console.warn('[MultiTerminal] Unknown layout version, using default')
      return DEFAULT_LAYOUT
    }

    // Validate and normalize data
    return {
      version: 1,
      gridColumns: validateGridColumns(parsed.gridColumns),
      terminals: Array.isArray(parsed.terminals) ? parsed.terminals : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      ungroupedOrder: Array.isArray(parsed.ungroupedOrder) ? parsed.ungroupedOrder : []
    }
  } catch (error) {
    console.error('[MultiTerminal] Failed to load layout:', error)
    return DEFAULT_LAYOUT
  }
}

/**
 * Save layout to localStorage with debouncing
 * Prevents excessive writes during rapid state changes
 */
export function saveLayout(layout: MultiTerminalLayout): void {
  if (typeof window === 'undefined') {
    return
  }

  // Clear existing debounce timer
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  // Set new debounce timer
  debounceTimer = setTimeout(() => {
    try {
      // Reset popped out state when saving - windows don't persist across sessions
      const layoutToSave: MultiTerminalLayout = {
        ...layout,
        terminals: layout.terminals.map(t => ({
          ...t,
          isPoppedOut: false,
          // Reset status to idle - sessions don't persist across page reloads
          status: 'idle' as const
        }))
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutToSave))
    } catch (error) {
      console.error('[MultiTerminal] Failed to save layout:', error)
    }
  }, DEBOUNCE_MS)
}

/**
 * Save layout immediately (no debounce)
 * Use for critical saves like before page unload
 */
export function saveLayoutImmediate(layout: MultiTerminalLayout): void {
  if (typeof window === 'undefined') {
    return
  }

  // Clear any pending debounced save
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  try {
    const layoutToSave: MultiTerminalLayout = {
      ...layout,
      terminals: layout.terminals.map(t => ({
        ...t,
        isPoppedOut: false,
        status: 'idle' as const
      }))
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutToSave))
  } catch (error) {
    console.error('[MultiTerminal] Failed to save layout immediately:', error)
  }
}

/**
 * Clear all stored layout data
 */
export function clearLayout(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('[MultiTerminal] Failed to clear layout:', error)
  }
}

/**
 * Validate grid columns value
 */
function validateGridColumns(value: unknown): 1 | 2 | 3 | 4 {
  if (typeof value === 'number' && [1, 2, 3, 4].includes(value)) {
    return value as 1 | 2 | 3 | 4
  }
  return 2 // Default to 2 columns
}

/**
 * Generate unique ID for terminals and groups
 */
export function generateId(prefix: string = 'term'): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${timestamp}-${random}`
}

/**
 * Export layout as JSON string for backup/sharing
 */
export function exportLayout(layout: MultiTerminalLayout): string {
  return JSON.stringify(layout, null, 2)
}

/**
 * Import layout from JSON string
 * Returns null if invalid
 */
export function importLayout(json: string): MultiTerminalLayout | null {
  try {
    const parsed = JSON.parse(json)

    if (parsed.version !== 1) {
      return null
    }

    return {
      version: 1,
      gridColumns: validateGridColumns(parsed.gridColumns),
      terminals: Array.isArray(parsed.terminals) ? parsed.terminals : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      ungroupedOrder: Array.isArray(parsed.ungroupedOrder) ? parsed.ungroupedOrder : []
    }
  } catch {
    return null
  }
}
