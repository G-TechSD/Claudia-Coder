/**
 * Session Tracking Types
 * TypeScript types for the beta tester session recording system using rrweb
 */

// ============ rrweb Event Types ============

/**
 * rrweb event type enum (matches rrweb's EventType)
 */
export enum RRWebEventType {
  DomContentLoaded = 0,
  Load = 1,
  FullSnapshot = 2,
  IncrementalSnapshot = 3,
  Meta = 4,
  Custom = 5,
  Plugin = 6,
}

/**
 * rrweb incremental source types
 */
export enum IncrementalSource {
  Mutation = 0,
  MouseMove = 1,
  MouseInteraction = 2,
  Scroll = 3,
  ViewportResize = 4,
  Input = 5,
  TouchMove = 6,
  MediaInteraction = 7,
  StyleSheetRule = 8,
  CanvasMutation = 9,
  Font = 10,
  Log = 11,
  Drag = 12,
  StyleDeclaration = 13,
  Selection = 14,
  AdoptedStyleSheet = 15,
}

/**
 * rrweb mouse interaction types
 */
export enum MouseInteractions {
  MouseUp = 0,
  MouseDown = 1,
  Click = 2,
  ContextMenu = 3,
  DblClick = 4,
  Focus = 5,
  Blur = 6,
  TouchStart = 7,
  TouchMove_Departed = 8,
  TouchEnd = 9,
  TouchCancel = 10,
}

/**
 * Base rrweb event structure (from rrweb library)
 */
export interface RRWebEvent {
  type: RRWebEventType
  data: unknown
  timestamp: number
}

// ============ Custom Event Types ============

export type CustomEventType =
  | "page-navigation"
  | "error"
  | "api-call"
  | "user-action"
  | "performance"

/**
 * Custom event tracked alongside rrweb
 */
export interface CustomSessionEvent {
  id: string
  type: CustomEventType
  timestamp: number

  // For page navigation
  fromPath?: string
  toPath?: string

  // For errors
  errorMessage?: string
  errorStack?: string
  errorType?: string
  errorSource?: string
  errorLine?: number
  errorColumn?: number

  // For API calls
  url?: string
  method?: string
  statusCode?: number
  duration?: number
  requestError?: string

  // For user actions
  action?: string
  elementSelector?: string
  elementText?: string

  // For performance
  metric?: string
  value?: number

  // Additional context
  context?: Record<string, unknown>
}

// ============ Session Metadata ============

export interface SessionMetadata {
  sessionId: string
  userId: string
  userEmail?: string
  userRole: string

  // Device info
  userAgent: string
  browser?: string
  browserVersion?: string
  os?: string
  osVersion?: string
  deviceType: "desktop" | "mobile" | "tablet"

  // Screen info
  screenWidth: number
  screenHeight: number
  viewportWidth: number
  viewportHeight: number
  devicePixelRatio: number

  // Locale
  language: string
  timezone: string

  // Session timing
  startedAt: string
  endedAt?: string
  duration?: number // milliseconds

  // Page info
  initialUrl: string
  initialReferrer?: string
}

// ============ Recording Chunks ============

/**
 * A chunk of recording data sent to the server
 */
export interface RecordingChunk {
  id: string
  sessionId: string
  chunkIndex: number

  // Events in this chunk
  rrwebEvents: RRWebEvent[]
  customEvents: CustomSessionEvent[]

  // Timing
  startTimestamp: number
  endTimestamp: number

  // Compression info
  compressed: boolean
  originalSize?: number
  compressedSize?: number
}

// ============ Full Session ============

/**
 * Complete session recording (for replay)
 */
export interface SessionRecording {
  id: string
  metadata: SessionMetadata

  // All events in chronological order
  events: RRWebEvent[]
  customEvents: CustomSessionEvent[]

  // Analytics
  analytics: SessionAnalytics

  // Status
  status: "recording" | "completed" | "error"
}

// ============ Analytics ============

