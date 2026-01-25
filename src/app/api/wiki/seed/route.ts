/**
 * Wiki Seed API - Populates wiki with comprehensive Claudia Coder documentation
 */

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/middleware"
import { WikiDocType, CLAUDIA_CODER_WIKI_ID, bulkCreateWikiDocuments } from "@/lib/data/server-wiki"

interface SeedDocument {
  title: string
  content: string
  type: WikiDocType
  tags: string[]
}

const CLAUDIA_CODER_DOCS: SeedDocument[] = [
  // ============================================
  // GETTING STARTED
  // ============================================
  {
    title: "Getting Started with Claudia Coder",
    type: "guide",
    tags: ["getting-started", "setup", "introduction"],
    content: `# Getting Started with Claudia Coder

## What is Claudia Coder?

Claudia Coder is an AI-powered development orchestration platform that helps you plan, build, and iterate on software projects. It combines multiple AI agents, intelligent project management, and automated execution to accelerate your development workflow.

## Key Features

- **Project Management** - Organize and track development projects
- **AI-Assisted Ideation** - Brainstorm and refine project requirements
- **Build Planning** - Generate structured work packets from requirements
- **Claude Code Integration** - Embedded AI terminal for code generation
- **Documentation Wiki** - Maintain project and system documentation
- **Voice Interface** - Natural voice input for ideas and commands

## Quick Start

### 1. Access the Dashboard
Navigate to the dashboard at \`/\` to see your projects overview, recent activity, and quick actions.

### 2. Create a Project
1. Click "New Project" or navigate to \`/projects/new\`
2. Enter project details:
   - Name and description
   - Category (web, mobile, api, cli, library)
   - Priority level
3. Optionally connect a Git repository

### 3. Define Requirements
Use the Ideas Explorer on your project page to:
- Describe what you want to build
- Let AI help clarify and expand requirements
- Generate a structured project brief

### 4. Generate Build Plan
Click "Generate Build Plan" to:
- Create work packets from your requirements
- Organize packets into phases and milestones
- Define acceptance criteria for each packet

### 5. Execute with Claude Code
Navigate to **Tools > Claude Code** to:
- Select your project
- Start an AI-assisted coding session
- Execute work packets with AI guidance

## Navigation

| Section | Path | Purpose |
|---------|------|---------|
| Dashboard | \`/\` | Overview and quick actions |
| Projects | \`/projects\` | Project listing and management |
| Claude Code | \`/claude-code\` | AI terminal sessions |
| Wiki | \`/wiki\` | Documentation |
| Settings | \`/settings\` | User preferences |

## Next Steps

- Read the [Architecture Overview](#) to understand the system
- Explore the [API Reference](#) for integrations
- Check the [Component Library](#) for UI patterns
`,
  },

  // ============================================
  // ARCHITECTURE
  // ============================================
  {
    title: "Architecture Overview",
    type: "architecture",
    tags: ["architecture", "overview", "system-design"],
    content: `# Architecture Overview

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 + Radix UI + shadcn/ui |
| State | React Context + Custom Hooks |
| Database | Better SQLite3 (embedded) |
| Auth | Better Auth |
| Terminal | xterm.js + node-pty |
| AI | Anthropic Claude API |

## System Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    Next.js Application                   │
├─────────────────────────────────────────────────────────┤
│  Pages (App Router)  │  API Routes  │  Components       │
├─────────────────────────────────────────────────────────┤
│                    Data Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ localStorage │  │  IndexedDB  │  │  SQLite DB  │     │
│  │   (cache)    │  │  (blobs)    │  │ (permanent) │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
├─────────────────────────────────────────────────────────┤
│                 External Services                        │
│  Claude API  │  Local LLM  │  Gitea  │  n8n            │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Key Architectural Patterns

### 1. User-Scoped Data Isolation
All user data is prefixed: \`claudia_user_{userId}_{key}\`
- Ensures complete isolation between users
- Prevents data leakage
- Simplifies multi-tenancy

### 2. API-First Data Layer
- localStorage serves as a fast cache
- Server API routes are the source of truth
- All mutations go through API first, then update cache

### 3. Composable Provider Stack
\`\`\`tsx
<AuthProvider>
  <MigrationProvider>
    <AppShell>
      {children}
    </AppShell>
  </MigrationProvider>
</AuthProvider>
\`\`\`

### 4. Feature-Based Organization
Components and logic organized by domain:
- \`/project\` - Project management
- \`/execution\` - Build execution
- \`/claude-code\` - Terminal integration

## Data Flow

\`\`\`
User Action
    │
    ▼
React Component
    │
    ├──▶ Read from localStorage (instant UI)
    │
    ├──▶ Call API Route
    │         │
    │         ▼
    │    Server Logic
    │         │
    │         ▼
    │    Update Database
    │         │
    │         ▼
    │    Return Response
    │
    ▼
Update localStorage + Re-render
\`\`\`

## Security Model

- **Authentication** - Session-based with Better Auth
- **Authorization** - Role-based (admin, beta_tester, user)
- **Sandboxing** - Beta users restricted to sandbox directories
- **Input Validation** - Prompt injection filtering for AI inputs
`,
  },

  // ============================================
  // PROJECT STRUCTURE
  // ============================================
  {
    title: "Project Structure",
    type: "reference",
    tags: ["structure", "directories", "organization"],
    content: `# Project Structure

## Directory Layout

\`\`\`
claudia-admin/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API endpoints
│   │   │   ├── projects/      # Project CRUD
│   │   │   ├── wiki/          # Wiki CRUD
│   │   │   ├── claude-code/   # Terminal sessions
│   │   │   ├── execute/       # Execution engine
│   │   │   ├── auth/          # Authentication
│   │   │   └── admin/         # Admin endpoints
│   │   ├── projects/          # Project pages
│   │   ├── claude-code/       # Claude Code pages
│   │   ├── wiki/              # Wiki pages
│   │   ├── settings/          # Settings pages
│   │   └── admin/             # Admin pages
│   │
│   ├── components/            # React components
│   │   ├── ui/               # Base UI (shadcn/ui)
│   │   ├── project/          # Project components
│   │   ├── execution/        # Execution components
│   │   ├── claude-code/      # Terminal components
│   │   ├── dashboard/        # Dashboard widgets
│   │   ├── auth/             # Auth components
│   │   └── sidebar.tsx       # Main navigation
│   │
│   ├── lib/                   # Core utilities
│   │   ├── data/             # Data layer
│   │   │   ├── projects.ts   # Project operations
│   │   │   ├── wiki.ts       # Wiki operations
│   │   │   ├── types.ts      # TypeScript types
│   │   │   └── user-storage.ts
│   │   ├── ai/               # AI integration
│   │   ├── auth/             # Auth utilities
│   │   └── security/         # Security utilities
│   │
│   └── hooks/                 # Custom React hooks
│       ├── useProjects.ts
│       ├── useAuth.ts
│       └── useEmergentModules.ts
│
├── .claude/                   # Claude Code config
│   ├── settings.json         # Permissions & hooks
│   ├── rules/                # Enforcement rules
│   └── skills/               # Custom skills
│
├── public/                    # Static assets
└── tests/                     # Test files
\`\`\`

## Key Files

| File | Purpose |
|------|---------|
| \`src/components/sidebar.tsx\` | Main navigation (~650 lines) |
| \`src/components/app-shell.tsx\` | Layout wrapper |
| \`src/lib/data/types.ts\` | Core TypeScript interfaces |
| \`src/lib/data/projects.ts\` | Project data operations |
| \`src/lib/data/user-storage.ts\` | User-scoped storage utilities |

## Naming Conventions

- **Pages**: \`page.tsx\` in route directory
- **Components**: PascalCase (\`MyComponent.tsx\`)
- **Utilities**: camelCase (\`myUtility.ts\`)
- **Types**: PascalCase interfaces (\`interface MyType\`)
- **Hooks**: \`use\` prefix (\`useMyHook.ts\`)

## Import Aliases

\`\`\`typescript
// @ maps to ./src
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth/auth-provider"
import { getAllProjects } from "@/lib/data/projects"
\`\`\`
`,
  },

  // ============================================
  // DATA LAYER
  // ============================================
  {
    title: "Data Layer & Storage",
    type: "architecture",
    tags: ["data", "storage", "database"],
    content: `# Data Layer & Storage

## Storage Architecture

Claudia Coder uses a layered storage approach for performance and reliability.

### Layer 1: localStorage (User-Scoped Cache)

**Purpose**: Fast initial page loads with user isolation

**Key Format**: \`claudia_user_{userId}_{baseKey}\`

**Storage Keys**:
\`\`\`typescript
USER_STORAGE_KEYS = {
  PROJECTS: "projects",
  BUILD_PLANS: "build_plans",
  PACKET_RUNS: "packet_runs",
  RESOURCES: "resources",
  BRAIN_DUMPS: "brain_dumps",
  INTERVIEWS: "interviews",
  WIKI_DOCUMENTS: "wiki_documents",
}
\`\`\`

**Usage**:
\`\`\`typescript
import { getUserStorageItem, setUserStorageItem } from "@/lib/data/user-storage"

// Read (returns null if not found)
const data = getUserStorageItem<Project[]>(userId, "projects")

// Write
setUserStorageItem(userId, "projects", projectsArray)
\`\`\`

### Layer 2: IndexedDB

**Purpose**: Large binary data storage

**Use Cases**:
- Voice recordings
- Resource blobs
- Image uploads

### Layer 3: Filesystem (Server-side)

**Paths**:
- Voice recordings: \`.local-storage/voice-recordings/{userId}/\`
- Module registry: \`.local-storage/emergent-modules.json\`
- Project workspaces: \`~/claudia-projects/{project-slug}/\`
- Claude sessions: \`.local-storage/claude-sessions.json\`

### Layer 4: SQLite Database

**Purpose**: Permanent structured data

**Tables**:
- User accounts and sessions
- Beta invites and referrals
- NDA signatures
- Audit logs

## Data Models

### Project
\`\`\`typescript
interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  category: ProjectCategory
  priority: ProjectPriority
  complexity: number          // 1-5
  repos: ProjectRepo[]
  workingDirectory?: string
  createdAt: string
  updatedAt: string
  userId: string
  tags?: string[]
}

type ProjectStatus =
  | "ideation" | "planning" | "development"
  | "testing" | "review" | "completed"
  | "on_hold" | "cancelled"

type ProjectCategory =
  | "web" | "mobile" | "api" | "cli"
  | "library" | "automation" | "other"
\`\`\`

### Wiki Document
\`\`\`typescript
interface WikiDocument {
  id: string
  title: string
  slug: string
  content: string              // Markdown
  type: WikiDocType
  tags: string[]
  parentId?: string           // For nesting
  projectId?: string          // Scope
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  isPublished: boolean
}

type WikiDocType =
  | "architecture" | "api" | "component"
  | "changelog" | "guide" | "reference"
  | "runbook" | "decision" | "custom"
\`\`\`

## Data Operations Pattern

All data operations follow this pattern:

\`\`\`typescript
// 1. Define the operation
export async function updateProject(id: string, updates: Partial<Project>) {
  // 2. Call API first (source of truth)
  const response = await fetch(\`/api/projects/\${id}\`, {
    method: "PUT",
    body: JSON.stringify(updates),
  })

  // 3. Get updated data
  const { project } = await response.json()

  // 4. Update localStorage cache
  const projects = getUserStorageItem<Project[]>(userId, "projects") || []
  const index = projects.findIndex(p => p.id === id)
  if (index >= 0) {
    projects[index] = project
    setUserStorageItem(userId, "projects", projects)
  }

  return project
}
\`\`\`
`,
  },

  // ============================================
  // AUTHENTICATION
  // ============================================
  {
    title: "Authentication & Authorization",
    type: "guide",
    tags: ["auth", "security", "roles"],
    content: `# Authentication & Authorization

## Authentication Framework

Claudia Coder uses **Better Auth** for authentication with SQLite backend.

## User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| \`admin\` | Full system access | All features, admin panel |
| \`beta_tester\` | Beta features with limits | Limited executions, sandboxed |
| \`user\` | Standard access | Basic features |

## Auth Provider

Wrap your app with AuthProvider:

\`\`\`tsx
// src/components/auth/auth-provider.tsx
import { useAuth } from "@/components/auth/auth-provider"

function MyComponent() {
  const {
    user,           // Current user object
    isAuthenticated, // Boolean auth status
    isLoading,      // Loading state
    role,           // User role
    isBetaTester,   // Beta tester check
    betaLimits,     // Usage limits
  } = useAuth()

  if (!isAuthenticated) {
    return <LoginPrompt />
  }

  return <Dashboard user={user} />
}
\`\`\`

## Server-Side Auth

Use middleware for API routes:

\`\`\`typescript
// API route protection
import { getCurrentUser } from "@/lib/auth/middleware"

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  // Admin-only check
  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    )
  }

  // Handle authorized request
  return NextResponse.json({ data: "..." })
}
\`\`\`

## Beta Limits

Beta testers have usage limits:

\`\`\`typescript
interface BetaLimits {
  current: {
    projects: number      // Current project count
    executions: number    // Executions today
  }
  limits: {
    projects: number      // Max projects allowed
    executions: number    // Max executions per day
  }
}

// Check in component
const { betaLimits } = useAuth()
if (betaLimits.current.projects >= betaLimits.limits.projects) {
  showUpgradePrompt()
}
\`\`\`

## Development Mode

For development, auth bypass is available:

\`\`\`typescript
// In auth-provider.tsx
const AUTH_BYPASS_MODE = process.env.NEXT_PUBLIC_BETA_AUTH_BYPASS === "true"

// When enabled, provides default user:
// { id: "beta-admin", role: "admin", ... }
\`\`\`

## Sandbox Security

Beta testers operate in a sandboxed environment:

- **Restricted Paths**: Can only access \`~/claudia-sandbox/{userId}/\`
- **Protected Paths**: System directories blocked
- **Prompt Injection**: AI inputs filtered for injection attempts

\`\`\`typescript
// Check if path is allowed
const validation = validateProjectPath(path, userId, {
  requireInSandbox: true,
  allowProtectedPaths: false,
})

if (!validation.valid) {
  return { error: validation.error }
}
\`\`\`
`,
  },

  // ============================================
  // CLAUDE CODE
  // ============================================
  {
    title: "Claude Code Integration",
    type: "guide",
    tags: ["claude-code", "terminal", "ai"],
    content: `# Claude Code Integration

## Overview

Claude Code provides an embedded AI-powered terminal for interactive development sessions. It runs the Claude CLI within a web-based terminal emulator.

## Features

- **Project Context**: Claude has access to your project files
- **Session Persistence**: Resume previous sessions
- **MCP Servers**: Connect external tools
- **Permission Control**: Optional permission bypassing
- **KICKOFF.md**: Auto-generated project context file

## Using Claude Code

### 1. Navigate to Claude Code
Go to **Tools > Claude Code** in the sidebar.

### 2. Select Project Mode

| Mode | Description |
|------|-------------|
| **Project** | Work on a specific project |
| **Claudia Coder** | Modify the platform itself |
| **Custom Folder** | Work in any directory |

### 3. Configure Options

- **Bypass Permissions**: Skip Claude's permission prompts (trusted environments only)
- **Continue Session**: Resume the most recent session
- **Auto Kickoff**: Auto-send KICKOFF.md to Claude

### 4. Start Session
Click "Start Session" to launch the terminal.

## Technical Implementation

### Terminal Component
\`\`\`typescript
<ClaudeCodeTerminal
  projectId={project.id}
  projectName={project.name}
  projectDescription={project.description}
  workingDirectory="/path/to/project"
  bypassPermissions={false}
  initialPrompt="Help me implement..."
  onSessionEnd={() => handleEnd()}
/>
\`\`\`

### Session Management

Sessions are stored for resume capability:

\`\`\`typescript
interface RecentSession {
  id: string                  // Claudia session ID
  claudeSessionId?: string    // Claude CLI session ID
  projectId: string
  projectName: string
  startedAt: string
  lastActiveAt: string
  workingDirectory?: string
}
\`\`\`

Resume options:
- \`--continue\`: Resume most recent session
- \`--resume {id}\`: Resume specific session by ID

### Working Directory Resolution

1. Check project's \`workingDirectory\` field
2. Fall back to first repo's \`localPath\`
3. Generate: \`~/claudia-projects/{project-slug}/\`

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| \`/api/claude-code\` | POST | Start session |
| \`/api/claude-code\` | GET | SSE stream output |
| \`/api/claude-code\` | PUT | Send input/resize |
| \`/api/claude-code\` | DELETE | Stop session |

### KICKOFF.md Generation

Auto-generated context file includes:
- Project name and description
- Current work packet details
- Repository information
- Special instructions

## MCP Server Integration

Configure MCP servers at \`/claude-code/mcp\`:

\`\`\`json
{
  "servers": [
    {
      "name": "filesystem",
      "enabled": true,
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem"]
    }
  ]
}
\`\`\`

## Troubleshooting

### Session Won't Resume
- Check if \`claudeSessionId\` was captured
- Verify working directory still exists
- Try \`--continue\` instead of \`--resume\`

### Terminal Not Responding
- Check browser console for errors
- Verify Claude CLI is installed: \`which claude\`
- Restart the session

### Permission Errors
- Ensure working directory is accessible
- Beta users: check sandbox restrictions
- Admin users: verify path isn't protected
`,
  },

  // ============================================
  // BUILD PLANNING
  // ============================================
  {
    title: "Build Planning & Execution",
    type: "guide",
    tags: ["build-plan", "execution", "work-packets"],
    content: `# Build Planning & Execution

## Overview

The build planning system converts project requirements into structured work packets that can be executed with AI assistance.

## Work Packets

A work packet is a discrete unit of work:

\`\`\`typescript
interface WorkPacket {
  id: string
  title: string
  description: string
  type: string              // feature, bugfix, refactor, etc.
  priority: "low" | "medium" | "high" | "critical"
  status: "pending" | "in_progress" | "completed" | "failed"
  tasks: Array<{
    id: string
    description: string
    completed: boolean
  }>
  acceptanceCriteria: string[]
  phaseId?: string
  phaseName?: string
  skip?: boolean
}
\`\`\`

## Build Plan Structure

\`\`\`
Build Plan
├── Phase 1: Foundation
│   ├── Milestone: Core Setup
│   │   ├── Packet: Initialize project
│   │   └── Packet: Set up database
│   └── Milestone: Authentication
│       ├── Packet: User model
│       └── Packet: Login flow
├── Phase 2: Features
│   └── ...
└── Phase 3: Polish
    └── ...
\`\`\`

## Generating a Build Plan

### 1. Define Requirements
Use the Ideas Explorer to:
- Describe the project
- Clarify requirements with AI
- Generate a project brief

### 2. Generate Work Packets
Click "Generate Build Plan" to:
- Analyze requirements
- Create structured packets
- Organize into phases

### 3. Review & Adjust
- Reorder packets by dragging
- Edit packet details
- Skip packets you don't need
- Add custom packets

## Execution Modes

| Mode | Description |
|------|-------------|
| **Local** | Execute via Claude Code on your machine |
| **Turbo** | Parallel packet execution |
| **Auto** | Intelligent mode selection |
| **N8N** | External workflow automation |

## Execution Panel

The ExecutionPanel component manages:

- Mode selection dropdown
- Model selection
- Activity stream (real-time events)
- Go/Pause/Stop controls
- Quality gate integration
- Session recovery

### Using the Execution Panel

1. Navigate to your project page
2. Scroll to the Execution Panel
3. Select execution mode
4. Click "Go" to start
5. Monitor the activity stream
6. Pause or stop as needed

## Activity Stream

Real-time event visualization:

\`\`\`typescript
interface ActivityEvent {
  id: string
  type: "info" | "success" | "warning" | "error"
  message: string
  timestamp: string
  packetId?: string
}
\`\`\`

## Session Recovery

Execution sessions are persisted:

\`\`\`typescript
interface ExecutionSession {
  id: string
  projectId: string
  packets: WorkPacket[]
  currentPacketIndex: number
  status: "running" | "paused" | "completed" | "failed"
  activityLog: ActivityEvent[]
  startedAt: string
  updatedAt: string
}
\`\`\`

Recovery features:
- Resume interrupted executions
- Review activity logs
- Retry failed packets

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| \`/api/build-plan/generate\` | POST | Generate work packets |
| \`/api/build-plan/[id]\` | GET | Get build plan |
| \`/api/execute\` | POST | Start execution |
| \`/api/execute/[id]/stream\` | GET | SSE progress stream |
| \`/api/execute/[id]/stop\` | POST | Stop execution |
`,
  },

  // ============================================
  // WIKI SYSTEM
  // ============================================
  {
    title: "Wiki System",
    type: "guide",
    tags: ["wiki", "documentation", "markdown"],
    content: `# Wiki System

## Overview

The Documentation Wiki provides a centralized place for code documentation, change logs, architecture notes, and project-specific documentation.

## Document Scopes

| Scope | ID | Purpose |
|-------|-----|---------|
| **Claudia Coder** | \`__claudia_coder__\` | Platform documentation |
| **Global** | \`__global__\` or undefined | Shared documentation |
| **Project** | Project ID | Project-specific docs |

## Document Types

| Type | Icon | Use Case |
|------|------|----------|
| \`architecture\` | Building | System design, patterns |
| \`api\` | Plug | API endpoints, formats |
| \`component\` | Component | React components |
| \`changelog\` | History | Version updates |
| \`guide\` | Book | How-to guides |
| \`reference\` | File | Quick reference |
| \`runbook\` | Terminal | Operations procedures |
| \`decision\` | Scale | Architecture decisions |
| \`custom\` | File | Other documentation |

## Using the Wiki

### Viewing Documents
1. Navigate to **Tools > Wiki**
2. Use the scope selector to filter:
   - All Documentation
   - Claudia Coder
   - Global Docs
   - Specific project
3. Click a document to view

### Creating Documents
1. Select the appropriate scope
2. Click "New Document"
3. Fill in:
   - Title
   - Type
   - Tags (comma-separated)
4. Write content in Markdown
5. Click Save

### Editing Documents
1. Select the document
2. Click "Edit"
3. Modify content
4. Preview changes
5. Save

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| \`/api/wiki\` | GET | List documents |
| \`/api/wiki\` | POST | Create document |
| \`/api/wiki/[id]\` | GET | Get document |
| \`/api/wiki/[id]\` | PUT | Update document |
| \`/api/wiki/[id]\` | DELETE | Delete document |
| \`/api/wiki/seed\` | POST | Seed initial docs |

### Query Parameters (GET /api/wiki)

- \`type\` - Filter by document type
- \`projectId\` - Filter by project
- \`tag\` - Filter by tag
- \`search\` - Search title/content

## Data Model

\`\`\`typescript
interface WikiDocument {
  id: string
  title: string
  slug: string           // URL-friendly
  content: string        // Markdown
  type: WikiDocType
  tags: string[]
  parentId?: string      // For nesting
  projectId?: string     // Scope
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  isPublished: boolean
}
\`\`\`

## Version History

Each edit creates a version snapshot:

\`\`\`typescript
interface WikiVersion {
  id: string
  documentId: string
  content: string
  version: number
  createdAt: string
  createdBy: string
  changeNote?: string
}
\`\`\`

## Markdown Support

The wiki supports GitHub Flavored Markdown:

- Headings, bold, italic
- Code blocks with syntax highlighting
- Tables
- Lists (ordered and unordered)
- Links and images
- Task lists
- Blockquotes

## Best Practices

1. **Use descriptive titles** - Make documents findable
2. **Add relevant tags** - Improve discoverability
3. **Include code examples** - Show, don't just tell
4. **Keep documents focused** - One topic per document
5. **Update regularly** - Documentation rots quickly
6. **Link related docs** - Build a knowledge graph
`,
  },

  // ============================================
  // COMPONENT LIBRARY
  // ============================================
  {
    title: "Component Library",
    type: "component",
    tags: ["components", "ui", "shadcn"],
    content: `# Component Library

## Base Components (shadcn/ui)

Located in \`/src/components/ui/\`:

| Component | File | Description |
|-----------|------|-------------|
| Button | \`button.tsx\` | Buttons with variants |
| Card | \`card.tsx\` | Card container |
| Badge | \`badge.tsx\` | Status badges |
| Dialog | \`dialog.tsx\` | Modal dialogs |
| Tabs | \`tabs.tsx\` | Tab navigation |
| Input | \`input.tsx\` | Text input |
| Textarea | \`textarea.tsx\` | Multi-line input |
| Select | \`select.tsx\` | Dropdown select |
| Checkbox | \`checkbox.tsx\` | Checkbox input |
| Collapsible | \`collapsible.tsx\` | Collapsible sections |
| DropdownMenu | \`dropdown-menu.tsx\` | Context menus |
| ScrollArea | \`scroll-area.tsx\` | Scrollable containers |
| Tooltip | \`tooltip.tsx\` | Hover tooltips |

## Button Variants

\`\`\`tsx
import { Button } from "@/components/ui/button"

<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon">
  <Icon className="h-4 w-4" />
</Button>
\`\`\`

## Cards

\`\`\`tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description text</CardDescription>
  </CardHeader>
  <CardContent>
    Main content goes here
  </CardContent>
</Card>
\`\`\`

## Collapsible

\`\`\`tsx
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"

const [isOpen, setIsOpen] = useState(false)

<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <CollapsibleTrigger asChild>
    <Button variant="ghost">
      <ChevronDown className={cn(
        "h-4 w-4 transition-transform",
        !isOpen && "-rotate-90"
      )} />
      Toggle Section
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    Hidden content here
  </CollapsibleContent>
</Collapsible>
\`\`\`

## Select

\`\`\`tsx
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"

<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="w-48">
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
\`\`\`

## Feature Components

### ExecutionPanel
Complex orchestration UI for running work packets.
- Location: \`/src/components/execution/execution-panel.tsx\`
- Features: Mode selection, activity stream, controls

### IdeasExplorer
Multi-stage ideation workflow.
- Location: \`/src/components/project/ideas-explorer.tsx\`
- Features: Idea input, AI clarification, recommendations

### DocsBrowser
Markdown document management.
- Location: \`/src/components/project/docs-browser.tsx\`
- Features: Create, edit, preview, templates

### BuildPlanReview
Visual work packet hierarchy.
- Location: \`/src/components/project/build-plan-review.tsx\`
- Features: Phase grouping, packet cards, progress

### ClaudeCodeTerminal
Embedded AI terminal.
- Location: \`/src/components/claude-code/terminal.tsx\`
- Features: xterm.js, session management, options

## Styling Patterns

### cn() Utility
Combine classes conditionally:

\`\`\`tsx
import { cn } from "@/lib/utils"

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === "primary" && "primary-classes"
)}>
\`\`\`

### Loading States
\`\`\`tsx
import { Loader2 } from "lucide-react"

{isLoading ? (
  <Loader2 className="h-4 w-4 animate-spin" />
) : (
  <span>Content</span>
)}
\`\`\`
`,
  },

  // ============================================
  // API REFERENCE
  // ============================================
  {
    title: "API Reference",
    type: "api",
    tags: ["api", "endpoints", "reference"],
    content: `# API Reference

## Authentication

All API routes require authentication unless marked otherwise.

\`\`\`typescript
import { getCurrentUser } from "@/lib/auth/middleware"

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // Handle request...
}
\`\`\`

## Projects API

### List Projects
\`\`\`
GET /api/projects
Query: ?status=development&category=web&limit=50
Response: { projects: Project[] }
\`\`\`

### Create Project
\`\`\`
POST /api/projects
Body: {
  name: string
  description: string
  category: ProjectCategory
  priority?: ProjectPriority
  repos?: ProjectRepo[]
}
Response: { project: Project }
\`\`\`

### Get Project
\`\`\`
GET /api/projects/[id]
Response: { project: Project }
\`\`\`

### Update Project
\`\`\`
PUT /api/projects/[id]
Body: Partial<Project>
Response: { project: Project }
\`\`\`

### Delete Project
\`\`\`
DELETE /api/projects/[id]
Response: { success: true }
\`\`\`

## Wiki API

### List Documents
\`\`\`
GET /api/wiki
Query: ?type=guide&projectId=xxx&tag=api&search=auth
Response: { documents: WikiDocument[] }
\`\`\`

### Create Document
\`\`\`
POST /api/wiki
Body: {
  title: string
  content: string
  type: WikiDocType
  tags?: string[]
  projectId?: string
  parentId?: string
}
Response: { document: WikiDocument }
\`\`\`

### Get Document
\`\`\`
GET /api/wiki/[id]
Query: ?versions=true (include version history)
Response: { document: WikiDocument, versions?: WikiVersion[] }
\`\`\`

### Update Document
\`\`\`
PUT /api/wiki/[id]
Body: {
  title?: string
  content?: string
  type?: WikiDocType
  tags?: string[]
  changeNote?: string
}
Response: { document: WikiDocument }
\`\`\`

### Delete Document
\`\`\`
DELETE /api/wiki/[id]
Response: { success: true }
\`\`\`

### Seed Documentation
\`\`\`
POST /api/wiki/seed
Response: {
  success: true,
  created: string[],
  skipped: string[]
}
\`\`\`

## Claude Code API

### Start Session
\`\`\`
POST /api/claude-code
Body: {
  projectId: string
  workingDirectory: string
  bypassPermissions?: boolean
  sessionId?: string
  continueSession?: boolean
  resumeSessionId?: string
  userId?: string
  userRole?: string
}
Response: {
  success: true
  sessionId: string
  pid: number
}
\`\`\`

### Stream Output (SSE)
\`\`\`
GET /api/claude-code?sessionId=xxx
Response: Server-Sent Events stream
Events:
  - { type: "connected", sessionId: string }
  - { type: "status", status: string }
  - { type: "output", content: string }
  - { type: "claude_session_id", claudeSessionId: string }
  - { type: "exit", code: number }
\`\`\`

### Send Input
\`\`\`
PUT /api/claude-code
Body: {
  sessionId: string
  input?: string
  resize?: { cols: number, rows: number }
}
Response: { success: true }
\`\`\`

### Stop Session
\`\`\`
DELETE /api/claude-code?sessionId=xxx
Response: { success: true }
\`\`\`

### List Sessions
\`\`\`
GET /api/claude-code?list=true&projectId=xxx
Response: {
  sessions: StoredSession[]
  totalCount: number
  activeCount: number
}
\`\`\`

## Execution API

### Start Execution
\`\`\`
POST /api/execute
Body: {
  projectId: string
  packets: WorkPacket[]
  mode: "local" | "turbo" | "auto" | "n8n"
  modelId?: string
}
Response: { sessionId: string }
\`\`\`

### Get Execution Status
\`\`\`
GET /api/execute/[sessionId]
Response: { session: ExecutionSession }
\`\`\`

### Stream Progress (SSE)
\`\`\`
GET /api/execute/[sessionId]/stream
Response: Server-Sent Events
\`\`\`

### Stop Execution
\`\`\`
POST /api/execute/[sessionId]/stop
Response: { success: true }
\`\`\`

## Error Responses

All endpoints return errors in this format:

\`\`\`json
{
  "error": "Error message",
  "details": "Optional details",
  "code": "ERROR_CODE"
}
\`\`\`

Common status codes:
- \`400\` - Bad request (validation error)
- \`401\` - Unauthorized (not logged in)
- \`403\` - Forbidden (not allowed)
- \`404\` - Not found
- \`500\` - Server error
`,
  },

  // ============================================
  // HOOKS REFERENCE
  // ============================================
  {
    title: "Hooks Reference",
    type: "reference",
    tags: ["hooks", "react", "state"],
    content: `# Hooks Reference

## Authentication

### useAuth
\`\`\`typescript
import { useAuth } from "@/components/auth/auth-provider"

function MyComponent() {
  const {
    user,            // User | null
    isAuthenticated, // boolean
    isLoading,       // boolean
    role,            // "admin" | "beta_tester" | "user"
    isBetaTester,    // boolean
    betaLimits,      // { current: {...}, limits: {...} }
    signOut,         // () => Promise<void>
  } = useAuth()
}
\`\`\`

## Data Hooks

### useProjects
\`\`\`typescript
import { useProjects } from "@/hooks/useProjects"

function ProjectList() {
  const {
    projects,        // Project[]
    loading,         // boolean
    error,           // string | null
    refresh,         // () => Promise<void>
    createProject,   // (data) => Promise<Project>
    updateProject,   // (id, data) => Promise<Project>
    deleteProject,   // (id) => Promise<void>
  } = useProjects()
}
\`\`\`

### useStarredProjects
\`\`\`typescript
import { useStarredProjects } from "@/hooks/useStarredProjects"

function Favorites() {
  const {
    starredProjects, // Project[]
    starredIds,      // Set<string>
    isStarred,       // (id) => boolean
    toggleStar,      // (id) => void
    loading,         // boolean
  } = useStarredProjects()
}
\`\`\`

## Module Hooks

### useEmergentModules
\`\`\`typescript
import { useEmergentModules } from "@/hooks/useEmergentModules"

function ModuleList() {
  const {
    modules,         // EmergentModule[]
    loading,         // boolean
    error,           // string | null
    refresh,         // () => Promise<void>
    activeModules,   // EmergentModule[] (status === "active")
  } = useEmergentModules()
}
\`\`\`

## Terminal Hooks

### useMultiTerminalState
\`\`\`typescript
import { useMultiTerminalState } from "@/hooks/useMultiTerminalState"

function MultiTerminal() {
  const {
    terminals,       // TerminalState[]
    activeId,        // string | null
    addTerminal,     // (config) => string
    removeTerminal,  // (id) => void
    setActive,       // (id) => void
    updateTerminal,  // (id, updates) => void
  } = useMultiTerminalState()
}
\`\`\`

## Execution Hooks

### usePacketExecution
\`\`\`typescript
import { usePacketExecution } from "@/hooks/usePacketExecution"

function ExecutionControl() {
  const {
    isExecuting,     // boolean
    isPaused,        // boolean
    currentPacket,   // WorkPacket | null
    progress,        // { completed: number, total: number }
    activityLog,     // ActivityEvent[]
    startExecution,  // (packets, mode) => Promise<void>
    pauseExecution,  // () => void
    resumeExecution, // () => void
    stopExecution,   // () => void
  } = usePacketExecution(projectId)
}
\`\`\`

## Utility Hooks

### useApprovals
\`\`\`typescript
import { useApprovals } from "@/hooks/useApprovals"

function ApprovalBadge() {
  const {
    pendingCount,    // number
    approvals,       // Approval[]
    loading,         // boolean
    approve,         // (id) => Promise<void>
    reject,          // (id) => Promise<void>
  } = useApprovals()
}
\`\`\`

### useActivityPersistence
\`\`\`typescript
import { useActivityPersistence } from "@/hooks/useActivityPersistence"

function ActivityLog() {
  const {
    activities,      // Activity[]
    addActivity,     // (activity) => void
    clearActivities, // () => void
    loading,         // boolean
  } = useActivityPersistence(projectId)
}
\`\`\`

## Creating Custom Hooks

\`\`\`typescript
import { useState, useEffect, useCallback } from "react"

export function useMyCustomHook(initialValue: string) {
  const [value, setValue] = useState(initialValue)
  const [loading, setLoading] = useState(false)

  const updateValue = useCallback(async (newValue: string) => {
    setLoading(true)
    try {
      // API call or other async operation
      await saveToServer(newValue)
      setValue(newValue)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Load initial data
    loadFromServer().then(setValue)
  }, [])

  return { value, updateValue, loading }
}
\`\`\`
`,
  },

  // ============================================
  // CONFIGURATION
  // ============================================
  {
    title: "Configuration Guide",
    type: "guide",
    tags: ["configuration", "settings", "environment"],
    content: `# Configuration Guide

## Environment Variables

Create a \`.env.local\` file in the project root:

\`\`\`bash
# Authentication
NEXT_PUBLIC_BETA_AUTH_BYPASS=true  # Enable auth bypass for dev

# AI Integration
ANTHROPIC_API_KEY=sk-ant-...       # Claude API key

# Project Settings
CLAUDIA_PROJECTS_BASE=~/claudia-projects  # Project workspace root

# Database
DATABASE_URL=file:./data/claudia.db  # SQLite database path
\`\`\`

## Claude Code Configuration

Located in \`.claude/settings.json\`:

\`\`\`json
{
  "permissions": {
    "allow": [
      "Read(*)",
      "Write(src/**)",
      "Bash(npm run *)",
      "Bash(git *)"
    ],
    "deny": [
      "Write(.env*)",
      "Bash(rm -rf *)"
    ]
  },
  "hooks": {
    "pre-commit": "npm run lint",
    "post-edit": "npm run typecheck"
  }
}
\`\`\`

## Claude Code Rules

Located in \`.claude/rules/\`:

### minime-orchestrator.md
Controls when sub-agents are spawned.

### wiggum-loop.md
Enables autonomous quality loops with testing.

## MCP Server Configuration

Configure at \`/claude-code/mcp\`:

\`\`\`json
{
  "servers": [
    {
      "name": "filesystem",
      "enabled": true,
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem"]
    },
    {
      "name": "github",
      "enabled": false,
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"]
    }
  ]
}
\`\`\`

## TypeScript Configuration

\`tsconfig.json\`:

\`\`\`json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
\`\`\`

## Tailwind Configuration

\`tailwind.config.ts\`:

\`\`\`typescript
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        // ... shadcn/ui theme colors
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
}
\`\`\`

## User Settings

Access at \`/settings\`:

- **Profile**: Name, email, avatar
- **Appearance**: Theme (dark/light)
- **API Keys**: External service keys
- **Security**: Password, 2FA
- **Notifications**: Email preferences

## Project-Level Configuration

Each project can have:

- \`workingDirectory\` - Local workspace path
- \`repos\` - Connected repositories
- \`linearSync\` - Linear issue sync config
- \`tags\` - Custom categorization
`,
  },

  // ============================================
  // TROUBLESHOOTING
  // ============================================
  {
    title: "Troubleshooting Guide",
    type: "runbook",
    tags: ["troubleshooting", "debugging", "issues"],
    content: `# Troubleshooting Guide

## Common Issues

### Authentication Issues

**Problem**: "Unauthorized" error on API calls

**Solutions**:
1. Check if \`AUTH_BYPASS_MODE\` is enabled in development
2. Verify session cookie is present
3. Clear localStorage and re-login
4. Check if session expired

**Problem**: Role-based access denied

**Solutions**:
1. Verify user role in database
2. Check if beta limits exceeded
3. Ensure correct role check in code

### Claude Code Issues

**Problem**: Terminal won't start

**Solutions**:
1. Verify Claude CLI is installed: \`which claude\`
2. Check working directory exists
3. Review browser console for errors
4. Check \`/api/claude-code\` logs

**Problem**: Session won't resume

**Solutions**:
1. Verify \`claudeSessionId\` was captured
2. Check if session file exists: \`.local-storage/claude-sessions.json\`
3. Try \`--continue\` instead of \`--resume\`
4. Clear session and start fresh

**Problem**: Permission errors

**Solutions**:
1. Check sandbox restrictions for beta users
2. Verify working directory permissions
3. Review \`.claude/settings.json\` allow/deny rules

### Data Issues

**Problem**: Data not persisting

**Solutions**:
1. Check localStorage quota (5MB limit)
2. Verify API calls are succeeding
3. Check for JavaScript errors
4. Clear cache and retry

**Problem**: Data sync issues

**Solutions**:
1. Refresh the page to re-fetch
2. Clear localStorage for specific keys
3. Check API response for errors
4. Verify user ID consistency

### Build/Execution Issues

**Problem**: Execution stuck

**Solutions**:
1. Check activity log for errors
2. Verify AI API key is valid
3. Review packet configuration
4. Stop and restart execution

**Problem**: Work packets not generating

**Solutions**:
1. Check project has sufficient description
2. Verify AI API connectivity
3. Review generation API logs
4. Try with simpler requirements

### UI Issues

**Problem**: Components not rendering

**Solutions**:
1. Check browser console for errors
2. Verify all dependencies loaded
3. Clear browser cache
4. Check for hydration mismatches

**Problem**: Styling issues

**Solutions**:
1. Verify Tailwind classes are correct
2. Check for CSS conflicts
3. Ensure dark mode variables set
4. Review component className props

## Debug Mode

Enable verbose logging:

\`\`\`typescript
// In browser console
localStorage.setItem("debug", "claudia:*")
\`\`\`

View API requests:

\`\`\`typescript
// Network tab filtering
// Filter: /api/
\`\`\`

## Log Locations

| Log | Location |
|-----|----------|
| API errors | Server console |
| Client errors | Browser console |
| Claude Code | \`[claude-code]\` prefix in server logs |
| Auth | \`[auth]\` prefix |

## Health Checks

Check system status:

\`\`\`bash
# API health
curl http://localhost:3000/api/health

# Database
sqlite3 data/claudia.db "SELECT 1"

# Claude CLI
claude --version
\`\`\`

## Getting Help

1. Check this troubleshooting guide
2. Search existing wiki documentation
3. Review error messages carefully
4. Check browser console and network tab
5. Review server logs
`,
  },

  // ============================================
  // CHANGELOG
  // ============================================
  {
    title: "Changelog",
    type: "changelog",
    tags: ["changelog", "releases", "updates"],
    content: `# Changelog

## January 2026

### 2026-01-24

#### Added
- **Documentation Wiki Module**
  - Full wiki system with project-based organization
  - Scope selector: Claudia Coder, Global, or Project-specific
  - Document types: architecture, api, component, changelog, guide, reference, runbook, decision
  - Markdown support with live preview
  - Version history tracking
  - Tag-based organization
  - Tree and list view modes

- **Wiki Maintenance Skill**
  - \`/wiki-docs\` skill for documentation updates
  - Automated documentation generation

- **Claude Code Improvements**
  - Collapsible project selection panel
  - Improved session ID extraction for resume
  - Added workingDirectory to session storage

#### Fixed
- Text overflow in wiki scope selector dropdown
- Session resume for Claudia Coder mode

### Previous Updates

#### Core Features
- Multi-terminal Claude Code support
- Emergent Modules system
- Voice recording and transcription
- Linear issue sync integration
- N8N workflow orchestration
- Security evaluation scanning
- PDF export functionality
- Build plan generation

#### Architecture
- User-scoped data isolation
- Layered storage architecture
- Session recovery system
- Real-time activity streaming
- Composable provider stack

#### UI/UX
- Dark mode theme
- Responsive sidebar navigation
- Collapsible sections
- Loading states and error handling
- Keyboard shortcuts

## Upcoming

### Planned Features
- Enhanced AI model selection
- Team collaboration features
- Custom MCP server creation
- Advanced analytics dashboard
- Plugin system

### Known Issues
- Large project lists may have performance issues
- Voice recording requires HTTPS
- Some MCP servers need manual configuration

---

For detailed release notes, see individual commit messages in the repository.
`,
  },
]

export async function POST(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Prepare documents for bulk creation
    const docsToCreate = CLAUDIA_CODER_DOCS.map((doc) => ({
      title: doc.title,
      content: doc.content,
      type: doc.type,
      tags: doc.tags,
      projectId: CLAUDIA_CODER_WIKI_ID,
      createdBy: user.id,
      updatedBy: user.id,
      isPublished: true,
    }))

    // Bulk create documents server-side
    const { created, skipped } = await bulkCreateWikiDocuments(docsToCreate)

    return NextResponse.json({
      success: true,
      created: created.map(d => d.title),
      skipped,
      message: `Created ${created.length} documents, skipped ${skipped.length} existing`
    })
  } catch (error) {
    console.error("[Wiki Seed] Error:", error)
    return NextResponse.json(
      { error: "Failed to seed wiki documents" },
      { status: 500 }
    )
  }
}
