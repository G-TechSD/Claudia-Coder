/**
 * HyperHealth Work Packets Setup Script
 *
 * Creates work packets for building HyperHealth organized into 3 phases:
 * - Phase 1: Core setup (Next.js, Tailwind, database schema)
 * - Phase 2: Core features (auth, health tracking, appointments)
 * - Phase 3: Advanced features (symptom triage, bill scanner, accessibility)
 *
 * Run with: npx tsx scripts/setup-hyperhealth-packets.ts
 *
 * Output can be loaded into Claudia's project system via:
 * - Direct import in the browser
 * - API call to /api/projects/import
 * - Manual loading into localStorage
 */

import * as fs from 'fs'
import * as path from 'path'

// ============================================
// Types (matching Claudia's type system)
// ============================================

type PacketStatus = "ready" | "queued" | "in_progress" | "completed" | "failed"
type PacketPriority = "critical" | "high" | "medium" | "low"
type PacketType = "feature" | "bugfix" | "refactor" | "test" | "docs" | "config" | "research" | "infrastructure"

interface PacketTask {
  id: string
  description: string
  completed: boolean
  order: number
}

interface WorkPacket {
  id: string
  title: string
  description: string
  type: PacketType
  priority: PacketPriority
  status: PacketStatus
  phaseId: string
  phaseName: string
  tasks: PacketTask[]
  acceptanceCriteria: string[]
  dependencies?: string[]
  estimatedEffort?: string
  tags?: string[]
}

interface BuildPhase {
  id: string
  name: string
  description: string
  order: number
  packetIds: string[]
}

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
// Build Plan Data
// ============================================

