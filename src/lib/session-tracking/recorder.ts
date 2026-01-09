/**
 * Session Recorder Client
 * Uses rrweb to record user sessions for beta testers
 *
 * Features:
 * - Full DOM recording via rrweb
 * - Custom event tracking (navigation, errors, API calls)
 * - Automatic chunking and sending to server
 * - Privacy protection (sensitive field masking)
 * - Compression support
 */

import { record } from "rrweb"
import type { eventWithTime } from "@rrweb/types"
import {
  type RecorderConfig,
  type SessionMetadata,
  type RRWebEvent,
  type CustomSessionEvent,
  type SaveEventsRequest,
  DEFAULT_RECORDER_CONFIG,
  SENSITIVE_INPUT_PATTERNS,
  SENSITIVE_AUTOCOMPLETE_VALUES,
  RRWebEventType,
  IncrementalSource,
} from "./types"

// ============ User Agent Parsing ============

interface ParsedUserAgent {
  browser: string
  browserVersion: string
  os: string
  osVersion: string
  deviceType: "desktop" | "mobile" | "tablet"
}

function parseUserAgent(ua: string): ParsedUserAgent {
  const result: ParsedUserAgent = {
    browser: "Unknown",
    browserVersion: "",
    os: "Unknown",
    osVersion: "",
    deviceType: "desktop",
  }

  // Detect browser
  if (ua.includes("Firefox/")) {
    result.browser = "Firefox"
    result.browserVersion = ua.match(/Firefox\/(\d+(\.\d+)?)/)?.[1] || ""
  } else if (ua.includes("Edg/")) {
    result.browser = "Edge"
    result.browserVersion = ua.match(/Edg\/(\d+(\.\d+)?)/)?.[1] || ""
  } else if (ua.includes("Chrome/")) {
    result.browser = "Chrome"
    result.browserVersion = ua.match(/Chrome\/(\d+(\.\d+)?)/)?.[1] || ""
  } else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
    result.browser = "Safari"
    result.browserVersion = ua.match(/Version\/(\d+(\.\d+)?)/)?.[1] || ""
  }

  // Detect OS
  if (ua.includes("Windows NT")) {
    result.os = "Windows"
    const version = ua.match(/Windows NT (\d+(\.\d+)?)/)?.[1]
    result.osVersion = version === "10.0" ? "10/11" : version || ""
  } else if (ua.includes("Mac OS X")) {
    result.os = "macOS"
    result.osVersion = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace(/_/g, ".") || ""
  } else if (ua.includes("Linux")) {
    result.os = "Linux"
  } else if (ua.includes("Android")) {
    result.os = "Android"
    result.osVersion = ua.match(/Android (\d+(\.\d+)?)/)?.[1] || ""
  } else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) {
    result.os = "iOS"
    result.osVersion = ua.match(/OS (\d+[._]\d+)/)?.[1]?.replace(/_/g, ".") || ""
  }

  // Detect device type
  if (ua.includes("Mobile") || ua.includes("Android") && !ua.includes("Tablet")) {
    result.deviceType = "mobile"
  } else if (ua.includes("Tablet") || ua.includes("iPad")) {
    result.deviceType = "tablet"
  }

  return result
}

// ============ Session Recorder Class ============

export class SessionRecorder {
  private config: RecorderConfig
  private sessionId: string
  private userId: string
  private userEmail?: string
  private userRole: string

  private isRecording = false
  private stopRecording: (() => void) | null = null

  private events: RRWebEvent[] = []
  private customEvents: CustomSessionEvent[] = []
  private pagesVisited: Set<string> = new Set()
  private chunkTimer: ReturnType<typeof setInterval> | null = null

  private metadata: SessionMetadata | null = null
  private startTime = 0
  private eventCount = 0
  private hasStartedSession = false

  // For tracking significant events
  private lastEventTime = 0

  // Original handlers (for cleanup)
  private originalOnError: OnErrorEventHandler | null = null
  private originalOnUnhandledRejection: ((event: PromiseRejectionEvent) => unknown) | null = null
  private originalFetch: typeof fetch | null = null
  private originalPushState: typeof history.pushState | null = null
  private originalReplaceState: typeof history.replaceState | null = null

  constructor(
    userId: string,
    userRole: string,
    userEmail?: string,
    config: Partial<RecorderConfig> = {}
  ) {
    this.config = { ...DEFAULT_RECORDER_CONFIG, ...config }
    this.sessionId = this.generateSessionId()
    this.userId = userId
    this.userEmail = userEmail
    this.userRole = userRole
  }

  // ============ Public Methods ============

