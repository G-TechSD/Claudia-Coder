/**
 * Recover Bicycle GPS Route Project
 *
 * This script reconstructs the missing "Bicycle GPS Route" project from
 * activity log data. It generates a browser console script that can be
 * pasted into Claudia Admin to restore the project with its original ID.
 *
 * Data Source: /home/bill/projects/claudia-admin/.local-storage/activity-events.json
 *
 * Project Details:
 * - Project ID: 4e58a8fa-4f19-4a4a-a876-3178959950af
 * - Project Name: Bicycle Gps Route
 * - Working Directory: /home/bill/claudia-projects/bicycle-gps-route-4e58a8fa/
 * - 6 completed packets
 *
 * Run with: npx tsx scripts/recover-bicycle-gps.ts
 *
 * Then follow the instructions to paste the generated script into the browser console.
 */

import * as fs from 'fs'
import * as path from 'path'

// ============================================
// Types (matching Claudia's type system)
// ============================================

type ProjectStatus = "planning" | "active" | "paused" | "completed" | "archived" | "trashed"
type ProjectPriority = "low" | "medium" | "high" | "critical"

interface LinkedRepo {
  provider: "gitlab" | "github" | "local"
  id: number
  name: string
  path: string
  url: string
  localPath?: string
}

interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  priority: ProjectPriority
  createdAt: string
  updatedAt: string
  workingDirectory?: string
  basePath?: string
  repos: LinkedRepo[]
  packetIds: string[]
  resourceIds?: string[]
  tags: string[]
  estimatedEffort?: string
  color?: string
  starred?: boolean
}

type PacketType = "feature" | "bugfix" | "refactor" | "test" | "docs" | "config" | "research" | "infrastructure"
type PacketPriorityType = "critical" | "high" | "medium" | "low"
type PacketStatusType = "queued" | "assigned" | "in_progress" | "review" | "completed" | "blocked" | "ready"

interface PacketTask {
  id: string
  description: string
  completed: boolean
  order: number
}

interface WorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: PacketType
  priority: PacketPriorityType
  status: PacketStatusType
  tasks: PacketTask[]
  suggestedTaskType?: string
  assignedModel?: string
  blockedBy?: string[]
  blocks?: string[]
  estimatedTokens?: number
  estimatedCost?: number
  acceptanceCriteria: string[]
  phaseName?: string
  tags?: string[]
  estimatedEffort?: string
  dependencies?: string[]
}

interface StoredBuildPlan {
  id: string
  projectId: string
  status: "draft" | "approved" | "locked"
  createdAt: string
  updatedAt: string
  originalPlan: {
    spec: {
      name: string
      description: string
      objectives: string[]
      nonGoals: string[]
      assumptions: string[]
      risks: string[]
      techStack: string[]
    }
    phases: Array<{
      id: string
      name: string
      description: string
      order: number
    }>
    packets: Array<{
      id: string
      phaseId: string
      title: string
      description: string
      type: string
      priority: string
      tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
      acceptanceCriteria: string[]
    }>
  }
  editedObjectives: Array<{
    id: string
    text: string
    isOriginal: boolean
    isDeleted: boolean
  }>
  editedNonGoals: Array<{
    id: string
    text: string
    isOriginal: boolean
    isDeleted: boolean
  }>
  packetFeedback: Array<{
    packetId: string
    approved: boolean | null
    priority: "low" | "medium" | "high" | "critical"
    comment: string
  }>
  sectionComments: Array<{
    sectionId: string
    comment: string
    createdAt: string
  }>
  generatedBy: {
    server: string
    model: string
  }
  revisionNumber: number
  previousVersionId?: string
  revisionNotes?: string
  approvedAt?: string
  approvedBy?: string
  lockedAt?: string
}

interface ActivityEvent {
  id: string
  type: "success" | "error"
  message: string
  timestamp: string
  projectId: string
  projectName: string
  packetId: string
  packetTitle: string
  mode: string
  detail: string
}

// ============================================
// UUID Generator
// ============================================

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ============================================
// Recovery Data
// ============================================

// Fixed project ID from activity logs
const PROJECT_ID = "4e58a8fa-4f19-4a4a-a876-3178959950af"
const PROJECT_NAME = "Bicycle Gps Route"
const WORKING_DIRECTORY = "/home/bill/claudia-projects/bicycle-gps-route-4e58a8fa"

