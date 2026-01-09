/**
 * Session Tracking Module
 * Comprehensive session recording for beta testers using rrweb
 *
 * @module session-tracking
 *
 * @example
 * ```tsx
 * // In your app layout or root component:
 * import { SessionRecorderProvider } from "@/components/session-tracking/session-recorder"
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <SessionRecorderProvider>
 *       {children}
 *     </SessionRecorderProvider>
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Using the hook to track custom events:
 * import { useSessionRecorder } from "@/components/session-tracking/session-recorder"
 *
 * function MyComponent() {
 *   const { trackCustomEvent, trackError, isRecording } = useSessionRecorder()
 *
 *   const handleClick = () => {
 *     trackCustomEvent("user-action", {
 *       action: "button-click",
 *       elementText: "Submit",
 *     })
 *   }
 *
 *   return <button onClick={handleClick}>Submit</button>
 * }
 * ```
 */

// Types
export * from "./types"

// Recorder (client-side only)
export {
  SessionRecorder,
  getSessionRecorder,
  getExistingRecorder,
  clearSessionRecorder,
} from "./recorder"