  /**
   * Start recording the session
   */
  async start(): Promise<void> {
    if (typeof window === "undefined") {
      this.log("Cannot record on server side")
      return
    }

    if (this.isRecording) {
      this.log("Already recording")
      return
    }

    if (!this.config.enabled) {
      this.log("Recording disabled")
      return
    }

    // Check if user is beta tester when betaOnly is true
    if (this.config.betaOnly && !this.isBetaTester()) {
      this.log("Not a beta tester, skipping recording")
      return
    }

    this.log("Starting session recording", this.sessionId)

    this.isRecording = true
    this.startTime = Date.now()

    // Initialize metadata
    this.metadata = this.createMetadata()

    // Start session on server
    await this.startSessionOnServer()

    // Start rrweb recording
    this.startRRWebRecording()

    // Start chunk timer
    this.startChunkTimer()

    // Set up tracking
    this.setupErrorTracking()
    this.setupApiTracking()
    this.setupNavigationTracking()

    // Track initial page view
    this.trackPageNavigation(undefined, window.location.pathname)
  }

  /**
   * Stop recording and send final chunk
   */
  async stop(): Promise<void> {
    if (!this.isRecording) {
      return
    }

    this.log("Stopping session recording")

    this.isRecording = false

    // Stop rrweb recording
    if (this.stopRecording) {
      this.stopRecording()
      this.stopRecording = null
    }

    // Clear chunk timer
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer)
      this.chunkTimer = null
    }

    // Send final chunk
    await this.sendEventsToServer()

    // End session on server
    await this.endSessionOnServer()

    // Restore original handlers
    this.restoreHandlers()
  }

  /**
   * Track a custom event
   */
  trackCustomEvent(event: Omit<CustomSessionEvent, "id" | "timestamp">): void {
    if (!this.isRecording) return

    const customEvent: CustomSessionEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      ...event,
    }

    this.customEvents.push(customEvent)
    this.lastEventTime = Date.now()

    // Check if we should send immediately for significant events
    if (this.isSignificantEvent(event.type)) {
      this.maybeFlush()
    }
  }

  /**
   * Track a page navigation
   */
  trackPageNavigation(fromPath: string | undefined, toPath: string): void {
    this.pagesVisited.add(toPath)

    this.trackCustomEvent({
      type: "page-navigation",
      fromPath,
      toPath,
    })
  }

  /**
   * Track an error
   */
  trackError(error: Error, context?: Record<string, unknown>): void {
    this.trackCustomEvent({
      type: "error",
      errorMessage: error.message,
      errorStack: error.stack,
      errorType: error.name,
      context,
    })
  }

  /**
   * Track an API call
   */
  trackApiCall(
    url: string,
    method: string,
    statusCode: number,
    duration: number,
    error?: string
  ): void {
    this.trackCustomEvent({
      type: "api-call",
      url,
      method,
      statusCode,
      duration,
      requestError: error,
    })
  }

  /**
   * Track a performance metric
   */
  trackPerformance(metric: string, value: number): void {
    this.trackCustomEvent({
      type: "performance",
      metric,
      value,
    })
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording
  }

  // ============ Private Methods ============

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[SessionRecorder]", ...args)
    }
  }

  private isBetaTester(): boolean {
    return this.userRole === "beta" || this.userRole === "beta_tester"
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private createMetadata(): SessionMetadata {
    const ua = parseUserAgent(navigator.userAgent)

    return {
      sessionId: this.sessionId,
      userId: this.userId,
      userEmail: this.userEmail,
      userRole: this.userRole,
      userAgent: navigator.userAgent,
      browser: ua.browser,
      browserVersion: ua.browserVersion,
      os: ua.os,
      osVersion: ua.osVersion,
      deviceType: ua.deviceType,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      startedAt: new Date().toISOString(),
      initialUrl: window.location.href,
      initialReferrer: document.referrer || undefined,
    }
  }

  private startRRWebRecording(): void {
    const options = {
      emit: (event: eventWithTime) => {
        this.events.push(event as unknown as RRWebEvent)
        this.eventCount++
        this.lastEventTime = Date.now()

        // Check if we've hit max events per chunk
        if (this.events.length >= this.config.maxEventsPerChunk) {
          this.sendEventsToServer()
        }
      },

      // Sampling configuration
      sampling: {
        mousemove: true,
        mouseInteraction: true,
        scroll: this.config.scrollSampleInterval,
        media: 800,
        input: "last" as const, // Only record the last input value
      },

      // Privacy settings - mask password inputs
      maskInputOptions: {
        password: true,
        color: false,
        date: false,
        "datetime-local": false,
        email: false,
        month: false,
        number: false,
        range: false,
        search: false,
        tel: false,
        text: false,
        time: false,
        url: false,
        week: false,
        textarea: false,
        select: false,
      },

      // Block/mask selectors
      blockSelector: this.config.blockSelector,
      maskTextSelector: this.config.maskTextSelector,

      // Note: maskInputFn only receives text, not the element
      // For element-based masking, use maskInputOptions and maskTextSelector

      // Don't record canvas
      recordCanvas: false,

      // Don't collect fonts (reduces size)
      collectFonts: false,

      // Inline stylesheets for better replay
      inlineStylesheet: true,

      // Don't inline images (reduces size significantly)
      inlineImages: false,

      // Ignore elements with data-session-ignore
      slimDOMOptions: {
        script: true,
        comment: true,
        headFavicon: true,
        headWhitespace: true,
        headMetaDescKeywords: true,
        headMetaSocial: true,
        headMetaRobots: true,
        headMetaHttpEquiv: true,
        headMetaAuthorship: true,
        headMetaVerification: true,
      },
    }

    this.stopRecording = record(options) || null
  }

  private isSensitiveField(element: HTMLElement): boolean {
    const name = element.getAttribute("name") || ""
    const id = element.getAttribute("id") || ""
    const type = element.getAttribute("type") || ""
    const className = element.className || ""
    const autocomplete = element.getAttribute("autocomplete") || ""

    // Check type
    if (type === "password") return true

    // Check autocomplete attribute
    if (SENSITIVE_AUTOCOMPLETE_VALUES.includes(autocomplete)) return true

    // Check patterns against name, id, and className
    const fieldsToCheck = [name, id, className].join(" ")

    return SENSITIVE_INPUT_PATTERNS.some((pattern) => pattern.test(fieldsToCheck))
  }

  private startChunkTimer(): void {
    this.chunkTimer = setInterval(() => {
      this.sendEventsToServer()
    }, this.config.chunkIntervalMs)
  }

  private isSignificantEvent(type: string): boolean {
    return ["error", "api-call", "page-navigation"].includes(type)
  }

  private maybeFlush(): void {
    // Flush if we have enough significant events
    const significantEventCount = this.customEvents.filter((e) =>
      this.isSignificantEvent(e.type)
    ).length

    if (significantEventCount >= 5) {
      this.sendEventsToServer()
    }
  }

  private async startSessionOnServer(): Promise<void> {
    try {
      const request: SaveEventsRequest = {
        action: "start",
        sessionId: this.sessionId,
        metadata: this.metadata
          ? {
              userAgent: this.metadata.userAgent,
              screenWidth: this.metadata.screenWidth,
              screenHeight: this.metadata.screenHeight,
            }
          : undefined,
      }

      const response = await fetch(this.config.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      const result = await response.json()

      if (result.success) {
        this.hasStartedSession = true
        this.log("Session started on server")
      } else {
        console.error("[SessionRecorder] Failed to start session:", result.error)
      }
    } catch (error) {
      console.error("[SessionRecorder] Failed to start session:", error)
    }
  }

  private async sendEventsToServer(): Promise<void> {
    // Don't send if no events
    if (this.events.length === 0 && this.customEvents.length === 0) {
      return
    }

    // Make copies and clear
    const eventsToSend = [...this.events]
    const customEventsToSend = [...this.customEvents]

    this.events = []
    this.customEvents = []

    try {
      // Convert custom events to rrweb format for storage
      const rrwebEvents = eventsToSend.map((e) => ({
        type: e.type,
        data: e.data,
        timestamp: e.timestamp,
      }))

      const request: SaveEventsRequest = {
        action: "events",
        sessionId: this.sessionId,
        events: rrwebEvents,
        customEvents: customEventsToSend,
      }

      const response = await fetch(this.config.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      const result = await response.json()

      if (!result.success) {
        // Re-add events on failure
        this.events = [...eventsToSend, ...this.events]
        this.customEvents = [...customEventsToSend, ...this.customEvents]
        console.error("[SessionRecorder] Failed to send events:", result.error)
      } else {
        this.log(`Sent ${eventsToSend.length} events, ${customEventsToSend.length} custom events`)
      }
    } catch (error) {
      // Re-add events on failure
      this.events = [...eventsToSend, ...this.events]
      this.customEvents = [...customEventsToSend, ...this.customEvents]
      console.error("[SessionRecorder] Failed to send events:", error)
    }
  }

  private async endSessionOnServer(): Promise<void> {
    try {
      const request: SaveEventsRequest = {
        action: "end",
        sessionId: this.sessionId,
        pagesVisited: Array.from(this.pagesVisited),
      }

      const response = await fetch(this.config.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      const result = await response.json()

      if (result.success) {
        this.log("Session ended on server")
      } else {
        console.error("[SessionRecorder] Failed to end session:", result.error)
      }
    } catch (error) {
      console.error("[SessionRecorder] Failed to end session:", error)
    }
  }

  private setupErrorTracking(): void {
    // Store original
    this.originalOnError = window.onerror

    // Global error handler
    window.onerror = (message, source, lineno, colno, error) => {
      this.trackCustomEvent({
        type: "error",
        errorMessage: error?.message || String(message),
        errorStack: error?.stack,
        errorType: error?.name || "Error",
        errorSource: source || undefined,
        errorLine: lineno || undefined,
        errorColumn: colno || undefined,
      })

      // Call original handler
      if (this.originalOnError) {
        return this.originalOnError(message, source, lineno, colno, error)
      }
      return false
    }

    // Store original
    this.originalOnUnhandledRejection = window.onunhandledrejection

    // Unhandled promise rejections
    window.onunhandledrejection = (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))

      this.trackCustomEvent({
        type: "error",
        errorMessage: error.message,
        errorStack: error.stack,
        errorType: "UnhandledPromiseRejection",
      })

      // Call original handler
      if (this.originalOnUnhandledRejection) {
        return this.originalOnUnhandledRejection(event)
      }
    }
  }

  private setupApiTracking(): void {
    // Store original fetch
    this.originalFetch = window.fetch

    const self = this

    // Intercept fetch
    window.fetch = async function (...args) {
      const startTime = Date.now()
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || ""
      const method = (args[1]?.method || "GET").toUpperCase()

      // Skip tracking for session-tracking endpoint itself
      if (url.includes("/api/session-tracking")) {
        return self.originalFetch!.apply(window, args)
      }

      try {
        const response = await self.originalFetch!.apply(window, args)
        const duration = Date.now() - startTime

        // Only track API calls to our backend
        if (url.startsWith("/api") || url.startsWith(window.location.origin + "/api")) {
          self.trackApiCall(url, method, response.status, duration)
        }

        return response
      } catch (error) {
        const duration = Date.now() - startTime

        if (url.startsWith("/api") || url.startsWith(window.location.origin + "/api")) {
          self.trackApiCall(url, method, 0, duration, (error as Error).message)
        }

        throw error
      }
    }
  }

  private setupNavigationTracking(): void {
    // Store originals
    this.originalPushState = history.pushState.bind(history)
    this.originalReplaceState = history.replaceState.bind(history)

    const self = this
    let lastPath = window.location.pathname

    // Track history changes
    history.pushState = function (...args) {
      const result = self.originalPushState!(...args)
      const newPath = window.location.pathname

      if (newPath !== lastPath) {
        self.trackPageNavigation(lastPath, newPath)
        lastPath = newPath
      }

      return result
    }

    history.replaceState = function (...args) {
      const result = self.originalReplaceState!(...args)
      const newPath = window.location.pathname

      if (newPath !== lastPath) {
        self.trackPageNavigation(lastPath, newPath)
        lastPath = newPath
      }

      return result
    }

    // Track popstate (back/forward)
    window.addEventListener("popstate", () => {
      const newPath = window.location.pathname

      if (newPath !== lastPath) {
        this.trackPageNavigation(lastPath, newPath)
        lastPath = newPath
      }
    })
  }

  private restoreHandlers(): void {
    // Restore error handlers
    if (this.originalOnError !== null) {
      window.onerror = this.originalOnError
    }
    if (this.originalOnUnhandledRejection !== null) {
      window.onunhandledrejection = this.originalOnUnhandledRejection
    }

    // Restore fetch
    if (this.originalFetch) {
      window.fetch = this.originalFetch
    }

    // Restore history
    if (this.originalPushState) {
      history.pushState = this.originalPushState
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState
    }
  }
}

// ============ Singleton Instance ============

let recorderInstance: SessionRecorder | null = null

/**
 * Get or create the session recorder instance
 */
export function getSessionRecorder(
  userId: string,
  userRole: string,
  userEmail?: string,
  config?: Partial<RecorderConfig>
): SessionRecorder {
  if (!recorderInstance) {
    recorderInstance = new SessionRecorder(userId, userRole, userEmail, config)
  }
  return recorderInstance
}

/**
 * Get the existing recorder instance (if any)
 */
export function getExistingRecorder(): SessionRecorder | null {
  return recorderInstance
}

/**
 * Clear the session recorder instance
 */
export async function clearSessionRecorder(): Promise<void> {
  if (recorderInstance) {
    await recorderInstance.stop()
    recorderInstance = null
  }
}