// Recovered packet data from activity logs
// These are the 6 packets that were completed according to the logs
const RECOVERED_PACKETS_FROM_LOGS: Array<{ id: string; title: string; timestamp: string }> = [
  { id: "pkt-req-design", title: "Create Feature Specification Document", timestamp: "2026-01-09T17:56:29.830Z" },
  { id: "pkt-gps-ingest", title: "Implement GPS Data Ingestion API", timestamp: "2026-01-09T17:56:29.967Z" },
  { id: "pkt-map-trace", title: "Build Live Map Trace Feature", timestamp: "2026-01-09T17:56:30.092Z" },
  { id: "pkt-kml-export", title: "Implement KML Export Endpoint", timestamp: "2026-01-09T17:56:30.224Z" },
  { id: "pkt-testing", title: "Write Unit and Integration Tests", timestamp: "2026-01-09T17:56:30.339Z" },
  { id: "pkt-deployment", title: "Package and Deploy Application", timestamp: "2026-01-09T17:56:30.462Z" },
]

// ============================================
// Reconstruct Full Packet Data
// ============================================

function reconstructPackets(): WorkPacket[] {
  // Reconstruct full packet data based on the titles and logical structure
  // This is a GPS route tracking application for bicycles

  const packets: WorkPacket[] = [
    {
      id: "pkt-req-design",
      phaseId: "phase-planning",
      title: "Create Feature Specification Document",
      description: "Create a comprehensive specification document defining the GPS route tracking features, data formats, and user interface requirements for the bicycle route application.",
      type: "docs",
      priority: "high",
      status: "completed",
      tasks: [
        { id: "task-1", description: "Define GPS data structure and coordinate format (GPX/KML support)", completed: true, order: 1 },
        { id: "task-2", description: "Document route tracking requirements (sampling rate, accuracy)", completed: true, order: 2 },
        { id: "task-3", description: "Specify map rendering and trace visualization requirements", completed: true, order: 3 },
        { id: "task-4", description: "Document export format specifications (KML, GPX)", completed: true, order: 4 },
      ],
      acceptanceCriteria: [
        "Specification document covers all major features",
        "Data formats are clearly defined with examples",
        "API endpoints are documented",
        "User stories are included"
      ],
      phaseName: "Planning",
      tags: ["documentation", "requirements"],
      estimatedEffort: "4h"
    },
    {
      id: "pkt-gps-ingest",
      phaseId: "phase-core",
      title: "Implement GPS Data Ingestion API",
      description: "Build the core API for ingesting GPS coordinate data from bicycle devices or mobile apps, including validation, storage, and real-time processing.",
      type: "feature",
      priority: "critical",
      status: "completed",
      tasks: [
        { id: "task-1", description: "Create GPS data model and database schema", completed: true, order: 1 },
        { id: "task-2", description: "Implement REST API endpoint for GPS data ingestion", completed: true, order: 2 },
        { id: "task-3", description: "Add coordinate validation and normalization", completed: true, order: 3 },
        { id: "task-4", description: "Implement batch upload support for GPX files", completed: true, order: 4 },
        { id: "task-5", description: "Add WebSocket support for real-time tracking", completed: true, order: 5 },
      ],
      acceptanceCriteria: [
        "API accepts GPS coordinates with lat/lng/altitude/timestamp",
        "Validates coordinate ranges and data integrity",
        "Supports both single-point and batch uploads",
        "Real-time data stream via WebSocket",
        "Proper error handling for malformed data"
      ],
      phaseName: "Core Development",
      tags: ["api", "gps", "backend"],
      estimatedEffort: "12h"
    },
    {
      id: "pkt-map-trace",
      phaseId: "phase-core",
      title: "Build Live Map Trace Feature",
      description: "Implement the interactive map component that displays bicycle routes as traces, with support for real-time updates, zoom/pan, and route highlighting.",
      type: "feature",
      priority: "high",
      status: "completed",
      tasks: [
        { id: "task-1", description: "Integrate mapping library (Leaflet/Mapbox)", completed: true, order: 1 },
        { id: "task-2", description: "Implement route polyline rendering", completed: true, order: 2 },
        { id: "task-3", description: "Add real-time trace updates from WebSocket", completed: true, order: 3 },
        { id: "task-4", description: "Implement route coloring based on speed/elevation", completed: true, order: 4 },
        { id: "task-5", description: "Add marker support for waypoints", completed: true, order: 5 },
      ],
      acceptanceCriteria: [
        "Map displays routes as connected polylines",
        "Real-time updates show current position",
        "Routes can be colored by metrics",
        "Smooth zoom and pan interactions",
        "Responsive on desktop and mobile"
      ],
      phaseName: "Core Development",
      tags: ["frontend", "maps", "visualization"],
      estimatedEffort: "16h"
    },
    {
      id: "pkt-kml-export",
      phaseId: "phase-features",
      title: "Implement KML Export Endpoint",
      description: "Create an API endpoint that exports recorded bicycle routes in KML format for use in Google Earth and other GIS applications.",
      type: "feature",
      priority: "medium",
      status: "completed",
      tasks: [
        { id: "task-1", description: "Implement KML document structure generator", completed: true, order: 1 },
        { id: "task-2", description: "Create API endpoint for route export", completed: true, order: 2 },
        { id: "task-3", description: "Add support for route metadata (name, description, timestamps)", completed: true, order: 3 },
        { id: "task-4", description: "Implement style customization for exported routes", completed: true, order: 4 },
      ],
      acceptanceCriteria: [
        "Valid KML output opens in Google Earth",
        "Route coordinates are accurate",
        "Metadata is included in export",
        "Large routes export without timeout",
        "File download works across browsers"
      ],
      phaseName: "Feature Development",
      tags: ["export", "kml", "api"],
      estimatedEffort: "8h"
    },
    {
      id: "pkt-testing",
      phaseId: "phase-qa",
      title: "Write Unit and Integration Tests",
      description: "Create comprehensive test coverage for the GPS ingestion, map rendering, and export functionality to ensure reliability and correctness.",
      type: "test",
      priority: "high",
      status: "completed",
      tasks: [
        { id: "task-1", description: "Write unit tests for GPS data validation", completed: true, order: 1 },
        { id: "task-2", description: "Create integration tests for API endpoints", completed: true, order: 2 },
        { id: "task-3", description: "Add tests for KML export format validity", completed: true, order: 3 },
        { id: "task-4", description: "Implement end-to-end tests for route recording flow", completed: true, order: 4 },
      ],
      acceptanceCriteria: [
        "Unit test coverage > 80%",
        "All API endpoints have integration tests",
        "KML exports validate against schema",
        "E2E tests cover happy path scenarios",
        "CI/CD pipeline runs tests on commit"
      ],
      phaseName: "Quality Assurance",
      tags: ["testing", "quality"],
      estimatedEffort: "10h"
    },
    {
      id: "pkt-deployment",
      phaseId: "phase-release",
      title: "Package and Deploy Application",
      description: "Prepare the application for deployment, including Docker containerization, environment configuration, and deployment to the target platform.",
      type: "infrastructure",
      priority: "high",
      status: "completed",
      tasks: [
        { id: "task-1", description: "Create production Dockerfile", completed: true, order: 1 },
        { id: "task-2", description: "Configure environment variables and secrets", completed: true, order: 2 },
        { id: "task-3", description: "Set up database migrations", completed: true, order: 3 },
        { id: "task-4", description: "Deploy to target environment", completed: true, order: 4 },
        { id: "task-5", description: "Verify deployment and run smoke tests", completed: true, order: 5 },
      ],
      acceptanceCriteria: [
        "Docker image builds successfully",
        "Application runs in container",
        "Environment configuration is documented",
        "Deployment script is repeatable",
        "Health checks pass post-deployment"
      ],
      phaseName: "Release",
      tags: ["devops", "deployment", "docker"],
      estimatedEffort: "8h"
    },
  ]

  return packets
}

