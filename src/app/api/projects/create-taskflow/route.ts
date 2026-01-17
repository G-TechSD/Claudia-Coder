/**
 * API endpoint to create the TaskFlow Benchmark project
 *
 * POST /api/projects/create-taskflow
 *
 * This endpoint creates a pre-configured TaskFlow benchmark project and returns the
 * project data for the client to store in localStorage using createProject().
 *
 * The TaskFlow benchmark is a task management app used to test Claudia's
 * end-to-end code generation capabilities.
 *
 * Since localStorage is only accessible client-side, this API returns the
 * fully configured project data that the client should save.
 */

import { NextResponse } from "next/server"
import { mkdir, writeFile, readFile } from "fs/promises"
import { existsSync } from "fs"
import * as path from "path"
import os from "os"
import type { WorkPacket, BuildPlan, PacketType } from "@/lib/ai/build-plan"

// UUID generator that works in all contexts
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Spec file path
const SPEC_PATH = path.join(process.cwd(), "generated/benchmark-app-spec.json")

// Base directory for Claudia projects
const CLAUDIA_PROJECTS_BASE = process.env.CLAUDIA_PROJECTS_BASE || path.join(os.homedir(), "claudia-projects")

// TaskFlow project configuration
const TASKFLOW_CONFIG = {
  name: "TaskFlow",
  description: "A modern task management application for benchmarking Claudia's end-to-end code generation. Features task CRUD, categories, priorities, filtering, and statistics.",
  workingDirectory: path.join(CLAUDIA_PROJECTS_BASE, "taskflow-benchmark"),
  tags: ["benchmark", "react", "typescript", "nextjs", "task-management"],
  priority: "high" as const,
  status: "planning" as const
}

interface TaskFlowProject {
  id: string
  name: string
  description: string
  status: "planning" | "active" | "paused" | "completed" | "archived"
  priority: "low" | "medium" | "high" | "critical"
  createdAt: string
  updatedAt: string
  workingDirectory: string
  basePath: string
  repos: Array<{
    provider: "gitlab" | "github" | "local"
    id: number
    name: string
    path: string
    url: string
    localPath?: string
  }>
  packetIds: string[]
  tags: string[]
}

// TaskFlow spec types
interface TaskFlowSpec {
  name: string
  version: string
  description: string
  type: string
  complexity: string
  features: Array<{
    id: string
    name: string
    description: string
  }>
  pages: Array<{
    id: string
    name: string
    path: string
    description: string
    components: string[]
  }>
  dataModel: {
    entities: Array<{
      name: string
      description: string
      fields: Array<{
        name: string
        type: string
        required: boolean
        description: string
        values?: string[]
        default?: string
      }>
    }>
    relationships: Array<{
      type: string
      from: string
      to: string
      description: string
    }>
    defaultCategories: Array<{
      name: string
      color: string
      icon: string
    }>
  }
  uiRequirements: {
    framework: string
    styling: string
    stateManagement: string
    storage: string
    responsive: boolean
    darkMode: boolean
    accessibility: string
  }
  acceptanceCriteria: string[]
  testScenarios: Array<{
    name: string
    steps: string[]
  }>
  estimatedEffort: {
    components: number
    pages: number
    hoursForExperiencedDev: string
    complexityScore: number
  }
  metadata: {
    createdAt: string
    purpose: string
    author: string
  }
}

/**
 * Generate work packets from the TaskFlow specification
 */