function createHyperHealthBuildPlan(): HyperHealthBuildPlan {
  const now = new Date().toISOString()

  // Phase IDs
  const phase1Id = generateId()
  const phase2Id = generateId()
  const phase3Id = generateId()

  // ========== PHASE 1: Core Setup ==========
  const phase1Packets: WorkPacket[] = [
    {
      id: generateId(),
      title: "Initialize Next.js 14 Project with App Router",
      description: "Set up the foundational Next.js 14 project with TypeScript, App Router, and proper project structure for HyperHealth.",
      type: "infrastructure",
      priority: "high",
      status: "ready",
      phaseId: phase1Id,
      phaseName: "Core Setup",
      tasks: [
        { id: generateId(), description: "Create new Next.js 14 project with TypeScript template", completed: false, order: 1 },
        { id: generateId(), description: "Configure tsconfig.json with strict mode and path aliases", completed: false, order: 2 },
        { id: generateId(), description: "Set up src/ directory structure (app, components, lib, hooks, types)", completed: false, order: 3 },
        { id: generateId(), description: "Create base layout.tsx with metadata and fonts", completed: false, order: 4 },
        { id: generateId(), description: "Add .env.local template with required variables", completed: false, order: 5 },
        { id: generateId(), description: "Configure next.config.js with image domains and redirects", completed: false, order: 6 }
      ],
      acceptanceCriteria: [
        "Next.js 14 dev server runs without errors",
        "TypeScript strict mode enabled with no compilation errors",
        "App Router structure is properly set up",
        "Path aliases (@/*) work correctly",
        "Project follows Next.js 14 best practices"
      ],
      estimatedEffort: "2h",
      tags: ["setup", "nextjs", "typescript"]
    },
    {
      id: generateId(),
      title: "Configure Tailwind CSS with Custom Design System",
      description: "Set up Tailwind CSS with a custom color palette, typography, and component patterns for a healthcare-focused UI.",
      type: "config",
      priority: "high",
      status: "ready",
      phaseId: phase1Id,
      phaseName: "Core Setup",
      tasks: [
        { id: generateId(), description: "Install Tailwind CSS and required plugins (@tailwindcss/forms, @tailwindcss/typography)", completed: false, order: 1 },
        { id: generateId(), description: "Create tailwind.config.ts with custom color palette (primary green, secondary blue, accent colors)", completed: false, order: 2 },
        { id: generateId(), description: "Define typography scale and font families (Inter for UI, system fonts fallback)", completed: false, order: 3 },
        { id: generateId(), description: "Set up spacing scale and border radius tokens", completed: false, order: 4 },
        { id: generateId(), description: "Create globals.css with base styles and CSS variables", completed: false, order: 5 },
        { id: generateId(), description: "Add dark mode configuration (class-based)", completed: false, order: 6 }
      ],
      acceptanceCriteria: [
        "Tailwind CSS compiles without warnings",
        "Custom colors are accessible (WCAG AA contrast ratios)",
        "Dark mode toggle works correctly",
        "Typography is readable and professional",
        "Design system is documented in comments"
      ],
      estimatedEffort: "2h",
      tags: ["setup", "tailwind", "design-system"]
    },
    {
      id: generateId(),
      title: "Set Up SQLite Database with Better-SQLite3",
      description: "Configure SQLite database using better-sqlite3 for local data persistence with proper schema for health data.",
      type: "infrastructure",
      priority: "high",
      status: "ready",
      phaseId: phase1Id,
      phaseName: "Core Setup",
      tasks: [
        { id: generateId(), description: "Install better-sqlite3 and @types/better-sqlite3", completed: false, order: 1 },
        { id: generateId(), description: "Create database initialization module (src/lib/db/index.ts)", completed: false, order: 2 },
        { id: generateId(), description: "Define user schema (id, email, name, created_at, settings_json)", completed: false, order: 3 },
        { id: generateId(), description: "Define health_entries schema (id, user_id, type, value, unit, recorded_at, notes)", completed: false, order: 4 },
        { id: generateId(), description: "Define appointments schema (id, user_id, title, provider, datetime, location, notes, status)", completed: false, order: 5 },
        { id: generateId(), description: "Create migration system for schema updates", completed: false, order: 6 },
        { id: generateId(), description: "Add seed data script for development", completed: false, order: 7 }
      ],
      acceptanceCriteria: [
        "Database file is created in data/ directory",
        "All tables are created on first run",
        "CRUD operations work for all tables",
        "Foreign key constraints are enforced",
        "Migrations can be run incrementally",
        "Seed data populates sample entries"
      ],
      estimatedEffort: "3h",
      tags: ["database", "sqlite", "schema"]
    },
    {
      id: generateId(),
      title: "Create Base UI Component Library",
      description: "Build foundational UI components using Tailwind that will be reused throughout the application.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase1Id,
      phaseName: "Core Setup",
      tasks: [
        { id: generateId(), description: "Create Button component with variants (primary, secondary, outline, ghost, danger)", completed: false, order: 1 },
        { id: generateId(), description: "Create Input component with label, error state, and helper text", completed: false, order: 2 },
        { id: generateId(), description: "Create Card component with header, body, and footer slots", completed: false, order: 3 },
        { id: generateId(), description: "Create Modal/Dialog component with accessibility", completed: false, order: 4 },
        { id: generateId(), description: "Create Alert component for notifications (success, warning, error, info)", completed: false, order: 5 },
        { id: generateId(), description: "Create Loading spinner and skeleton components", completed: false, order: 6 },
        { id: generateId(), description: "Create Badge and Tag components", completed: false, order: 7 }
      ],
      acceptanceCriteria: [
        "All components have TypeScript prop types",
        "Components follow accessibility best practices",
        "Components support className override for customization",
        "Focus states are visible and meet WCAG requirements",
        "Components work in both light and dark mode"
      ],
      estimatedEffort: "4h",
      tags: ["ui", "components", "tailwind"]
    },
    {
      id: generateId(),
      title: "Set Up Application Shell and Navigation",
      description: "Create the main application layout with responsive navigation, header, and sidebar for the health dashboard.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase1Id,
      phaseName: "Core Setup",
      tasks: [
        { id: generateId(), description: "Create AppShell component with header, sidebar, and main content area", completed: false, order: 1 },
        { id: generateId(), description: "Build responsive Sidebar with navigation links and icons", completed: false, order: 2 },
        { id: generateId(), description: "Create Header with user menu, notifications, and search", completed: false, order: 3 },
        { id: generateId(), description: "Implement mobile navigation with hamburger menu", completed: false, order: 4 },
        { id: generateId(), description: "Add breadcrumb navigation component", completed: false, order: 5 },
        { id: generateId(), description: "Create page transition animations", completed: false, order: 6 }
      ],
      acceptanceCriteria: [
        "Navigation is fully responsive (mobile, tablet, desktop)",
        "Current page is highlighted in navigation",
        "Sidebar can be collapsed on desktop",
        "Mobile menu has smooth open/close animation",
        "Navigation is keyboard accessible"
      ],
      estimatedEffort: "4h",
      tags: ["layout", "navigation", "responsive"]
    }
  ]

  // ========== PHASE 2: Core Features ==========
  const phase2Packets: WorkPacket[] = [
    {
      id: generateId(),
      title: "Implement User Authentication System",
      description: "Build a complete authentication system with email/password login, session management, and protected routes.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase2Id,
      phaseName: "Core Features",
      tasks: [
        { id: generateId(), description: "Create auth context and provider (src/lib/auth/)", completed: false, order: 1 },
        { id: generateId(), description: "Build login page with email/password form", completed: false, order: 2 },
        { id: generateId(), description: "Build registration page with validation", completed: false, order: 3 },
        { id: generateId(), description: "Implement password hashing with bcrypt", completed: false, order: 4 },
        { id: generateId(), description: "Create session management with JWT or cookies", completed: false, order: 5 },
        { id: generateId(), description: "Add middleware for protected routes", completed: false, order: 6 },
        { id: generateId(), description: "Create password reset flow", completed: false, order: 7 },
        { id: generateId(), description: "Add logout functionality", completed: false, order: 8 }
      ],
      acceptanceCriteria: [
        "Users can register with email and password",
        "Users can log in and maintain session",
        "Protected routes redirect to login when unauthenticated",
        "Passwords are securely hashed",
        "Session persists across browser refresh",
        "Logout clears session completely"
      ],
      estimatedEffort: "6h",
      tags: ["auth", "security", "users"],
      dependencies: []
    },
    {
      id: generateId(),
      title: "Build Health Metrics Dashboard",
      description: "Create the main dashboard showing health metrics overview with charts, recent entries, and quick actions.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase2Id,
      phaseName: "Core Features",
      tasks: [
        { id: generateId(), description: "Create dashboard page layout with grid of metric cards", completed: false, order: 1 },
        { id: generateId(), description: "Build MetricCard component showing current value and trend", completed: false, order: 2 },
        { id: generateId(), description: "Integrate chart library (recharts or chart.js) for trend visualization", completed: false, order: 3 },
        { id: generateId(), description: "Create recent entries list with quick actions", completed: false, order: 4 },
        { id: generateId(), description: "Add date range selector for filtering data", completed: false, order: 5 },
        { id: generateId(), description: "Implement real-time data refresh", completed: false, order: 6 },
        { id: generateId(), description: "Create empty state for new users", completed: false, order: 7 }
      ],
      acceptanceCriteria: [
        "Dashboard loads within 1 second",
        "Charts display correctly with user data",
        "Metric cards show accurate current values",
        "Trends are calculated correctly (up/down/stable)",
        "Date range filtering works correctly",
        "Empty state guides new users to add data"
      ],
      estimatedEffort: "6h",
      tags: ["dashboard", "charts", "metrics"]
    },
    {
      id: generateId(),
      title: "Implement Health Data Entry Forms",
      description: "Create forms for logging various health metrics: weight, blood pressure, blood sugar, sleep, exercise, etc.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase2Id,
      phaseName: "Core Features",
      tasks: [
        { id: generateId(), description: "Create generic HealthEntryForm component with metric type selection", completed: false, order: 1 },
        { id: generateId(), description: "Build weight entry form with unit conversion (kg/lbs)", completed: false, order: 2 },
        { id: generateId(), description: "Build blood pressure form (systolic/diastolic)", completed: false, order: 3 },
        { id: generateId(), description: "Build blood sugar/glucose form with meal timing", completed: false, order: 4 },
        { id: generateId(), description: "Build sleep tracking form (duration, quality)", completed: false, order: 5 },
        { id: generateId(), description: "Build exercise log form (type, duration, intensity)", completed: false, order: 6 },
        { id: generateId(), description: "Add notes field and date/time picker to all forms", completed: false, order: 7 },
        { id: generateId(), description: "Implement form validation with helpful error messages", completed: false, order: 8 }
      ],
      acceptanceCriteria: [
        "All forms validate input before submission",
        "Data is saved correctly to the database",
        "Unit conversions are accurate",
        "Date/time defaults to current but is editable",
        "Success feedback is shown after saving",
        "Forms are accessible with keyboard navigation"
      ],
      estimatedEffort: "5h",
      tags: ["forms", "data-entry", "health-tracking"]
    },
    {
      id: generateId(),
      title: "Create Health History and Trends View",
      description: "Build a comprehensive view of health data history with filtering, sorting, and export capabilities.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase2Id,
      phaseName: "Core Features",
      tasks: [
        { id: generateId(), description: "Create history page with tabular data view", completed: false, order: 1 },
        { id: generateId(), description: "Add filtering by metric type, date range", completed: false, order: 2 },
        { id: generateId(), description: "Implement sorting by date, value, metric type", completed: false, order: 3 },
        { id: generateId(), description: "Add pagination for large datasets", completed: false, order: 4 },
        { id: generateId(), description: "Create detailed trend charts with zoom capability", completed: false, order: 5 },
        { id: generateId(), description: "Add ability to edit/delete individual entries", completed: false, order: 6 },
        { id: generateId(), description: "Implement CSV export functionality", completed: false, order: 7 }
      ],
      acceptanceCriteria: [
        "History loads efficiently with pagination",
        "Filters work correctly and can be combined",
        "Sorting is fast and maintains filter state",
        "Edit/delete requires confirmation",
        "CSV export includes all filtered data",
        "Charts handle large date ranges gracefully"
      ],
      estimatedEffort: "5h",
      tags: ["history", "data-visualization", "export"]
    },
    {
      id: generateId(),
      title: "Build Appointment Management System",
      description: "Create a complete appointment scheduling and management system with calendar view and reminders.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase2Id,
      phaseName: "Core Features",
      tasks: [
        { id: generateId(), description: "Create appointments list page with upcoming/past tabs", completed: false, order: 1 },
        { id: generateId(), description: "Build calendar view component (month/week/day views)", completed: false, order: 2 },
        { id: generateId(), description: "Create appointment creation form", completed: false, order: 3 },
        { id: generateId(), description: "Add appointment detail view with edit capability", completed: false, order: 4 },
        { id: generateId(), description: "Implement appointment status management (scheduled, completed, cancelled)", completed: false, order: 5 },
        { id: generateId(), description: "Add provider/doctor management", completed: false, order: 6 },
        { id: generateId(), description: "Create appointment notes and preparation checklist", completed: false, order: 7 }
      ],
      acceptanceCriteria: [
        "Calendar displays all appointments correctly",
        "Appointments can be created with all required fields",
        "Past appointments are archived but accessible",
        "Provider information is saved and reusable",
        "Appointment conflicts are detected and warned",
        "Notes can be added before and after appointments"
      ],
      estimatedEffort: "6h",
      tags: ["appointments", "calendar", "scheduling"]
    },
    {
      id: generateId(),
      title: "Implement User Profile and Settings",
      description: "Build user profile management with personal info, health goals, preferences, and notification settings.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase2Id,
      phaseName: "Core Features",
      tasks: [
        { id: generateId(), description: "Create profile page with personal information form", completed: false, order: 1 },
        { id: generateId(), description: "Add health profile section (DOB, height, blood type, allergies)", completed: false, order: 2 },
        { id: generateId(), description: "Build health goals section with target metrics", completed: false, order: 3 },
        { id: generateId(), description: "Create settings page with preferences", completed: false, order: 4 },
        { id: generateId(), description: "Add unit preferences (metric/imperial)", completed: false, order: 5 },
        { id: generateId(), description: "Implement theme preference (light/dark/system)", completed: false, order: 6 },
        { id: generateId(), description: "Add data export/import options", completed: false, order: 7 },
        { id: generateId(), description: "Create account deletion flow", completed: false, order: 8 }
      ],
      acceptanceCriteria: [
        "Profile information is saved and persisted",
        "Health goals appear on dashboard for tracking",
        "Unit preferences are applied throughout the app",
        "Theme changes immediately without refresh",
        "Data can be exported in standard format",
        "Account deletion requires confirmation and removes all data"
      ],
      estimatedEffort: "4h",
      tags: ["profile", "settings", "preferences"]
    }
  ]

  // ========== PHASE 3: Advanced Features ==========
  const phase3Packets: WorkPacket[] = [
    {
      id: generateId(),
      title: "Build AI-Powered Symptom Triage System",
      description: "Create an intelligent symptom checker that helps users understand their symptoms and provides guidance on seeking care.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase3Id,
      phaseName: "Advanced Features",
      tasks: [
        { id: generateId(), description: "Create symptom input interface with body map or searchable list", completed: false, order: 1 },
        { id: generateId(), description: "Build symptom questionnaire flow (duration, severity, associated symptoms)", completed: false, order: 2 },
        { id: generateId(), description: "Integrate local LLM for symptom analysis", completed: false, order: 3 },
        { id: generateId(), description: "Create triage result display with urgency levels", completed: false, order: 4 },
        { id: generateId(), description: "Add care recommendation suggestions (self-care, urgent care, ER)", completed: false, order: 5 },
        { id: generateId(), description: "Implement symptom history logging", completed: false, order: 6 },
        { id: generateId(), description: "Add medical disclaimer and liability notices", completed: false, order: 7 },
        { id: generateId(), description: "Create follow-up symptom tracking", completed: false, order: 8 }
      ],
      acceptanceCriteria: [
        "Users can describe symptoms in natural language",
        "System asks relevant follow-up questions",
        "Triage results clearly communicate urgency level",
        "Recommendations are appropriate and safe",
        "Medical disclaimers are prominently displayed",
        "Symptom history is saved for doctor visits"
      ],
      estimatedEffort: "8h",
      tags: ["ai", "symptoms", "triage", "llm"]
    },
    {
      id: generateId(),
      title: "Implement Medical Bill Scanner and Analyzer",
      description: "Build OCR-powered medical bill scanning with cost breakdown, error detection, and explanation of charges.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase3Id,
      phaseName: "Advanced Features",
      tasks: [
        { id: generateId(), description: "Create bill upload interface (photo capture and file upload)", completed: false, order: 1 },
        { id: generateId(), description: "Integrate OCR library (tesseract.js) for text extraction", completed: false, order: 2 },
        { id: generateId(), description: "Build bill parser to identify line items, codes, and amounts", completed: false, order: 3 },
        { id: generateId(), description: "Create LLM integration for charge explanation", completed: false, order: 4 },
        { id: generateId(), description: "Build cost breakdown visualization", completed: false, order: 5 },
        { id: generateId(), description: "Add common billing error detection", completed: false, order: 6 },
        { id: generateId(), description: "Create bill history and comparison view", completed: false, order: 7 },
        { id: generateId(), description: "Add export for insurance claims", completed: false, order: 8 }
      ],
      acceptanceCriteria: [
        "Bills can be uploaded via camera or file",
        "OCR accurately extracts text from clear images",
        "Line items are parsed and categorized",
        "Charge explanations are understandable to laypeople",
        "Potential errors are flagged with explanations",
        "Bill history is searchable and sortable"
      ],
      estimatedEffort: "8h",
      tags: ["ocr", "bills", "ai", "finance"]
    },
    {
      id: generateId(),
      title: "Add Comprehensive Accessibility Features",
      description: "Implement WCAG 2.1 AA compliance with screen reader support, keyboard navigation, and accessibility preferences.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase3Id,
      phaseName: "Advanced Features",
      tasks: [
        { id: generateId(), description: "Audit all components for accessibility issues", completed: false, order: 1 },
        { id: generateId(), description: "Add proper ARIA labels and roles throughout", completed: false, order: 2 },
        { id: generateId(), description: "Implement skip navigation links", completed: false, order: 3 },
        { id: generateId(), description: "Ensure all interactive elements have focus indicators", completed: false, order: 4 },
        { id: generateId(), description: "Add high contrast mode option", completed: false, order: 5 },
        { id: generateId(), description: "Implement font size adjustment controls", completed: false, order: 6 },
        { id: generateId(), description: "Add reduce motion preference support", completed: false, order: 7 },
        { id: generateId(), description: "Test with screen readers (VoiceOver, NVDA)", completed: false, order: 8 },
        { id: generateId(), description: "Create accessibility statement page", completed: false, order: 9 }
      ],
      acceptanceCriteria: [
        "All pages pass WCAG 2.1 AA automated checks",
        "App is fully navigable via keyboard",
        "Screen reader announces all content correctly",
        "Color contrast meets 4.5:1 ratio minimum",
        "Animations can be disabled via system preference",
        "Text can be resized up to 200% without loss of content"
      ],
      estimatedEffort: "6h",
      tags: ["accessibility", "a11y", "wcag"]
    },
    {
      id: generateId(),
      title: "Build Medication Tracking and Reminders",
      description: "Create medication management with scheduling, dosage tracking, refill reminders, and interaction warnings.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase3Id,
      phaseName: "Advanced Features",
      tasks: [
        { id: generateId(), description: "Create medication list management interface", completed: false, order: 1 },
        { id: generateId(), description: "Build medication entry form (name, dosage, frequency, instructions)", completed: false, order: 2 },
        { id: generateId(), description: "Implement dose logging and tracking", completed: false, order: 3 },
        { id: generateId(), description: "Create medication schedule view with today's doses", completed: false, order: 4 },
        { id: generateId(), description: "Add refill tracking and reminders", completed: false, order: 5 },
        { id: generateId(), description: "Implement basic drug interaction checking", completed: false, order: 6 },
        { id: generateId(), description: "Create adherence reports and statistics", completed: false, order: 7 },
        { id: generateId(), description: "Add medication photo storage for identification", completed: false, order: 8 }
      ],
      acceptanceCriteria: [
        "Medications can be added with complete details",
        "Schedule shows all due medications clearly",
        "Doses can be logged with one tap/click",
        "Refill reminders trigger before running out",
        "Interaction warnings are displayed when relevant",
        "Adherence percentage is calculated accurately"
      ],
      estimatedEffort: "6h",
      tags: ["medications", "reminders", "tracking"]
    },
    {
      id: generateId(),
      title: "Implement Health Report Generation",
      description: "Build automated health report generation for doctor visits with customizable time ranges and metric selection.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase3Id,
      phaseName: "Advanced Features",
      tasks: [
        { id: generateId(), description: "Create report configuration interface", completed: false, order: 1 },
        { id: generateId(), description: "Build date range selector with presets", completed: false, order: 2 },
        { id: generateId(), description: "Add metric selection checkboxes", completed: false, order: 3 },
        { id: generateId(), description: "Generate summary statistics for selected metrics", completed: false, order: 4 },
        { id: generateId(), description: "Create printable report layout", completed: false, order: 5 },
        { id: generateId(), description: "Add PDF export functionality", completed: false, order: 6 },
        { id: generateId(), description: "Include charts and trend visualizations", completed: false, order: 7 },
        { id: generateId(), description: "Add report history and saved templates", completed: false, order: 8 }
      ],
      acceptanceCriteria: [
        "Reports include selected metrics and date range",
        "Statistics are accurate and clearly presented",
        "PDF exports are properly formatted",
        "Charts are readable in print format",
        "Reports include relevant context for doctors",
        "Previous reports are saved and accessible"
      ],
      estimatedEffort: "5h",
      tags: ["reports", "export", "pdf"]
    },
    {
      id: generateId(),
      title: "Add Data Backup and Sync Capabilities",
      description: "Implement data backup, restore, and optional cloud sync for data persistence and multi-device access.",
      type: "feature",
      priority: "high",
      status: "ready",
      phaseId: phase3Id,
      phaseName: "Advanced Features",
      tasks: [
        { id: generateId(), description: "Create local backup to file system", completed: false, order: 1 },
        { id: generateId(), description: "Build backup encryption with user password", completed: false, order: 2 },
        { id: generateId(), description: "Implement backup restore functionality", completed: false, order: 3 },
        { id: generateId(), description: "Add automatic backup scheduling", completed: false, order: 4 },
        { id: generateId(), description: "Create backup management UI (list, delete, restore)", completed: false, order: 5 },
        { id: generateId(), description: "Implement data integrity validation", completed: false, order: 6 },
        { id: generateId(), description: "Add backup reminder notifications", completed: false, order: 7 }
      ],
      acceptanceCriteria: [
        "Backups include all user data",
        "Backups are encrypted and secure",
        "Restore recreates exact data state",
        "Automatic backups run on schedule",
        "Corrupted backups are detected and reported",
        "Users can manage backup history"
      ],
      estimatedEffort: "5h",
      tags: ["backup", "data", "security"]
    }
  ]

  // Combine all packets
  const allPackets = [...phase1Packets, ...phase2Packets, ...phase3Packets]

  // Create phases with packet IDs
  const phases: BuildPhase[] = [
    {
      id: phase1Id,
      name: "Phase 1: Core Setup",
      description: "Foundation setup including Next.js, Tailwind CSS, database schema, base components, and application shell.",
      order: 1,
      packetIds: phase1Packets.map(p => p.id)
    },
    {
      id: phase2Id,
      name: "Phase 2: Core Features",
      description: "Essential features including authentication, health tracking, data visualization, appointments, and user settings.",
      order: 2,
      packetIds: phase2Packets.map(p => p.id)
    },
    {
      id: phase3Id,
      name: "Phase 3: Advanced Features",
      description: "Advanced capabilities including AI symptom triage, bill scanning, accessibility, medications, reports, and backup.",
      order: 3,
      packetIds: phase3Packets.map(p => p.id)
    }
  ]

  return {
    projectName: "HyperHealth",
    projectDescription: "A comprehensive personal health management application with health tracking, appointment management, AI-powered symptom triage, medical bill analysis, and accessibility-first design.",
    version: "1.0.0",
    createdAt: now,
    phases,
    packets: allPackets,
    techStack: [
      "Next.js 14 (App Router)",
      "TypeScript",
      "Tailwind CSS",
      "SQLite (better-sqlite3)",
      "React 18",
      "Recharts (charts)",
      "Tesseract.js (OCR)",
      "Local LLM Integration"
    ],
    objectives: [
      "Create a user-friendly health tracking dashboard",
      "Enable easy logging of various health metrics",
      "Provide appointment management with calendar view",
      "Implement AI-assisted symptom analysis",
      "Build medical bill scanning and analysis",
      "Ensure WCAG 2.1 AA accessibility compliance",
      "Support medication tracking with reminders",
      "Generate comprehensive health reports for doctor visits"
    ],
    nonGoals: [
      "Integration with external health APIs (Apple Health, Google Fit) - future phase",
      "Telemedicine or video consultation features",
      "Prescription ordering or pharmacy integration",
      "Insurance claim submission",
      "Multi-user/family accounts - future phase",
      "Mobile native apps (PWA only for now)"
    ]
  }
}