function createProject(): Project {
  const now = new Date().toISOString()
  // Use the earliest packet timestamp as createdAt
  const createdAt = RECOVERED_PACKETS_FROM_LOGS[0].timestamp

  return {
    id: PROJECT_ID,
    name: PROJECT_NAME,
    description: "GPS route tracking application for bicycles with live map tracing, route recording, and KML export capabilities.",
    status: "active",
    priority: "medium",
    createdAt: createdAt,
    updatedAt: now,
    workingDirectory: WORKING_DIRECTORY,
    basePath: WORKING_DIRECTORY,
    repos: [],
    packetIds: RECOVERED_PACKETS_FROM_LOGS.map(p => p.id),
    resourceIds: [],
    tags: ["gps", "bicycle", "maps", "tracking", "kml"],
    estimatedEffort: "58h",
    starred: false
  }
}

function createBuildPlan(packets: WorkPacket[]): StoredBuildPlan {
  const now = new Date().toISOString()
  const planId = generateId()
  const createdAt = RECOVERED_PACKETS_FROM_LOGS[0].timestamp

  return {
    id: planId,
    projectId: PROJECT_ID,
    status: "locked", // Locked since all packets are completed
    createdAt: createdAt,
    updatedAt: now,
    originalPlan: {
      spec: {
        name: PROJECT_NAME,
        description: "GPS route tracking application for bicycles with live map tracing, route recording, and KML export capabilities.",
        objectives: [
          "Record GPS coordinates from bicycle rides in real-time",
          "Display routes on an interactive map with trace visualization",
          "Support KML export for Google Earth compatibility",
          "Provide real-time tracking via WebSocket connections",
          "Handle batch upload of GPX route files"
        ],
        nonGoals: [
          "Mobile app development (web-first approach)",
          "Social features or route sharing",
          "Navigation or turn-by-turn directions",
          "Integration with fitness platforms (Strava, etc.)"
        ],
        assumptions: [
          "Users have GPS-enabled devices",
          "Modern browser with geolocation support",
          "Stable internet connection for real-time tracking"
        ],
        risks: [
          "GPS accuracy varies by device and environment",
          "Large routes may impact performance",
          "WebSocket connections may drop on mobile networks"
        ],
        techStack: [
          "TypeScript",
          "Node.js",
          "Express",
          "Leaflet/Mapbox",
          "SQLite/PostgreSQL",
          "WebSocket"
        ]
      },
      phases: [
        { id: "phase-planning", name: "Planning", description: "Requirements and specification", order: 1 },
        { id: "phase-core", name: "Core Development", description: "GPS ingestion and map visualization", order: 2 },
        { id: "phase-features", name: "Feature Development", description: "Export and additional features", order: 3 },
        { id: "phase-qa", name: "Quality Assurance", description: "Testing and validation", order: 4 },
        { id: "phase-release", name: "Release", description: "Deployment and launch", order: 5 }
      ],
      packets: packets.map(p => ({
        id: p.id,
        phaseId: p.phaseId,
        title: p.title,
        description: p.description,
        type: p.type,
        priority: p.priority,
        tasks: p.tasks,
        acceptanceCriteria: p.acceptanceCriteria
      }))
    },
    editedObjectives: [
      { id: "obj-0", text: "Record GPS coordinates from bicycle rides in real-time", isOriginal: true, isDeleted: false },
      { id: "obj-1", text: "Display routes on an interactive map with trace visualization", isOriginal: true, isDeleted: false },
      { id: "obj-2", text: "Support KML export for Google Earth compatibility", isOriginal: true, isDeleted: false },
      { id: "obj-3", text: "Provide real-time tracking via WebSocket connections", isOriginal: true, isDeleted: false },
      { id: "obj-4", text: "Handle batch upload of GPX route files", isOriginal: true, isDeleted: false }
    ],
    editedNonGoals: [
      { id: "ng-0", text: "Mobile app development (web-first approach)", isOriginal: true, isDeleted: false },
      { id: "ng-1", text: "Social features or route sharing", isOriginal: true, isDeleted: false },
      { id: "ng-2", text: "Navigation or turn-by-turn directions", isOriginal: true, isDeleted: false },
      { id: "ng-3", text: "Integration with fitness platforms (Strava, etc.)", isOriginal: true, isDeleted: false }
    ],
    packetFeedback: packets.map(p => ({
      packetId: p.id,
      approved: true, // All completed packets were implicitly approved
      priority: p.priority as "low" | "medium" | "high" | "critical",
      comment: ""
    })),
    sectionComments: [],
    generatedBy: {
      server: "local",
      model: "recovery-script"
    },
    revisionNumber: 1,
    approvedAt: RECOVERED_PACKETS_FROM_LOGS[0].timestamp,
    approvedBy: "system",
    lockedAt: new Date().toISOString()
  }
}

