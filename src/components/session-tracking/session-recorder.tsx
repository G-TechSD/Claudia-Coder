"use client"

/**
 * Session Recorder Component
 * Wraps the app to record user sessions for beta testers
 *
 * Features:
 * - Automatically starts recording for beta testers
 * - Handles page visibility changes (pause on hidden)
 * - Tracks errors and API calls
 * - Cleans up on unmount
 */

import { useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import {
  SessionRecorder,
  getSessionRecorder,
  clearSessionRecorder,
  getExistingRecorder,
} from "@/lib/session-tracking/recorder"
import type { RecorderConfig } from "@/lib/session-tracking/types"

// ============ Types ============

interface SessionRecorderProviderProps {
  children: React.ReactNode

  /**
   * Override default recorder configuration
   */
  config?: Partial<RecorderConfig>

  /**
   * Callback when recording starts
   */
  onRecordingStart?: (sessionId: string) => void

  /**
   * Callback when recording stops
   */
  onRecordingStop?: (sessionId: string) => void

  /**
   * Callback when an error is tracked
   */
  onError?: (error: Error) => void

  /**
   * Enable debug mode (logs to console)
   */
  debug?: boolean
}

// ============ Custom Hook ============

/**
 * Hook to access the session recorder
 */
export function useSessionRecorder() {
  const recorder = getExistingRecorder()

  const trackCustomEvent = useCallback(
    (
      type: "user-action" | "performance",
      data: {
        action?: string
        elementSelector?: string
        elementText?: string
        metric?: string
        value?: number
        context?: Record<string, unknown>
      }
    ) => {
      if (recorder && recorder.getIsRecording()) {
        recorder.trackCustomEvent({
          type,
          ...data,
        })
      }
    },
    [recorder]
  )

  const trackError = useCallback(
    (error: Error, context?: Record<string, unknown>) => {
      if (recorder && recorder.getIsRecording()) {
        recorder.trackError(error, context)
      }
    },
    [recorder]
  )

  const trackPerformance = useCallback(
    (metric: string, value: number) => {
      if (recorder && recorder.getIsRecording()) {
        recorder.trackPerformance(metric, value)
      }
    },
    [recorder]
  )

  return {
    isRecording: recorder?.getIsRecording() ?? false,
    sessionId: recorder?.getSessionId() ?? null,
    trackCustomEvent,
    trackError,
    trackPerformance,
  }
}

// ============ Provider Component ============

/**
 * Session Recorder Provider
 * Wrap your app with this component to enable session recording for beta testers
 *
 * @example
 * ```tsx
 * <SessionRecorderProvider>
 *   <App />
 * </SessionRecorderProvider>
 * ```
 */
export function SessionRecorderProvider({
  children,
  config = {},
  onRecordingStart,
  onRecordingStop,
  onError,
  debug = false,
}: SessionRecorderProviderProps) {
  const { user, isLoading, isBetaTester } = useAuth()
  const recorderRef = useRef<SessionRecorder | null>(null)
  const hasStartedRef = useRef(false)

  // Log helper
  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log("[SessionRecorderProvider]", ...args)
      }
    },
    [debug]
  )

  // Initialize recording
  useEffect(() => {
    // Wait for auth to be loaded
    if (isLoading || !user) {
      return
    }

    // Don't start if already started
    if (hasStartedRef.current) {
      return
    }

    // Get user info
    const userId = user.id
    const userRole = user.role || "user"
    const userEmail = user.email || undefined

    // Only record for beta testers (or if betaOnly is false)
    if (config.betaOnly !== false && !isBetaTester) {
      log("Not a beta tester, skipping recording")
      return
    }

    log("Initializing session recorder for user:", userId, "role:", userRole)

    // Create and start recorder
    const recorder = getSessionRecorder(userId, userRole, userEmail, {
      ...config,
      debug,
    })

    recorderRef.current = recorder
    hasStartedRef.current = true

    // Start recording
    recorder.start().then(() => {
      if (recorder.getIsRecording()) {
        log("Recording started with session ID:", recorder.getSessionId())
        onRecordingStart?.(recorder.getSessionId())
      }
    })

    // Cleanup on unmount
    return () => {
      log("Component unmounting, cleaning up recorder")
      // Don't await here since it's in cleanup
      clearSessionRecorder().then(() => {
        const sessionId = recorderRef.current?.getSessionId()
        if (sessionId) {
          onRecordingStop?.(sessionId)
        }
        recorderRef.current = null
        hasStartedRef.current = false
      })
    }
  }, [user, isLoading, isBetaTester, config, debug, log, onRecordingStart, onRecordingStop])

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const recorder = recorderRef.current
      if (!recorder) return

      if (document.hidden) {
        log("Page hidden - recording continues but may reduce activity")
      } else {
        log("Page visible - recording continues normally")
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [log])

  // Handle beforeunload to send final events
  useEffect(() => {
    const handleBeforeUnload = () => {
      const recorder = recorderRef.current
      if (recorder && recorder.getIsRecording()) {
        // Try to send a beacon with final data
        // Note: This may not always succeed, but it's our best effort
        navigator.sendBeacon(
          "/api/session-tracking",
          JSON.stringify({
            action: "end",
            sessionId: recorder.getSessionId(),
            pagesVisited: [],
          })
        )
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [])

  // Track unhandled React errors
  useEffect(() => {
    // Listen for React error boundary events
    const handleError = (event: ErrorEvent) => {
      const recorder = recorderRef.current
      if (recorder && recorder.getIsRecording()) {
        // Error is already tracked by the recorder's error handler
        // But call the callback if provided
        if (onError && event.error) {
          onError(event.error)
        }
      }
    }

    window.addEventListener("error", handleError)

    return () => {
      window.removeEventListener("error", handleError)
    }
  }, [onError])

  return <>{children}</>
}

// ============ HOC for Class Components ============

/**
 * Higher-order component to wrap class components with session recording
 *
 * @example
 * ```tsx
 * class MyComponent extends React.Component {
 *   // ...
 * }
 *
 * export default withSessionRecording(MyComponent)
 * ```
 */
export function withSessionRecording<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  config?: Partial<RecorderConfig>
) {
  return function WithSessionRecording(props: P) {
    return (
      <SessionRecorderProvider config={config}>
        <WrappedComponent {...props} />
      </SessionRecorderProvider>
    )
  }
}

// ============ Exports ============

export { SessionRecorderProvider as default }
