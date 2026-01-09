/**
 * Test script for verifying activity logging in Claudia Admin Panel
 *
 * This script tests the localStorage-based activity event system:
 * 1. Adds test activity events to localStorage
 * 2. Verifies they can be read back
 * 3. Provides browser console commands for manual testing
 *
 * Usage:
 *   - Run this script with: npx tsx scripts/test-activity.ts
 *   - Or copy the browser console commands to test in the browser
 *
 * localStorage key: claudia_activity_events
 * Event format: { id, type, message, timestamp, projectId? }
 */

// Define the activity event interface matching the app's expectations
interface ActivityEvent {
  id: string
  type: "success" | "error" | "pending" | "running" | "info"
  message: string
  timestamp: string
  projectId?: string
}

// Generate a unique ID for events
function generateEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Create a test activity event
function createTestEvent(
  type: ActivityEvent["type"],
  message: string,
  projectId?: string
): ActivityEvent {
  return {
    id: generateEventId(),
    type,
    message,
    timestamp: new Date().toISOString(),
    projectId
  }
}

// Sample test events to add
const testEvents: ActivityEvent[] = [
  createTestEvent("success", "Test: Build completed successfully"),
  createTestEvent("running", "Test: Executing packet GTE-001"),
  createTestEvent("error", "Test: Failed to connect to GitLab"),
  createTestEvent("pending", "Test: Awaiting approval for PR #42"),
  createTestEvent("info", "Test: Project initialized"),
  createTestEvent("success", "Test: All tests passed (15/15)", "test-project-1"),
  createTestEvent("running", "Test: Generating code for feature X", "test-project-2"),
]

// Add events to localStorage (simulates what the app does)
function addEventsToLocalStorage(events: ActivityEvent[]): void {
  const storageKey = "claudia_activity_events"

  // Get existing events
  let existingEvents: ActivityEvent[] = []
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      existingEvents = JSON.parse(stored)
    }
  } catch (e) {
    console.error("Failed to parse existing events:", e)
  }

  // Merge with new events
  const allEvents = [...existingEvents, ...events]

  // Store back (keep last 100 events)
  const trimmedEvents = allEvents.slice(-100)
  localStorage.setItem(storageKey, JSON.stringify(trimmedEvents))

  console.log(`Added ${events.length} events. Total: ${trimmedEvents.length}`)
}

// Read events from localStorage
function readEventsFromLocalStorage(): ActivityEvent[] {
  const storageKey = "claudia_activity_events"

  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error("Failed to read events:", e)
  }

  return []
}

// Clear all events from localStorage
function clearEvents(): void {
  localStorage.removeItem("claudia_activity_events")
  console.log("Cleared all activity events")
}

// Verify events are stored correctly
function verifyEvents(addedEvents: ActivityEvent[]): boolean {
  const storedEvents = readEventsFromLocalStorage()

  // Check that added events exist in storage
  for (const addedEvent of addedEvents) {
    const found = storedEvents.find(e => e.id === addedEvent.id)
    if (!found) {
      console.error(`Event not found in storage: ${addedEvent.id}`)
      return false
    }

    // Verify event properties
    if (found.type !== addedEvent.type) {
      console.error(`Event type mismatch for ${addedEvent.id}`)
      return false
    }
    if (found.message !== addedEvent.message) {
      console.error(`Event message mismatch for ${addedEvent.id}`)
      return false
    }
  }

  console.log("All events verified successfully!")
  return true
}

// Main test function
function runTests(): void {
  console.log("=== Activity Logging Test Script ===\n")

  // Check if we're in a browser environment
  if (typeof localStorage === "undefined") {
    console.log("Not in browser environment. Generating browser console commands instead.\n")
    generateBrowserCommands()
    return
  }

  // Browser environment - run actual tests
  console.log("1. Adding test events to localStorage...")
  addEventsToLocalStorage(testEvents)

  console.log("\n2. Reading events back from localStorage...")
  const events = readEventsFromLocalStorage()
  console.log(`Found ${events.length} events:`)
  events.slice(-5).forEach(e => {
    console.log(`  - [${e.type}] ${e.message} (${e.timestamp})`)
  })

  console.log("\n3. Verifying event integrity...")
  const verified = verifyEvents(testEvents)

  console.log("\n=== Test Results ===")
  console.log(`Status: ${verified ? "PASSED" : "FAILED"}`)
  console.log(`Events added: ${testEvents.length}`)
  console.log(`Total events in storage: ${events.length}`)

  console.log("\n4. Navigate to /activity page to see the events")
  console.log("   The Activity page should now show the test events")
}