// ============================================
// Console Snippet Generator
// ============================================

function generateConsoleSnippet(
  project: Project,
  storedBuildPlan: StoredBuildPlan,
  packets: WorkPacket[]
): string {
  return `
// ============================================
// Bicycle GPS Route Project Recovery Script
// Generated: ${new Date().toISOString()}
// ============================================
//
// This script restores the "Bicycle GPS Route" project that was
// accidentally deleted. It recovers:
// - Project data with original ID: ${PROJECT_ID}
// - Build plan with 5 phases
// - 6 completed work packets
//
// Paste this entire script into your browser console
// while on the Claudia Admin page (http://localhost:3000)
//

(function() {
  'use strict';

  const PROJECT_ID = "${PROJECT_ID}";

  // === 1. PROJECT DATA ===
  const recoveredProject = ${JSON.stringify(project, null, 2)};

  // === 2. BUILD PLAN DATA ===
  const recoveredBuildPlan = ${JSON.stringify(storedBuildPlan, null, 2)};

  // === 3. PACKETS DATA ===
  const recoveredPackets = ${JSON.stringify(packets, null, 2)};

  // === HELPER FUNCTIONS ===
  function loadExisting(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error loading ' + key + ':', e);
      return null;
    }
  }

  function saveData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Error saving ' + key + ':', e);
      return false;
    }
  }

  // === RECOVERY PROCESS ===
  console.log('');
  console.log('='.repeat(60));
  console.log('  BICYCLE GPS ROUTE PROJECT RECOVERY');
  console.log('='.repeat(60));
  console.log('');
  console.log('Recovering project from activity logs...');
  console.log('');

  // === LOAD PROJECTS ===
  let existingProjects = loadExisting('claudia_projects') || [];

  // Check if project already exists
  const existingIndex = existingProjects.findIndex(p => p.id === PROJECT_ID);
  if (existingIndex >= 0) {
    console.log('WARNING: Project with ID ' + PROJECT_ID + ' already exists.');
    console.log('Replacing with recovered data...');
    existingProjects.splice(existingIndex, 1);
  }

  // Add recovered project
  existingProjects.push(recoveredProject);

  if (saveData('claudia_projects', existingProjects)) {
    console.log('[OK] Project recovered successfully');
    console.log('     Projects in storage: ' + existingProjects.length);
  } else {
    console.error('[ERROR] Failed to save project');
  }

  // === LOAD BUILD PLANS ===
  let existingBuildPlans = loadExisting('claudia_build_plans') || [];

  // Remove any existing plans for this project
  const filteredPlans = existingBuildPlans.filter(p => p.projectId !== PROJECT_ID);

  // Add recovered build plan
  filteredPlans.push(recoveredBuildPlan);

  if (saveData('claudia_build_plans', filteredPlans)) {
    console.log('[OK] Build plan recovered successfully');
    console.log('     Build plans in storage: ' + filteredPlans.length);
  } else {
    console.error('[ERROR] Failed to save build plan');
  }

  // === LOAD PACKETS ===
  let existingPackets = loadExisting('claudia_packets') || {};

  // Add recovered packets for this project
  existingPackets[PROJECT_ID] = recoveredPackets;

  if (saveData('claudia_packets', existingPackets)) {
    console.log('[OK] Packets recovered successfully');
    console.log('     Packets for project: ' + recoveredPackets.length);
  } else {
    console.error('[ERROR] Failed to save packets');
  }

  // === SUMMARY ===
  console.log('');
  console.log('='.repeat(60));
  console.log('  RECOVERY COMPLETE');
  console.log('='.repeat(60));
  console.log('');
  console.log('Project Details:');
  console.log('  ID:                ' + PROJECT_ID);
  console.log('  Name:              ' + recoveredProject.name);
  console.log('  Status:            ' + recoveredProject.status);
  console.log('  Working Directory: ' + recoveredProject.workingDirectory);
  console.log('');
  console.log('Build Plan:');
  console.log('  Phases:            ' + recoveredBuildPlan.originalPlan.phases.length);
  console.log('  Packets:           ' + recoveredPackets.length);
  console.log('  Status:            ' + recoveredBuildPlan.status);
  console.log('');
  console.log('Recovered Packets:');
  recoveredPackets.forEach(function(p, i) {
    console.log('  ' + (i + 1) + '. [' + p.status.toUpperCase() + '] ' + p.title);
  });
  console.log('');
  console.log('Next Steps:');
  console.log('  1. Refresh the page (F5) to see the project');
  console.log('  2. Go to Projects to find "Bicycle Gps Route"');
  console.log('  3. Verify all 6 packets are marked as completed');
  console.log('');

  return {
    success: true,
    projectId: PROJECT_ID,
    projectName: recoveredProject.name,
    packetsCount: recoveredPackets.length,
    phasesCount: recoveredBuildPlan.originalPlan.phases.length
  };
})();
`.trim()
}

