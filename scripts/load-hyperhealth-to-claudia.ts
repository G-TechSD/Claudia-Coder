/**
 * Load HyperHealth to Claudia Script
 *
 * Reads the generated hyperhealth-packets.json and creates a complete
 * project object with build plan suitable for loading into Claudia's
 * localStorage via browser console.
 *
 * Run with: npx tsx scripts/load-hyperhealth-to-claudia.ts
 *
 * The output is a JavaScript snippet that can be pasted into the browser
 * console to load the HyperHealth project and its packets into Claudia.
 */

import * as fs from 'fs'
import * as path from 'path'

// ============================================
// Types (matching Claudia's type system)
// ============================================

// From src/lib/data/types.ts
type ProjectStatus = "planning" | "active" | "paused" | "completed" | "archived"
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

// From src/lib/ai/build-plan.ts
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

interface BuildPhase {
  id: string
  name: string
  description: string
  order: number
  packetIds: string[]
  dependencies?: string[]
  successCriteria?: string[]
}

// From src/lib/data/types.ts - StoredBuildPlan
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

// Input type from hyperhealth-packets.json
interface HyperHealthBuildPlan {
  projectName: string
  projectDescription: string
  version: string
  createdAt: string
  phases: BuildPhase[]
  packets: WorkPacket[]
  techStack: string[]
  objectives: string[]
  nonGoals: string[]
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
// Transform Functions
// ============================================

function createProject(buildPlan: HyperHealthBuildPlan, projectId: string): Project {
  const now = new Date().toISOString()

  return {
    id: projectId,
    name: buildPlan.projectName,
    description: buildPlan.projectDescription,
    status: "active",
    priority: "high",
    createdAt: now,
    updatedAt: now,
    workingDirectory: "/home/bill/claudia-projects/hyperhealth-08549d59",
    basePath: "/home/bill/claudia-projects/hyperhealth-08549d59",
    repos: [],
    packetIds: buildPlan.packets.map(p => p.id),
    resourceIds: [],
    tags: ["health", "nextjs", "ai", "accessibility"],
    estimatedEffort: "80h",
    starred: true
  }
}

function createStoredBuildPlan(buildPlan: HyperHealthBuildPlan, projectId: string): StoredBuildPlan {
  const now = new Date().toISOString()
  const planId = generateId()

  return {
    id: planId,
    projectId: projectId,
    status: "approved",
    createdAt: now,
    updatedAt: now,
    originalPlan: {
      spec: {
        name: buildPlan.projectName,
        description: buildPlan.projectDescription,
        objectives: buildPlan.objectives,
        nonGoals: buildPlan.nonGoals,
        assumptions: [
          "User has Node.js 18+ installed",
          "SQLite is suitable for single-user local deployment",
          "Local LLM is available via LMStudio or Ollama",
          "Target browsers are modern (Chrome, Firefox, Safari, Edge)",
          "Users have basic technical ability to run local apps"
        ],
        risks: [
          "LLM responses may be inconsistent for medical triage",
          "OCR accuracy depends on image quality",
          "SQLite may hit performance limits with large datasets",
          "Accessibility compliance requires ongoing maintenance",
          "Medical disclaimer may not provide complete legal protection"
        ],
        techStack: buildPlan.techStack
      },
      phases: buildPlan.phases.map(phase => ({
        id: phase.id,
        name: phase.name,
        description: phase.description,
        order: phase.order
      })),
      packets: buildPlan.packets.map(packet => ({
        id: packet.id,
        phaseId: packet.phaseId,
        title: packet.title,
        description: packet.description,
        type: packet.type,
        priority: packet.priority,
        tasks: packet.tasks,
        acceptanceCriteria: packet.acceptanceCriteria
      }))
    },
    editedObjectives: buildPlan.objectives.map((text, i) => ({
      id: `obj-${i}`,
      text,
      isOriginal: true,
      isDeleted: false
    })),
    editedNonGoals: buildPlan.nonGoals.map((text, i) => ({
      id: `ng-${i}`,
      text,
      isOriginal: true,
      isDeleted: false
    })),
    packetFeedback: buildPlan.packets.map(packet => ({
      packetId: packet.id,
      approved: true,
      priority: packet.priority as "low" | "medium" | "high" | "critical",
      comment: ""
    })),
    sectionComments: [],
    generatedBy: {
      server: "local",
      model: "hyperhealth-setup-script"
    },
    revisionNumber: 1,
    approvedAt: now,
    approvedBy: "system"
  }
}

function transformPacketsForStorage(buildPlan: HyperHealthBuildPlan, projectId: string): WorkPacket[] {
  return buildPlan.packets.map(packet => ({
    ...packet,
    // Ensure all required fields are present
    status: packet.status === "ready" ? "queued" : packet.status,
    suggestedTaskType: packet.type === "infrastructure" ? "coding" : packet.type === "config" ? "coding" : "coding",
    blockedBy: packet.dependencies || [],
    blocks: [],
    estimatedTokens: 10000
  }))
}

// ============================================
// Console Snippet Generator
// ============================================

function generateConsoleSnippet(
  project: Project,
  storedBuildPlan: StoredBuildPlan,
  packets: WorkPacket[],
  projectId: string
): string {
  return `
// ============================================
// HyperHealth Project Loader for Claudia
// Generated: ${new Date().toISOString()}
// ============================================
//
// Paste this entire script into your browser console
// while on the Claudia Admin page (http://localhost:3000)
//

(function() {
  'use strict';

  const PROJECT_ID = "${projectId}";

  // === 1. PROJECT DATA ===
  const newProject = ${JSON.stringify(project, null, 2)};

  // === 2. BUILD PLAN DATA ===
  const newBuildPlan = ${JSON.stringify(storedBuildPlan, null, 2)};

  // === 3. PACKETS DATA ===
  const newPackets = ${JSON.stringify(packets, null, 2)};

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

  // === LOAD PROJECTS ===
  console.log('Loading HyperHealth project into Claudia...');
  console.log('');

  // Get existing projects
  let existingProjects = loadExisting('claudia_projects') || [];

  // Remove any existing HyperHealth project
  const filteredProjects = existingProjects.filter(p => p.id !== PROJECT_ID && p.name !== 'HyperHealth');

  // Add new project
  filteredProjects.push(newProject);

  if (saveData('claudia_projects', filteredProjects)) {
    console.log('Project saved successfully!');
    console.log('  Projects in storage: ' + filteredProjects.length);
  }

  // === LOAD BUILD PLANS ===
  let existingBuildPlans = loadExisting('claudia_build_plans') || [];

  // Remove any existing plans for this project
  const filteredPlans = existingBuildPlans.filter(p => p.projectId !== PROJECT_ID);

  // Add new build plan
  filteredPlans.push(newBuildPlan);

  if (saveData('claudia_build_plans', filteredPlans)) {
    console.log('Build plan saved successfully!');
    console.log('  Build plans in storage: ' + filteredPlans.length);
  }

  // === LOAD PACKETS ===
  let existingPackets = loadExisting('claudia_packets') || {};

  // Add/replace packets for this project
  existingPackets[PROJECT_ID] = newPackets;

  if (saveData('claudia_packets', existingPackets)) {
    console.log('Packets saved successfully!');
    console.log('  Packets for project: ' + newPackets.length);
  }

  // === SUMMARY ===
  console.log('');
  console.log('='.repeat(50));
  console.log('HyperHealth project loaded successfully!');
  console.log('='.repeat(50));
  console.log('');
  console.log('Project Details:');
  console.log('  ID: ' + PROJECT_ID);
  console.log('  Name: ' + newProject.name);
  console.log('  Status: ' + newProject.status);
  console.log('  Working Directory: ' + newProject.workingDirectory);
  console.log('');
  console.log('Build Plan:');
  console.log('  Phases: ' + newBuildPlan.originalPlan.phases.length);
  console.log('  Packets: ' + newPackets.length);
  console.log('  Status: ' + newBuildPlan.status);
  console.log('');
  console.log('Next Steps:');
  console.log('  1. Refresh the page (F5) to see the project');
  console.log('  2. Go to Projects to find HyperHealth');
  console.log('  3. Click on the project to view build plan and packets');
  console.log('');

  return {
    projectId: PROJECT_ID,
    projectName: newProject.name,
    packetsCount: newPackets.length,
    phasesCount: newBuildPlan.originalPlan.phases.length
  };
})();
`.trim()
}

// ============================================
// Main Execution
// ============================================

async function main() {
  console.log('='.repeat(60))
  console.log('  Load HyperHealth to Claudia')
  console.log('  Generates browser console loader script')
  console.log('='.repeat(60))
  console.log('')

  // Read the generated hyperhealth-packets.json
  const inputPath = path.join(__dirname, '..', 'generated', 'hyperhealth-packets.json')

  if (!fs.existsSync(inputPath)) {
    console.error('Error: hyperhealth-packets.json not found!')
    console.error(`Expected at: ${inputPath}`)
    console.error('')
    console.error('Please run setup-hyperhealth-packets.ts first:')
    console.error('  npx tsx scripts/setup-hyperhealth-packets.ts')
    process.exit(1)
  }

  console.log(`Reading: ${inputPath}`)
  const buildPlan: HyperHealthBuildPlan = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
  console.log('')

  // Generate a project ID (using a fixed suffix to match working directory)
  const projectId = "08549d59-" + generateId().slice(9)

  console.log('Transforming data for Claudia...')
  console.log('')

  // Create the project object
  const project = createProject(buildPlan, projectId)
  console.log('Project created:')
  console.log(`  ID: ${project.id}`)
  console.log(`  Name: ${project.name}`)
  console.log(`  Working Directory: ${project.workingDirectory}`)
  console.log('')

  // Create the stored build plan
  const storedBuildPlan = createStoredBuildPlan(buildPlan, projectId)
  console.log('Build plan created:')
  console.log(`  ID: ${storedBuildPlan.id}`)
  console.log(`  Status: ${storedBuildPlan.status}`)
  console.log(`  Phases: ${storedBuildPlan.originalPlan.phases.length}`)
  console.log('')

  // Transform packets for storage format
  const packets = transformPacketsForStorage(buildPlan, projectId)
  console.log('Packets transformed:')
  console.log(`  Total: ${packets.length}`)
  console.log('')

  // Generate the console snippet
  const consoleSnippet = generateConsoleSnippet(project, storedBuildPlan, packets, projectId)

  // Write outputs
  const outputDir = path.join(__dirname, '..', 'generated')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write the console snippet
  const snippetPath = path.join(outputDir, 'load-hyperhealth-console.js')
  fs.writeFileSync(snippetPath, consoleSnippet)
  console.log(`Console snippet written to: ${snippetPath}`)
  console.log('')

  // Write the project JSON separately for reference
  const projectPath = path.join(outputDir, 'hyperhealth-project.json')
  fs.writeFileSync(projectPath, JSON.stringify({
    project,
    buildPlan: storedBuildPlan,
    packets
  }, null, 2))
  console.log(`Full project data written to: ${projectPath}`)
  console.log('')

  // Print instructions
  console.log('='.repeat(60))
  console.log('  INSTRUCTIONS')
  console.log('='.repeat(60))
  console.log('')
  console.log('To load HyperHealth into Claudia:')
  console.log('')
  console.log('1. Open Claudia Admin in your browser:')
  console.log('   http://localhost:3000')
  console.log('')
  console.log('2. Open the browser developer console:')
  console.log('   - Chrome/Edge: Press F12, then click "Console" tab')
  console.log('   - Firefox: Press F12, then click "Console" tab')
  console.log('   - Safari: Enable dev tools in prefs, then Cmd+Opt+C')
  console.log('')
  console.log('3. Copy the contents of:')
  console.log(`   ${snippetPath}`)
  console.log('')
  console.log('4. Paste into the console and press Enter')
  console.log('')
  console.log('5. Refresh the page (F5) to see the project')
  console.log('')
  console.log('='.repeat(60))
  console.log('')

  // Also print a shortened snippet for quick reference
  console.log('Quick Load (copy and paste this single line):')
  console.log('')
  console.log(`fetch('file://${snippetPath}').then(r=>r.text()).then(eval)`)
  console.log('')
  console.log('Note: The file:// URL may not work due to browser security.')
  console.log('For best results, copy the full script from the generated file.')
  console.log('')
  console.log('Done!')
}

main().catch(console.error)
