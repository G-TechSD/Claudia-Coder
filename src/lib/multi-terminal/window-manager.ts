/**
 * Multi-Terminal Window Manager
 * Handles pop-out windows and cross-window communication via BroadcastChannel
 */

import { BroadcastMessage, BroadcastMessageType, PoppedOutWindow, TerminalStatus } from './types'

const CHANNEL_NAME = 'claudia-multi-terminal'
const WINDOW_POLL_INTERVAL = 1000 // Check if windows are closed every 1s

// Track popped out windows
const poppedOutWindows = new Map<string, PoppedOutWindow>()

// BroadcastChannel instance (lazy initialized)
let channel: BroadcastChannel | null = null

// Window close polling interval
let pollInterval: ReturnType<typeof setInterval> | null = null

// Callbacks for handling messages
type MessageCallback = (message: BroadcastMessage) => void
const messageCallbacks = new Set<MessageCallback>()

/**
 * Get or create the BroadcastChannel
 */
function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') {
    return null
  }

  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (event) => {
        const message = event.data as BroadcastMessage
        messageCallbacks.forEach(callback => callback(message))
      }
    } catch (error) {
      console.warn('[WindowManager] BroadcastChannel not supported:', error)
      return null
    }
  }

  return channel
}

/**
 * Subscribe to broadcast messages
 * Returns unsubscribe function
 */
export function subscribeToBroadcast(callback: MessageCallback): () => void {
  getChannel() // Ensure channel is initialized
  messageCallbacks.add(callback)

  return () => {
    messageCallbacks.delete(callback)
  }
}

/**
 * Send a broadcast message to all windows
 */
export function broadcastMessage(
  type: BroadcastMessageType,
  terminalId: string,
  payload?: unknown
): void {
  const ch = getChannel()
  if (!ch) return

  const message: BroadcastMessage = {
    type,
    terminalId,
    payload,
    timestamp: Date.now()
  }

  ch.postMessage(message)
}

/**
 * Open a terminal in a pop-out window
 */
export function openPopOutWindow(terminalId: string): Window | null {
  if (typeof window === 'undefined') {
    return null
  }

  // Check if already popped out
  const existing = poppedOutWindows.get(terminalId)
  if (existing?.windowRef && !existing.windowRef.closed) {
    existing.windowRef.focus()
    return existing.windowRef
  }

  // Open new window
  const url = `/claude-code/multi/popout/${terminalId}`
  const features = 'width=900,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
  const windowRef = window.open(url, `terminal-${terminalId}`, features)

  if (windowRef) {
    const poppedOut: PoppedOutWindow = {
      terminalId,
      windowRef,
      openedAt: new Date().toISOString()
    }
    poppedOutWindows.set(terminalId, poppedOut)

    // Start polling for window close if not already running
    startWindowPolling()
  }

  return windowRef
}

/**
 * Close a pop-out window
 */
export function closePopOutWindow(terminalId: string): void {
  const poppedOut = poppedOutWindows.get(terminalId)
  if (poppedOut?.windowRef && !poppedOut.windowRef.closed) {
    poppedOut.windowRef.close()
  }
  poppedOutWindows.delete(terminalId)
}

/**
 * Focus a pop-out window
 */
export function focusPopOutWindow(terminalId: string): boolean {
  const poppedOut = poppedOutWindows.get(terminalId)
  if (poppedOut?.windowRef && !poppedOut.windowRef.closed) {
    poppedOut.windowRef.focus()
    return true
  }
  return false
}

/**
 * Check if a terminal is popped out
 */
export function isWindowOpen(terminalId: string): boolean {
  const poppedOut = poppedOutWindows.get(terminalId)
  return !!(poppedOut?.windowRef && !poppedOut.windowRef.closed)
}

/**
 * Get all currently popped out terminal IDs
 */
export function getPoppedOutTerminalIds(): string[] {
  const ids: string[] = []
  poppedOutWindows.forEach((poppedOut, terminalId) => {
    if (poppedOut.windowRef && !poppedOut.windowRef.closed) {
      ids.push(terminalId)
    }
  })
  return ids
}

/**
 * Start polling for closed windows
 */
function startWindowPolling(): void {
  if (pollInterval) return

  pollInterval = setInterval(() => {
    const closedTerminals: string[] = []

    poppedOutWindows.forEach((poppedOut, terminalId) => {
      if (!poppedOut.windowRef || poppedOut.windowRef.closed) {
        closedTerminals.push(terminalId)
      }
    })

    // Broadcast window closed events and clean up
    closedTerminals.forEach(terminalId => {
      poppedOutWindows.delete(terminalId)
      broadcastMessage('window-closed', terminalId)
    })

    // Stop polling if no windows left
    if (poppedOutWindows.size === 0) {
      stopWindowPolling()
    }
  }, WINDOW_POLL_INTERVAL)
}

/**
 * Stop polling for closed windows
 */
function stopWindowPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

/**
 * Request a terminal to pop back in (sent from pop-out window)
 */
export function requestPopIn(terminalId: string): void {
  broadcastMessage('pop-in-request', terminalId)
}

/**
 * Notify status change (sent from pop-out window)
 */
export function notifyStatusChange(terminalId: string, status: TerminalStatus): void {
  broadcastMessage('session-status-change', terminalId, { status })
}

/**
 * Notify window closed (sent from pop-out window on unload)
 */
export function notifyWindowClosed(terminalId: string): void {
  broadcastMessage('window-closed', terminalId)
}

/**
 * Request layout sync (for new pop-out windows)
 */
export function requestLayoutSync(): void {
  broadcastMessage('sync-layout', '')
}

/**
 * Clean up resources
 */
export function cleanup(): void {
  stopWindowPolling()

  // Close all pop-out windows
  poppedOutWindows.forEach((poppedOut) => {
    if (poppedOut.windowRef && !poppedOut.windowRef.closed) {
      poppedOut.windowRef.close()
    }
  })
  poppedOutWindows.clear()

  // Close broadcast channel
  if (channel) {
    channel.close()
    channel = null
  }

  messageCallbacks.clear()
}

/**
 * Check if this window is a pop-out window
 */
export function isPopOutWindow(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.includes('/claude-code/multi/popout/')
}

/**
 * Get terminal ID from pop-out window URL
 */
export function getPopOutTerminalId(): string | null {
  if (typeof window === 'undefined') return null

  const match = window.location.pathname.match(/\/claude-code\/multi\/popout\/([^/]+)/)
  return match ? match[1] : null
}