// ============================================
// localStorage Simulation (for Node.js)
// ============================================

function loadFromLocalStorage(key: string): HyperHealthBuildPlan | null {
  const storagePath = path.join(__dirname, '..', '.local-storage', `${key}.json`)
  if (fs.existsSync(storagePath)) {
    try {
      const data = fs.readFileSync(storagePath, 'utf-8')
      return JSON.parse(data)
    } catch (e) {
      console.log(`Failed to load from storage: ${e}`)
      return null
    }
  }
  return null
}

function saveToLocalStorage(key: string, data: HyperHealthBuildPlan): void {
  const storageDir = path.join(__dirname, '..', '.local-storage')
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true })
  }
  const storagePath = path.join(storageDir, `${key}.json`)
  fs.writeFileSync(storagePath, JSON.stringify(data, null, 2))
  console.log(`Saved to local storage: ${storagePath}`)
}

// ============================================
// Main Execution
// ============================================

async function main() {
  console.log('='.repeat(60))
  console.log('  HyperHealth Work Packets Setup')
  console.log('  Claudia - AI Development Orchestrator')
  console.log('='.repeat(60))
  console.log('')

  // Try to load existing build plan from localStorage
  const storageKey = 'hyperhealth-build-plan'
  let buildPlan = loadFromLocalStorage(storageKey)

  if (buildPlan) {
    console.log('Found existing build plan in local storage.')
    console.log(`  Version: ${buildPlan.version}`)
    console.log(`  Created: ${buildPlan.createdAt}`)
    console.log(`  Phases: ${buildPlan.phases.length}`)
    console.log(`  Packets: ${buildPlan.packets.length}`)
    console.log('')
    console.log('Using existing plan. Delete .local-storage/hyperhealth-build-plan.json to regenerate.')
  } else {
    console.log('No existing build plan found. Creating default packets...')
    console.log('')
    buildPlan = createHyperHealthBuildPlan()
    saveToLocalStorage(storageKey, buildPlan)
  }

  // Output summary
  console.log('')
  console.log('Build Plan Summary:')
  console.log('-'.repeat(40))
  console.log(`Project: ${buildPlan.projectName}`)
  console.log(`Description: ${buildPlan.projectDescription.slice(0, 80)}...`)
  console.log('')

  for (const phase of buildPlan.phases) {
    const phasePackets = buildPlan.packets.filter(p => p.phaseId === phase.id)
    console.log(`${phase.name}`)
    console.log(`  Packets: ${phasePackets.length}`)
    for (const packet of phasePackets) {
      console.log(`    - ${packet.title}`)
    }
    console.log('')
  }

  console.log('Tech Stack:')
  for (const tech of buildPlan.techStack) {
    console.log(`  - ${tech}`)
  }
  console.log('')

  // Write output JSON for Claudia import
  const outputDir = path.join(__dirname, '..', 'generated')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, 'hyperhealth-packets.json')
  fs.writeFileSync(outputPath, JSON.stringify(buildPlan, null, 2))
  console.log(`Output written to: ${outputPath}`)
  console.log('')

  // Also write individual packet files for easy inspection
  const packetsDir = path.join(outputDir, 'hyperhealth-packets')
  if (!fs.existsSync(packetsDir)) {
    fs.mkdirSync(packetsDir, { recursive: true })
  }

  for (const packet of buildPlan.packets) {
    const packetFileName = packet.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
    const packetPath = path.join(packetsDir, `${packetFileName}.json`)
    fs.writeFileSync(packetPath, JSON.stringify(packet, null, 2))
  }
  console.log(`Individual packets written to: ${packetsDir}`)
  console.log('')

  // Output statistics
  const totalTasks = buildPlan.packets.reduce((sum, p) => sum + p.tasks.length, 0)
  const totalCriteria = buildPlan.packets.reduce((sum, p) => sum + p.acceptanceCriteria.length, 0)

  console.log('Statistics:')
  console.log('-'.repeat(40))
  console.log(`  Total Phases: ${buildPlan.phases.length}`)
  console.log(`  Total Packets: ${buildPlan.packets.length}`)
  console.log(`  Total Tasks: ${totalTasks}`)
  console.log(`  Total Acceptance Criteria: ${totalCriteria}`)
  console.log(`  Average Tasks per Packet: ${(totalTasks / buildPlan.packets.length).toFixed(1)}`)
  console.log('')

  console.log('To import into Claudia:')
  console.log(`  1. Open Claudia Admin at http://localhost:3000`)
  console.log(`  2. Go to Projects > Import`)
  console.log(`  3. Upload: ${outputPath}`)
  console.log('')
  console.log('Or load directly in browser console:')
  console.log(`  localStorage.setItem('hyperhealth-build-plan', JSON.stringify(data))`)
  console.log('')
  console.log('Done!')
}

main().catch(console.error)