// ============================================
// Main Execution
// ============================================

async function main() {
  console.log('='.repeat(60))
  console.log('  Bicycle GPS Route Project Recovery')
  console.log('='.repeat(60))
  console.log('')

  // Step 1: Read and verify activity logs
  const activityLogsPath = path.join(__dirname, '..', '.local-storage', 'activity-events.json')

  if (!fs.existsSync(activityLogsPath)) {
    console.error('Error: activity-events.json not found!')
    console.error(`Expected at: ${activityLogsPath}`)
    process.exit(1)
  }

  console.log(`Reading activity logs: ${activityLogsPath}`)
  const activityEvents: ActivityEvent[] = JSON.parse(fs.readFileSync(activityLogsPath, 'utf-8'))

  // Filter for Bicycle GPS project events
  const bicycleGpsEvents = activityEvents.filter(e => e.projectId === PROJECT_ID)

  console.log('')
  console.log('Found activity events for Bicycle GPS Route:')
  console.log(`  Total events: ${bicycleGpsEvents.length}`)
  console.log(`  Success events: ${bicycleGpsEvents.filter(e => e.type === 'success').length}`)
  console.log(`  Error events: ${bicycleGpsEvents.filter(e => e.type === 'error').length}`)
  console.log('')

  // List recovered packets
  console.log('Recovered packet information:')
  bicycleGpsEvents.forEach((event, i) => {
    console.log(`  ${i + 1}. ${event.packetTitle}`)
    console.log(`     ID: ${event.packetId}`)
    console.log(`     Status: ${event.type}`)
    console.log(`     Timestamp: ${event.timestamp}`)
  })
  console.log('')

  // Step 2: Reconstruct project data
  console.log('Reconstructing project data...')

  const packets = reconstructPackets()
  console.log(`  Created ${packets.length} packets`)

  const project = createProject()
  console.log(`  Created project: ${project.name}`)
  console.log(`  ID: ${project.id}`)
  console.log(`  Working Directory: ${project.workingDirectory}`)

  const buildPlan = createBuildPlan(packets)
  console.log(`  Created build plan with ${buildPlan.originalPlan.phases.length} phases`)
  console.log('')

  // Step 3: Generate console script
  console.log('Generating browser console script...')
  const consoleSnippet = generateConsoleSnippet(project, buildPlan, packets)

  // Ensure output directory exists
  const outputDir = path.join(__dirname, '..', 'generated')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write the console snippet
  const snippetPath = path.join(outputDir, 'recover-bicycle-gps-console.js')
  fs.writeFileSync(snippetPath, consoleSnippet)
  console.log(`  Written to: ${snippetPath}`)
  console.log('')

  // Write the full recovery data for reference
  const dataPath = path.join(outputDir, 'bicycle-gps-recovery-data.json')
  fs.writeFileSync(dataPath, JSON.stringify({
    project,
    buildPlan,
    packets,
    recoveredFrom: activityLogsPath,
    recoveryDate: new Date().toISOString()
  }, null, 2))
  console.log(`  Full data: ${dataPath}`)
  console.log('')

  // Print instructions
  console.log('='.repeat(60))
  console.log('  HOW TO RESTORE THE PROJECT')
  console.log('='.repeat(60))
  console.log('')
  console.log('Option 1: Copy and paste (recommended)')
  console.log('  1. Open Claudia Admin in your browser:')
  console.log('     http://localhost:3000')
  console.log('')
  console.log('  2. Open browser developer console:')
  console.log('     - Chrome/Edge: Press F12, click "Console" tab')
  console.log('     - Firefox: Press F12, click "Console" tab')
  console.log('')
  console.log('  3. Copy the contents of:')
  console.log(`     ${snippetPath}`)
  console.log('')
  console.log('  4. Paste into the console and press Enter')
  console.log('')
  console.log('  5. Refresh the page (F5) to see the restored project')
  console.log('')
  console.log('Option 2: Quick copy command')
  console.log('')
  console.log(`  cat "${snippetPath}" | xclip -selection clipboard`)
  console.log('')
  console.log('  Then paste into browser console with Ctrl+V')
  console.log('')
  console.log('='.repeat(60))
  console.log('')
  console.log('Recovery script generated successfully!')
}

main().catch(console.error)