function generatePacketsFromSpec(spec: TaskFlowSpec, projectId: string, buildPlanId: string): { packets: WorkPacket[], phases: BuildPlan["phases"] } {
  const packets: WorkPacket[] = []
  const phases: BuildPlan["phases"] = []
  let packetOrder = 1
  let phaseOrder = 1

  // Phase 1: Project Setup & Infrastructure
  const setupPhaseId = `phase-${phaseOrder}`
  phases.push({
    id: setupPhaseId,
    name: "Project Setup & Infrastructure",
    description: "Initialize the Next.js project with TypeScript, Tailwind CSS, and core configuration",
    order: phaseOrder++,
    packetIds: [],
    dependencies: [],
    estimatedEffort: { optimistic: 1, realistic: 2, pessimistic: 4, confidence: "high" },
    successCriteria: [
      "Next.js app created with TypeScript",
      "Tailwind CSS configured and working",
      "Basic project structure in place",
      "Dev server runs without errors"
    ]
  })

  // Setup packet
  const setupPacket: WorkPacket = {
    id: `pkt-${packetOrder}`,
    phaseId: setupPhaseId,
    title: "Initialize Next.js Project with TypeScript and Tailwind",
    description: "Create the Next.js application with TypeScript support, configure Tailwind CSS, and set up the basic project structure including folders for components, types, and utilities.",
    type: "config" as PacketType,
    priority: "critical",
    status: "queued",
    tasks: [
      { id: `task-${packetOrder}-1`, description: "Initialize Next.js with TypeScript template", completed: false, order: 1 },
      { id: `task-${packetOrder}-2`, description: "Install and configure Tailwind CSS", completed: false, order: 2 },
      { id: `task-${packetOrder}-3`, description: "Create folder structure: components/, types/, lib/, hooks/", completed: false, order: 3 },
      { id: `task-${packetOrder}-4`, description: "Set up base TypeScript types from spec data model", completed: false, order: 4 },
      { id: `task-${packetOrder}-5`, description: "Configure path aliases in tsconfig.json", completed: false, order: 5 }
    ],
    suggestedTaskType: "coding",
    blockedBy: [],
    blocks: [`pkt-${packetOrder + 1}`, `pkt-${packetOrder + 2}`],
    estimatedTokens: 8000,
    acceptanceCriteria: [
      "npm run dev starts without errors",
      "TypeScript compiles without errors",
      "Tailwind classes apply correctly",
      "All data model types are defined"
    ]
  }
  packets.push(setupPacket)
  phases[0].packetIds.push(setupPacket.id)
  packetOrder++

  // Phase 2: Data Layer
  const dataPhaseId = `phase-${phaseOrder}`
  phases.push({
    id: dataPhaseId,
    name: "Data Layer & State Management",
    description: "Implement localStorage persistence, React Context for state management, and CRUD operations",
    order: phaseOrder++,
    packetIds: [],
    dependencies: [setupPhaseId],
    estimatedEffort: { optimistic: 2, realistic: 4, pessimistic: 6, confidence: "medium" },
    successCriteria: [
      "Tasks persist across page refreshes",
      "Categories persist across page refreshes",
      "CRUD operations work correctly",
      "State management is reactive"
    ]
  })

  // LocalStorage and Context packet
  const dataPacket: WorkPacket = {
    id: `pkt-${packetOrder}`,
    phaseId: dataPhaseId,
    title: "Implement localStorage Persistence and React Context",
    description: "Create the data persistence layer using localStorage and a React Context provider for global state management. Include hooks for accessing and modifying tasks and categories.",
    type: "feature" as PacketType,
    priority: "critical",
    status: "queued",
    tasks: [
      { id: `task-${packetOrder}-1`, description: "Create localStorage utility functions (get, set, remove)", completed: false, order: 1 },
      { id: `task-${packetOrder}-2`, description: "Implement TaskContext with reducer for task state", completed: false, order: 2 },
      { id: `task-${packetOrder}-3`, description: "Implement CategoryContext for category management", completed: false, order: 3 },
      { id: `task-${packetOrder}-4`, description: "Create useTask() and useCategory() hooks", completed: false, order: 4 },
      { id: `task-${packetOrder}-5`, description: "Add default categories from spec on first load", completed: false, order: 5 }
    ],
    suggestedTaskType: "coding",
    blockedBy: [`pkt-1`],
    blocks: [`pkt-${packetOrder + 1}`, `pkt-${packetOrder + 2}`, `pkt-${packetOrder + 3}`],
    estimatedTokens: 12000,
    acceptanceCriteria: [
      "Tasks saved to localStorage on create/update/delete",
      "Tasks loaded from localStorage on app start",
      "Categories saved and loaded correctly",
      "Default categories created on first run",
      "Context updates trigger re-renders"
    ]
  }
  packets.push(dataPacket)
  phases[1].packetIds.push(dataPacket.id)
  packetOrder++

  // Phase 3: Core UI Components
  const uiPhaseId = `phase-${phaseOrder}`
  phases.push({
    id: uiPhaseId,
    name: "Core UI Components",
    description: "Build the reusable UI components: TaskItem, TaskForm, CategoryCard, FilterBar, etc.",
    order: phaseOrder++,
    packetIds: [],
    dependencies: [dataPhaseId],
    estimatedEffort: { optimistic: 4, realistic: 6, pessimistic: 10, confidence: "medium" },
    successCriteria: [
      "All core components render correctly",
      "Components are responsive",
      "Form validation works",
      "Priority and status indicators display correctly"
    ]
  })

  // Task components packet
  const taskComponentsPacket: WorkPacket = {
    id: `pkt-${packetOrder}`,
    phaseId: uiPhaseId,
    title: "Create Task UI Components",
    description: "Build TaskItem, TaskForm, TaskList, and QuickAddTask components with proper styling and interactivity.",
    type: "feature" as PacketType,
    priority: "high",
    status: "queued",
    tasks: [
      { id: `task-${packetOrder}-1`, description: "Create TaskItem component with priority indicator, checkbox, due date display", completed: false, order: 1 },
      { id: `task-${packetOrder}-2`, description: "Create TaskForm component for creating/editing tasks", completed: false, order: 2 },
      { id: `task-${packetOrder}-3`, description: "Create TaskList component with proper layout", completed: false, order: 3 },
      { id: `task-${packetOrder}-4`, description: "Create QuickAddTask inline form component", completed: false, order: 4 },
      { id: `task-${packetOrder}-5`, description: "Add visual indicators for overdue tasks", completed: false, order: 5 }
    ],
    suggestedTaskType: "coding",
    blockedBy: [`pkt-2`],
    blocks: [`pkt-${packetOrder + 3}`],
    estimatedTokens: 15000,
    acceptanceCriteria: [
      "TaskItem shows title, priority badge, due date, and category",
      "TaskForm validates required fields",
      "TaskList renders empty state when no tasks",
      "Overdue tasks are visually highlighted in red",
      "Components are responsive on mobile"
    ]
  }
  packets.push(taskComponentsPacket)
  phases[2].packetIds.push(taskComponentsPacket.id)
  packetOrder++

  // Category components packet
  const categoryComponentsPacket: WorkPacket = {
    id: `pkt-${packetOrder}`,
    phaseId: uiPhaseId,
    title: "Create Category UI Components",
    description: "Build CategoryCard, CategoryList, CategoryForm, and category selector components.",
    type: "feature" as PacketType,
    priority: "high",
    status: "queued",
    tasks: [
      { id: `task-${packetOrder}-1`, description: "Create CategoryCard with color indicator and task count", completed: false, order: 1 },
      { id: `task-${packetOrder}-2`, description: "Create CategoryList grid layout", completed: false, order: 2 },
      { id: `task-${packetOrder}-3`, description: "Create CategoryForm for create/edit with color picker", completed: false, order: 3 },
      { id: `task-${packetOrder}-4`, description: "Create CategorySelect dropdown for task forms", completed: false, order: 4 }
    ],
    suggestedTaskType: "coding",
    blockedBy: [`pkt-2`],
    blocks: [`pkt-${packetOrder + 2}`],
    estimatedTokens: 10000,
    acceptanceCriteria: [
      "CategoryCard displays name, color, icon, and task count",
      "CategoryForm includes color picker with preset colors",
      "CategorySelect shows all categories with colors",
      "Delete category shows confirmation dialog"
    ]
  }
  packets.push(categoryComponentsPacket)
  phases[2].packetIds.push(categoryComponentsPacket.id)
  packetOrder++

  // Filter and sort components packet
  const filterComponentsPacket: WorkPacket = {
    id: `pkt-${packetOrder}`,
    phaseId: uiPhaseId,
    title: "Create Filter, Sort, and Search Components",
    description: "Build FilterBar, SortOptions, SearchInput, and BulkActionBar components for task management.",
    type: "feature" as PacketType,
    priority: "medium",
    status: "queued",
    tasks: [
      { id: `task-${packetOrder}-1`, description: "Create FilterBar with category, priority, and status filters", completed: false, order: 1 },
      { id: `task-${packetOrder}-2`, description: "Create SortOptions dropdown (by date, priority, title)", completed: false, order: 2 },
      { id: `task-${packetOrder}-3`, description: "Create SearchInput with real-time filtering", completed: false, order: 3 },
      { id: `task-${packetOrder}-4`, description: "Create BulkActionBar for multi-select operations", completed: false, order: 4 }
    ],
    suggestedTaskType: "coding",
    blockedBy: [`pkt-2`],
    blocks: [`pkt-${packetOrder + 1}`],
    estimatedTokens: 10000,
    acceptanceCriteria: [
      "Filters combine correctly (AND logic)",
      "Sort maintains selected order",
      "Search is case-insensitive",
      "Bulk actions work on selected tasks"
    ]
  }
  packets.push(filterComponentsPacket)
  phases[2].packetIds.push(filterComponentsPacket.id)
  packetOrder++

  // Phase 4: Pages
  const pagesPhaseId = `phase-${phaseOrder}`
  phases.push({
    id: pagesPhaseId,
    name: "Page Implementation",
    description: "Build all application pages: Dashboard, Tasks, Task Detail, Categories, Statistics",
    order: phaseOrder++,
    packetIds: [],
    dependencies: [uiPhaseId],
    estimatedEffort: { optimistic: 3, realistic: 5, pessimistic: 8, confidence: "medium" },
    successCriteria: [
      "All pages render correctly",
      "Navigation works between pages",
      "Pages are responsive",
      "Dashboard shows accurate data"
    ]
  })

  // Dashboard page packet
  const dashboardPacket: WorkPacket = {
    id: `pkt-${packetOrder}`,
    phaseId: pagesPhaseId,
    title: "Implement Dashboard Page",
    description: "Create the main dashboard page with TaskSummaryCards, TodaysTasks, OverdueTasks, and QuickAddTask components.",
    type: "feature" as PacketType,
    priority: "high",
    status: "queued",
    tasks: [
      { id: `task-${packetOrder}-1`, description: "Create dashboard page layout with grid", completed: false, order: 1 },
      { id: `task-${packetOrder}-2`, description: "Implement TaskSummaryCards (total, completed, pending, overdue)", completed: false, order: 2 },
      { id: `task-${packetOrder}-3`, description: "Implement TodaysTasks section", completed: false, order: 3 },
      { id: `task-${packetOrder}-4`, description: "Implement OverdueTasks section with alert styling", completed: false, order: 4 },
      { id: `task-${packetOrder}-5`, description: "Add QuickAddTask form to dashboard", completed: false, order: 5 }
    ],
    suggestedTaskType: "coding",
    blockedBy: [`pkt-3`, `pkt-5`],
    blocks: [],
    estimatedTokens: 12000,
    acceptanceCriteria: [
      "Summary cards show accurate counts",
      "Today's tasks filtered correctly",
      "Overdue tasks highlighted",
      "Quick add creates task and updates lists"
    ]
  }
  packets.push(dashboardPacket)
  phases[3].packetIds.push(dashboardPacket.id)
  packetOrder++

  // Tasks page packet
  const tasksPagePacket: WorkPacket = {
    id: `pkt-${packetOrder}`,
    phaseId: pagesPhaseId,
    title: "Implement All Tasks Page",
    description: "Create the main tasks list page with full filtering, sorting, search, and bulk actions.",
    type: "feature" as PacketType,
    priority: "high",
    status: "queued",
    tasks: [
      { id: `task-${packetOrder}-1`, description: "Create tasks page layout", completed: false, order: 1 },
      { id: `task-${packetOrder}-2`, description: "Integrate FilterBar and SortOptions", completed: false, order: 2 },
      { id: `task-${packetOrder}-3`, description: "Integrate SearchInput with filtering logic", completed: false, order: 3 },
      { id: `task-${packetOrder}-4`, description: "Implement task selection and BulkActionBar", completed: false, order: 4 },
      { id: `task-${packetOrder}-5`, description: "Add pagination or infinite scroll for large lists", completed: false, order: 5 }
    ],
    suggestedTaskType: "coding",
    blockedBy: [`pkt-3`, `pkt-5`],
    blocks: [],
    estimatedTokens: 10000,
    acceptanceCriteria: [
      "All filters work together",
      "Search updates results in real-time",
      "Bulk actions affect all selected tasks",
      "Empty state shown when no results"
    ]
  }
  packets.push(tasksPagePacket)
  phases[3].packetIds.push(tasksPagePacket.id)
  packetOrder++

  // Task detail page packet
  const taskDetailPacket: WorkPacket = {
    id: `pkt-${packetOrder}`,
    phaseId: pagesPhaseId,
    title: "Implement Task Detail Page",
    description: "Create the task detail/edit page with full task form and delete functionality.",
    type: "feature" as PacketType,
    priority: "medium",
    status: "queued",
    tasks: [
      { id: `task-${packetOrder}-1`, description: "Create task detail page with dynamic routing", completed: false, order: 1 },
      { id: `task-${packetOrder}-2`, description: "Implement TaskDetails view component", completed: false, order: 2 },
      { id: `task-${packetOrder}-3`, description: "Add edit mode toggle with TaskForm", completed: false, order: 3 },
      { id: `task-${packetOrder}-4`, description: "Implement DeleteConfirmation dialog", completed: false, order: 4 },
      { id: `task-${packetOrder}-5`, description: "Add navigation back to tasks list", completed: false, order: 5 }
    ],
    suggestedTaskType: "coding",
    blockedBy: [`pkt-3`],
    blocks: [],
    estimatedTokens: 8000,
    acceptanceCriteria: [
      "Task loads correctly from ID in URL",
      "Edit mode shows pre-filled form",
      "Save returns to detail view",
      "Delete removes task and redirects"
    ]
  }
  packets.push(taskDetailPacket)
  phases[3].packetIds.push(taskDetailPacket.id)
  packetOrder++

  // Categories page packet
  const categoriesPagePacket: WorkPacket = {
    id: `pkt-${packetOrder}`,
    phaseId: pagesPhaseId,
    title: "Implement Categories Page",
    description: "Create the category management page with list view and CRUD operations.",
    type: "feature" as PacketType,
    priority: "medium",
    status: "queued",
    tasks: [
      { id: `task-${packetOrder}-1`, description: "Create categories page layout", completed: false, order: 1 },
      { id: `task-${packetOrder}-2`, description: "Integrate CategoryList component", completed: false, order: 2 },
      { id: `task-${packetOrder}-3`, description: "Add create category button and modal", completed: false, order: 3 },
      { id: `task-${packetOrder}-4`, description: "Implement edit and delete functionality", completed: false, order: 4 },
      { id: `task-${packetOrder}-5`, description: "Handle category deletion impact on tasks", completed: false, order: 5 }
    ],
    suggestedTaskType: "coding",
    blockedBy: [`pkt-4`],
    blocks: [],
    estimatedTokens: 8000,
    acceptanceCriteria: [
      "Categories display in grid layout",
      "Each card shows task count",
      "Create/edit opens modal form",
      "Delete warns about affected tasks"
    ]
  }
  packets.push(categoriesPagePacket)
  phases[3].packetIds.push(categoriesPagePacket.id)
  packetOrder++

  // Statistics page packet
  const statisticsPacket: WorkPacket = {
    id: `pkt-${packetOrder}`,
    phaseId: pagesPhaseId,
    title: "Implement Statistics Page",
    description: "Create the productivity statistics page with charts for completion rates, category breakdown, and trends.",
    type: "feature" as PacketType,
    priority: "medium",
    status: "queued",
    tasks: [
      { id: `task-${packetOrder}-1`, description: "Create statistics page layout", completed: false, order: 1 },
      { id: `task-${packetOrder}-2`, description: "Implement CompletionChart (pie or donut chart)", completed: false, order: 2 },
      { id: `task-${packetOrder}-3`, description: "Implement CategoryBreakdown chart", completed: false, order: 3 },
      { id: `task-${packetOrder}-4`, description: "Implement PriorityDistribution chart", completed: false, order: 4 },
      { id: `task-${packetOrder}-5`, description: "Implement WeeklyTrend line chart", completed: false, order: 5 }
    ],
    suggestedTaskType: "coding",
    blockedBy: [`pkt-2`],
    blocks: [],
    estimatedTokens: 12000,
    acceptanceCriteria: [
      "Completion chart shows pending vs completed ratio",
      "Category breakdown shows tasks per category",
      "Priority chart shows distribution",
      "Weekly trend shows completion over time"
    ]
  }
  packets.push(statisticsPacket)
  phases[3].packetIds.push(statisticsPacket.id)
  packetOrder++

  // Phase 5: Navigation & Polish
  const polishPhaseId = `phase-${phaseOrder}`
  phases.push({
    id: polishPhaseId,
    name: "Navigation & Polish",
    description: "Add navigation, responsive design polish, and final integration testing",
    order: phaseOrder++,
    packetIds: [],
    dependencies: [pagesPhaseId],
    estimatedEffort: { optimistic: 2, realistic: 3, pessimistic: 5, confidence: "high" },
    successCriteria: [
      "Navigation works on all pages",
      "App is fully responsive",
      "All features work end-to-end",
      "No console errors"
    ]
  })

  // Navigation packet
  const navigationPacket: WorkPacket = {
    id: `pkt-${packetOrder}`,
    phaseId: polishPhaseId,
    title: "Implement Navigation and Layout",
    description: "Create the main navigation component, app layout, and responsive sidebar/header.",
    type: "feature" as PacketType,
    priority: "high",
    status: "queued",
    tasks: [
      { id: `task-${packetOrder}-1`, description: "Create main Layout component with navigation", completed: false, order: 1 },
      { id: `task-${packetOrder}-2`, description: "Implement responsive sidebar for desktop", completed: false, order: 2 },
      { id: `task-${packetOrder}-3`, description: "Implement mobile hamburger menu", completed: false, order: 3 },
      { id: `task-${packetOrder}-4`, description: "Add active page indicator in nav", completed: false, order: 4 },
      { id: `task-${packetOrder}-5`, description: "Apply layout to all pages", completed: false, order: 5 }
    ],
    suggestedTaskType: "coding",
    blockedBy: [`pkt-6`, `pkt-7`],
    blocks: [`pkt-${packetOrder + 1}`],
    estimatedTokens: 10000,
    acceptanceCriteria: [
      "Navigation links to all pages",
      "Active page highlighted",
      "Sidebar collapses on mobile",
      "Menu accessible on all screen sizes"
    ]
  }
  packets.push(navigationPacket)
  phases[4].packetIds.push(navigationPacket.id)
  packetOrder++

  // Final integration packet
  const integrationPacket: WorkPacket = {
    id: `pkt-${packetOrder}`,
    phaseId: polishPhaseId,
    title: "Integration Testing and Polish",
    description: "Final testing of all features, fix any issues, and polish the UI.",
    type: "test" as PacketType,
    priority: "high",
    status: "queued",
    tasks: [
      { id: `task-${packetOrder}-1`, description: "Test create task flow end-to-end", completed: false, order: 1 },
      { id: `task-${packetOrder}-2`, description: "Test category management end-to-end", completed: false, order: 2 },
      { id: `task-${packetOrder}-3`, description: "Test due date handling (overdue, today, upcoming)", completed: false, order: 3 },
      { id: `task-${packetOrder}-4`, description: "Test localStorage persistence across refresh", completed: false, order: 4 },
      { id: `task-${packetOrder}-5`, description: "Fix any bugs discovered during testing", completed: false, order: 5 },
      { id: `task-${packetOrder}-6`, description: "Polish UI spacing, colors, and animations", completed: false, order: 6 }
    ],
    suggestedTaskType: "testing",
    blockedBy: [`pkt-${packetOrder - 1}`],
    blocks: [],
    estimatedTokens: 8000,
    acceptanceCriteria: [
      "All acceptance criteria from spec pass",
      "No console errors in browser",
      "Data persists correctly",
      "UI looks polished and consistent"
    ]
  }
  packets.push(integrationPacket)
  phases[4].packetIds.push(integrationPacket.id)

  return { packets, phases }
}