export interface SessionAnalytics {
  // Duration
  totalDuration: number // milliseconds
  activeDuration: number // Time with activity

  // Interactions
  clickCount: number
  scrollCount: number
  inputCount: number
  mouseMoveDistance?: number

  // Navigation
  pageViews: number
  pagesVisited: string[]

  // Errors
  errorCount: number
  errors: Array<{
    message: string
    timestamp: number
    url?: string
  }>

  // API calls
  apiCallCount: number
  apiErrors: number
  avgApiResponseTime?: number

  // Engagement
  timeToFirstInteraction?: number
  engagementScore?: number // 0-100 calculated metric
}

// ============ API Request/Response Types ============

export interface SaveEventsRequest {
  action: "start" | "events" | "end"
  sessionId: string
  events?: RRWebEvent[]
  customEvents?: CustomSessionEvent[]
  metadata?: Partial<SessionMetadata>
  pagesVisited?: string[]
}

export interface SaveEventsResponse {
  success: boolean
  sessionId?: string
  error?: string
}

export interface ListSessionsParams {
  userId?: string
  startDate?: string
  endDate?: string
  search?: string
  limit?: number
  offset?: number
  groupBy?: "user"
}

export interface SessionSummary {
  id: string
  userId: string
  userName: string
  userEmail: string
  userImage: string | null
  startedAt: string
  endedAt: string | null
  duration: number | null
  clickCount: number
  errorCount: number
  pageCount: number
  status: "recording" | "completed"
}

// ============ Recorder Configuration ============

export interface RecorderConfig {
  // Enable/disable recording
  enabled: boolean

  // Only record beta testers
  betaOnly: boolean

  // Sampling rates
  mouseMovesSampleInterval: number // ms between mouse move samples
  scrollSampleInterval: number // ms between scroll samples

  // Chunk settings
  chunkIntervalMs: number // How often to send chunks
  maxEventsPerChunk: number

  // Privacy - input masking
  maskAllInputs: boolean
  maskInputTypes: string[] // ['password', 'email', etc.]

  // Privacy - element blocking/masking
  blockSelector: string // CSS selector for elements to completely block
  maskTextSelector: string // CSS selector for elements to mask text content
  ignoreSelector: string // CSS selector for elements to ignore completely

  // API endpoint
  apiEndpoint: string

  // Compression
  compressChunks: boolean

  // Debug mode
  debug: boolean
}

export const DEFAULT_RECORDER_CONFIG: RecorderConfig = {
  enabled: true,
  betaOnly: true,
  mouseMovesSampleInterval: 50, // Capture mouse moves every 50ms
  scrollSampleInterval: 150, // Capture scrolls every 150ms
  chunkIntervalMs: 10000, // 10 seconds
  maxEventsPerChunk: 1000,
  maskAllInputs: false, // Don't mask all inputs, just sensitive ones
  maskInputTypes: ["password"],
  blockSelector: "[data-session-block], .session-block",
  maskTextSelector: "[data-session-mask], input[type='password'], .sensitive-data",
  ignoreSelector: "[data-session-ignore]",
  apiEndpoint: "/api/session-tracking",
  compressChunks: true,
  debug: false,
}

// ============ Sensitive Field Patterns ============

/**
 * Patterns to detect sensitive input fields that should be masked
 */
export const SENSITIVE_INPUT_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /credit[_-]?card/i,
  /card[_-]?number/i,
  /cvv/i,
  /cvc/i,
  /ccv/i,
  /ssn/i,
  /social[_-]?security/i,
  /tax[_-]?id/i,
  /bank[_-]?account/i,
  /routing[_-]?number/i,
  /pin/i,
]

/**
 * Input autocomplete values that indicate sensitive data
 */
export const SENSITIVE_AUTOCOMPLETE_VALUES = [
  "cc-number",
  "cc-exp",
  "cc-exp-month",
  "cc-exp-year",
  "cc-csc",
  "cc-type",
  "cc-name",
  "new-password",
  "current-password",
]