// Generate browser console commands for manual testing
function generateBrowserCommands(): void {
  console.log("Copy and paste these commands into your browser console:\n")

  console.log("// --- Check existing events ---")
  console.log("console.log('Current events:', JSON.parse(localStorage.getItem('claudia_activity_events') || '[]'));")

  console.log("\n// --- Add a single test event ---")
  const singleEvent = createTestEvent("success", "Manual test event from console")
  console.log(`const testEvent = ${JSON.stringify(singleEvent, null, 2)};`)
  console.log(`const existing = JSON.parse(localStorage.getItem('claudia_activity_events') || '[]');`)
  console.log(`existing.push(testEvent);`)
  console.log(`localStorage.setItem('claudia_activity_events', JSON.stringify(existing));`)
  console.log(`console.log('Event added!');`)

  console.log("\n// --- Add multiple test events ---")
  console.log(`const testEvents = ${JSON.stringify(testEvents, null, 2)};`)
  console.log(`const current = JSON.parse(localStorage.getItem('claudia_activity_events') || '[]');`)
  console.log(`const merged = [...current, ...testEvents].slice(-100);`)
  console.log(`localStorage.setItem('claudia_activity_events', JSON.stringify(merged));`)
  console.log(`console.log('Added', testEvents.length, 'events. Total:', merged.length);`)

  console.log("\n// --- Clear all events ---")
  console.log(`localStorage.removeItem('claudia_activity_events');`)
  console.log(`console.log('Cleared all events');`)

  console.log("\n// --- Trigger storage event (for cross-tab updates) ---")
  console.log(`window.dispatchEvent(new StorageEvent('storage', { key: 'claudia_activity_events' }));`)

  console.log("\n// --- Full test script (all-in-one) ---")
  const fullScript = `
(function testActivityLogging() {
  const events = [
    { id: 'test-' + Date.now() + '-1', type: 'success', message: 'Test: Build completed', timestamp: new Date().toISOString() },
    { id: 'test-' + Date.now() + '-2', type: 'running', message: 'Test: Executing task', timestamp: new Date().toISOString() },
    { id: 'test-' + Date.now() + '-3', type: 'error', message: 'Test: Connection failed', timestamp: new Date().toISOString() },
    { id: 'test-' + Date.now() + '-4', type: 'pending', message: 'Test: Awaiting review', timestamp: new Date().toISOString() },
    { id: 'test-' + Date.now() + '-5', type: 'info', message: 'Test: System initialized', timestamp: new Date().toISOString() }
  ];

  const existing = JSON.parse(localStorage.getItem('claudia_activity_events') || '[]');
  const merged = [...existing, ...events].slice(-100);
  localStorage.setItem('claudia_activity_events', JSON.stringify(merged));

  console.log('Added ' + events.length + ' test events');
  console.log('Total events in storage: ' + merged.length);
  console.log('Navigate to /activity to see them');

  // Verify
  const stored = JSON.parse(localStorage.getItem('claudia_activity_events'));
  const lastFive = stored.slice(-5);
  console.table(lastFive.map(e => ({ type: e.type, message: e.message })));

  return { added: events.length, total: merged.length };
})();
`.trim()
  console.log(fullScript)
}

// Export functions for use as module
export {
  createTestEvent,
  addEventsToLocalStorage,
  readEventsFromLocalStorage,
  clearEvents,
  verifyEvents,
  testEvents,
  generateBrowserCommands
}

// Export type
export type { ActivityEvent }

// Run if executed directly
if (typeof window !== "undefined") {
  // Browser environment
  runTests()
} else if (typeof process !== "undefined" && process.argv[1]?.includes("test-activity")) {
  // Node.js environment - just generate browser commands
  console.log("=== Activity Logging Test Script ===")
  console.log("This script is designed to run in the browser.\n")
  generateBrowserCommands()
}