/**
 * Generate .claudia/config.json content
 */
function generateClaudiaConfig(project: TaskFlowProject, buildPlan: BuildPlan): string {
  const config = {
    version: "1.0.0",
    projectId: project.id,
    projectName: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    buildPlanId: buildPlan.id,
    buildPlanVersion: buildPlan.version,
    packets: buildPlan.packets.map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
      phaseId: p.phaseId
    })),
    paths: {
      prd: "docs/PRD.md",
      buildPlan: "docs/BUILD_PLAN.md",
      kickoff: "KICKOFF.md",
      packetsDir: "docs/packets/",
      statusDir: ".claudia/status/",
      requestsDir: ".claudia/requests/"
    },
    lastActivityAt: project.updatedAt
  }
  return JSON.stringify(config, null, 2)
}

/**
 * POST - Create the TaskFlow Benchmark project
 *
 * Returns the complete project object ready to be stored in localStorage.
 * The client should use createProject() or equivalent to persist this data.
 */
export async function POST() {
  try {
    const now = new Date().toISOString()
    const projectId = generateUUID()
    const buildPlanId = generateUUID()

    // Read the spec file
    let spec: TaskFlowSpec
    try {
      const specContent = await readFile(SPEC_PATH, "utf-8")
      spec = JSON.parse(specContent)
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: `Failed to read spec file: ${error instanceof Error ? error.message : "Unknown error"}`
      }, { status: 500 })
    }

    // Generate packets from spec
    const { packets, phases } = generatePacketsFromSpec(spec, projectId, buildPlanId)

    // Create the build plan
    const buildPlan: BuildPlan = {
      id: buildPlanId,
      projectId,
      createdAt: now,
      status: "draft",
      spec: {
        name: spec.name,
        description: spec.description,
        objectives: spec.acceptanceCriteria.slice(0, 5),
        nonGoals: [
          "User authentication or multi-user support",
          "Backend API or database integration",
          "Real-time collaboration features",
          "Mobile native app",
          "Dark mode (explicitly listed as false in requirements)"
        ],
        assumptions: [
          "Modern browser with localStorage support",
          "User will run app locally with npm run dev",
          "No backend required - all data stored in localStorage",
          "React/Next.js development environment available"
        ],
        risks: [
          "localStorage limits may affect large task lists - Mitigate by warning user at 500 tasks",
          "State management complexity with nested filters - Mitigate by using useReducer pattern"
        ],
        techStack: [
          spec.uiRequirements.framework,
          spec.uiRequirements.styling,
          spec.uiRequirements.stateManagement,
          "localStorage for persistence"
        ]
      },
      phases,
      packets,
      modelAssignments: [],
      constraints: {
        requireLocalFirst: true,
        requireHumanApproval: ["planning", "deployment"],
        maxParallelPackets: 2
      },
      generatedBy: "taskflow-benchmark-generator",
      version: 1
    }

    // Create the TaskFlow project object
    const project: TaskFlowProject = {
      id: projectId,
      name: TASKFLOW_CONFIG.name,
      description: TASKFLOW_CONFIG.description,
      status: TASKFLOW_CONFIG.status,
      priority: TASKFLOW_CONFIG.priority,
      createdAt: now,
      updatedAt: now,
      workingDirectory: TASKFLOW_CONFIG.workingDirectory,
      basePath: TASKFLOW_CONFIG.workingDirectory,
      repos: [],
      packetIds: packets.map(p => p.id),
      tags: TASKFLOW_CONFIG.tags
    }

    // Ensure the working directory exists on the filesystem
    const workingDir = TASKFLOW_CONFIG.workingDirectory

    // Ensure base directory exists
    if (!existsSync(CLAUDIA_PROJECTS_BASE)) {
      await mkdir(CLAUDIA_PROJECTS_BASE, { recursive: true })
      console.log(`[create-taskflow] Created base directory: ${CLAUDIA_PROJECTS_BASE}`)
    }

    // Create the working directory if it doesn't exist
    let directoryCreated = false
    if (!existsSync(workingDir)) {
      await mkdir(workingDir, { recursive: true })
      directoryCreated = true
      console.log(`[create-taskflow] Created working directory: ${workingDir}`)
    } else {
      console.log(`[create-taskflow] Working directory already exists: ${workingDir}`)
    }

    // Create .claudia directory structure
    const claudiaDir = path.join(workingDir, ".claudia")
    const statusDir = path.join(claudiaDir, "status")
    const requestsDir = path.join(claudiaDir, "requests")
    const docsDir = path.join(workingDir, "docs")
    const packetsDir = path.join(docsDir, "packets")

    await mkdir(statusDir, { recursive: true })
    await mkdir(requestsDir, { recursive: true })
    await mkdir(packetsDir, { recursive: true })

    // Write .claudia/config.json
    const configPath = path.join(claudiaDir, "config.json")
    await writeFile(configPath, generateClaudiaConfig(project, buildPlan), "utf-8")
    console.log(`[create-taskflow] Created config: ${configPath}`)

    // Write spec file to docs/
    const specDestPath = path.join(docsDir, "benchmark-spec.json")
    await writeFile(specDestPath, JSON.stringify(spec, null, 2), "utf-8")
    console.log(`[create-taskflow] Copied spec to: ${specDestPath}`)

    console.log(`[create-taskflow] Created project: ${project.name} (${project.id})`)
    console.log(`[create-taskflow] Generated ${packets.length} packets in ${phases.length} phases`)

    return NextResponse.json({
      success: true,
      project,
      buildPlan,
      packets,
      workingDirectory: workingDir,
      directoryCreated,
      stats: {
        totalPackets: packets.length,
        totalPhases: phases.length,
        estimatedHours: spec.estimatedEffort.hoursForExperiencedDev
      },
      message: "TaskFlow benchmark project created successfully. Store this project in localStorage using createProject()."
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create TaskFlow project"
    console.error("[create-taskflow] Error:", error)

    // Check for specific errors
    if (message.includes("EACCES") || message.includes("permission")) {
      return NextResponse.json(
        {
          success: false,
          error: "Permission denied. Cannot create directory at the specified path."
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Preview the TaskFlow project configuration
 *
 * Returns the project configuration without creating it.
 * Useful for checking what will be created before calling POST.
 */
export async function GET() {
  try {
    const workingDir = TASKFLOW_CONFIG.workingDirectory
    const directoryExists = existsSync(workingDir)

    // Try to read the spec for preview info
    let specInfo = null
    try {
      const specContent = await readFile(SPEC_PATH, "utf-8")
      const spec: TaskFlowSpec = JSON.parse(specContent)
      specInfo = {
        name: spec.name,
        description: spec.description,
        features: spec.features.length,
        pages: spec.pages.length,
        components: spec.estimatedEffort.components,
        complexity: spec.complexity,
        estimatedHours: spec.estimatedEffort.hoursForExperiencedDev
      }
    } catch {
      specInfo = { error: "Could not read spec file" }
    }

    return NextResponse.json({
      success: true,
      preview: {
        name: TASKFLOW_CONFIG.name,
        description: TASKFLOW_CONFIG.description,
        workingDirectory: TASKFLOW_CONFIG.workingDirectory,
        tags: TASKFLOW_CONFIG.tags,
        priority: TASKFLOW_CONFIG.priority,
        status: TASKFLOW_CONFIG.status
      },
      spec: specInfo,
      directoryExists,
      message: "Use POST to create this project."
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to preview TaskFlow project"
    console.error("[create-taskflow] Preview error:", error)

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    )
  }
}
