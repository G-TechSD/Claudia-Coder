# Claudia Coder Expert Knowledge Base

This skill provides comprehensive knowledge about Claudia Coder, the AI-powered development orchestration platform.

---

## Overview

**Claudia Coder** is an AI-powered development orchestration platform designed to streamline the entire software development lifecycle from ideation to implementation.

- **Purpose**: Transform ideas into working software through AI-assisted planning, development, and project management
- **Philosophy**: Reduce friction between thinking and building by leveraging AI at every stage

### Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript |
| Database | SQLite (via Better SQLite3) |
| Authentication | Better Auth |
| Styling | Tailwind CSS |
| State Management | React Context + localStorage |
| Terminal | xterm.js |
| Recording | rrweb |

---

## Core Features

### 1. Projects

Projects are the central organizing unit in Claudia Coder. Each project represents a software development effort with associated planning artifacts.

**Capabilities:**
- Create new projects from scratch
- Import projects from Linear or GitLab
- Associate build plans and work packets
- Track project status and progress
- Link to external repositories
- Session recording for development playback

**Project Structure:**
```typescript
interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
  linearProjectId?: string;
  gitlabProjectId?: string;
  repositoryUrl?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2. Build Plans

Build plans are AI-generated development roadmaps that break down project requirements into actionable phases.

**Features:**
- LLM-powered plan generation from requirements
- Phase-based organization
- Automatic work packet creation
- Dependency tracking between phases
- Iterative refinement through conversation

**Generation Process:**
1. Collect requirements (from brain dump, interview, or manual input)
2. Send to LLM with structured prompt
3. Parse response into phases and tasks
4. Create work packets for each task
5. Establish dependencies and ordering

### 3. Work Packets

Work packets are discrete, implementable units of work derived from build plans.

**Packet Types:**
- Feature implementation
- Bug fixes
- Refactoring
- Documentation
- Testing
- Infrastructure

**Packet Structure:**
```typescript
interface WorkPacket {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  description: string;
  type: PacketType;
  status: 'pending' | 'in_progress' | 'review' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours?: number;
  assignedTo?: string;
  dependencies: string[];
  createdAt: string;
  completedAt?: string;
}
```

### 4. Brain Dumps

Brain dumps allow rapid capture of ideas through voice or text input, which are then processed by AI into structured requirements.

**Input Methods:**
- Voice recording (transcribed via Whisper)
- Text input (freeform)
- File upload (documents, images)

**Processing Pipeline:**
1. Capture raw input
2. Transcribe audio (if applicable)
3. Extract key concepts and requirements
4. Identify potential work packets
5. Suggest project structure
6. Auto-packetization into work items

**Voice Recording:**
- Uses Web Audio API
- Stores in IndexedDB
- Supports pause/resume
- Real-time waveform visualization

### 5. Interviews

AI-powered conversational interviews to extract detailed requirements through guided questioning.

**Interview Types:**
- Project scoping
- Feature definition
- Technical requirements
- User story elicitation

**Features:**
- Dynamic question generation based on responses
- Context-aware follow-up questions
- Summary generation
- Direct conversion to work packets
- Voice chat support with speech synthesis

### 6. Business Ideas

Explore and evaluate business ideas with AI-powered viability analysis.

**Analysis Components:**
- Market size estimation
- Competition analysis
- Revenue model suggestions
- Risk assessment
- Implementation complexity
- Viability scoring (0-100)

**Viability Scoring Criteria:**
- Market opportunity (25%)
- Technical feasibility (25%)
- Resource requirements (20%)
- Competition landscape (15%)
- Time to market (15%)

### 7. Research ("Has This Been Done Before")

Automated competitive research to understand existing solutions in the market.

**Research Capabilities:**
- Similar product identification
- Feature comparison matrices
- Pricing analysis
- Technology stack detection
- Differentiation opportunity identification
- Gap analysis

**Output:**
- Comprehensive research report
- Competitor profiles
- Feature gap analysis
- Strategic recommendations

### 8. Patents

AI-assisted patent drafting with structured content generation.

**Patent Components:**
- Title and abstract
- Background and prior art
- Detailed description
- Claims (independent and dependent)
- Drawings/figures descriptions
- Filing strategy recommendations

**LLM Integration:**
- Structured prompt templates
- Section-by-section generation
- Legal language optimization
- Prior art awareness
- Claim scope refinement

### 9. Business Development

Comprehensive business analysis for monetization and marketing strategy.

**Analysis Areas:**
- Revenue model analysis
- Pricing strategy
- Go-to-market planning
- Customer acquisition strategies
- Partnership opportunities
- Marketing channel recommendations
- Unit economics modeling

---

## Project Workflow

### Complete Development Lifecycle

```
1. IDEATION
   ├── Create new project
   ├── OR import from Linear/GitLab
   └── Define initial scope

2. REQUIREMENTS
   ├── Brain dump (voice/text)
   ├── AI interview
   └── Manual requirements entry

3. PLANNING
   ├── Generate build plan with LLM
   ├── Review and refine phases
   └── Adjust priorities and dependencies

4. WORK PACKETS
   ├── Auto-generated from build plan
   ├── Manual packet creation
   ├── Priority assignment
   └── Dependency mapping

5. IMPLEMENTATION
   ├── Claude Code integration
   ├── Terminal-based development
   ├── Session recording with rrweb
   └── Progress tracking

6. REVIEW & ITERATION
   ├── Packet completion tracking
   ├── Session playback
   ├── Plan refinement
   └── New packet generation
```

### Import from Linear

1. Connect Linear API token
2. Select workspace and project
3. Import issues as work packets
4. Sync comments and metadata
5. Bidirectional status updates

### Import from GitLab

1. Configure GitLab instance URL
2. Authenticate with access token
3. Select repository
4. Import issues and merge requests
5. Link to repository for Claude Code

---

## Integrations

### Claude Code (Embedded Terminal)

Deep integration with Claude Code for AI-assisted development.

**Features:**
- Embedded xterm.js terminal
- Direct project context injection
- Session recording and playback
- Work packet context awareness
- Automatic workspace setup

**Implementation:**
- PTY spawning for shell access
- WebSocket communication
- ANSI escape sequence handling
- Clipboard integration
- Custom keybindings

### N8N (Workflow Automation)

Embedded N8N instance for workflow automation.

**Capabilities:**
- Embedded iframe editor
- AI-generated workflow suggestions
- Project-specific workflow templates
- Webhook integration
- External service connections

**Use Cases:**
- Automated notifications
- CI/CD triggers
- Data synchronization
- External API orchestration
- Scheduled tasks

### Open Web UI (Chat Interface)

Embedded Open Web UI for advanced LLM interactions.

**Features:**
- Multiple model support
- Conversation persistence
- Document upload and analysis
- Custom system prompts
- Project context injection

### GitLab Integration

Full GitLab integration for repository and issue management.

**Capabilities:**
- Repository browsing
- Issue import/export
- Merge request creation
- CI/CD pipeline status
- Webhook handling
- Branch management

**API Endpoints:**
```
GET  /api/gitlab/projects
GET  /api/gitlab/projects/[id]/issues
POST /api/gitlab/projects/[id]/issues
GET  /api/gitlab/projects/[id]/merge_requests
POST /api/gitlab/projects/[id]/merge_requests
```

### Linear Integration

Linear issue tracking integration.

**Capabilities:**
- Workspace and team access
- Issue synchronization
- Project import
- Comment mirroring
- Status updates
- Label management

**API Endpoints:**
```
GET  /api/linear/workspaces
GET  /api/linear/teams
GET  /api/linear/projects
GET  /api/linear/issues
POST /api/linear/issues
PATCH /api/linear/issues/[id]
```

### LM Studio / Ollama

Local LLM support for privacy-conscious deployments.

**Configuration:**
- Custom endpoint URLs
- Model selection
- Temperature/parameter control
- Fallback chain configuration

---

## Key Components (Routes)

### /projects - Project Management

Main project dashboard and management interface.

**Pages:**
- `/projects` - Project list with filtering and search
- `/projects/new` - Create new project
- `/projects/[id]` - Project detail view
- `/projects/[id]/build-plan` - Build plan editor
- `/projects/[id]/packets` - Project work packets
- `/projects/[id]/sessions` - Development sessions

### /packets - Work Packet Queue

Global work packet management and prioritization.

**Features:**
- Kanban board view
- List view with sorting
- Priority filtering
- Status transitions
- Bulk operations
- Dependency visualization

### /research - Competition Research

Research interface for competitive analysis.

**Workflow:**
1. Enter product/idea description
2. AI performs web research
3. Identifies competitors
4. Generates comparison report
5. Highlights opportunities

### /business-ideas - Idea Exploration

Business idea capture and evaluation.

**Features:**
- Idea entry form
- AI viability analysis
- Score breakdown
- Historical tracking
- Export to project

### /patents - Patent Drafting

AI-assisted patent document creation.

**Sections:**
- Idea description
- Prior art research
- Claims drafting
- Detailed description
- Figures/drawings
- Filing recommendations

### /business-dev - Business Analysis

Comprehensive business development tools.

**Analysis Types:**
- Market analysis
- Pricing strategy
- Go-to-market plan
- Revenue modeling
- Customer segmentation

### /n8n - Workflow Automation

Embedded N8N interface.

**Features:**
- Full N8N editor access
- Workflow templates
- AI workflow suggestions
- Execution monitoring

### /openwebui - Chat Interface

Embedded Open Web UI access.

**Features:**
- Direct LLM access
- Model switching
- Conversation management
- File analysis

### /admin - User Management

Administrative interface for platform management.

**Sections:**
- `/admin/users` - User management
- `/admin/sessions` - Session monitoring
- `/admin/invites` - Invitation management
- `/admin/settings` - Platform settings

---

## Architecture

### Data Sandboxing

All user data is strictly scoped by userId to ensure complete isolation.

**Scoping Implementation:**
```typescript
// Every data access includes userId filter
const projects = await db.query(
  'SELECT * FROM projects WHERE userId = ?',
  [session.userId]
);

// localStorage keys include userId prefix
const key = `claudia:${userId}:projects`;
localStorage.setItem(key, JSON.stringify(data));
```

**Sandboxed Resources:**
- Projects
- Work packets
- Brain dumps
- Research results
- Business ideas
- Patents
- Session recordings

### Role System

Three-tier role hierarchy for access control.

| Role | Capabilities |
|------|-------------|
| `admin` | Full access, user management, system settings, all users' data |
| `beta_tester` | Full feature access, feedback submission, own data only |
| `user` | Standard access, own data only |

**Role Checks:**
```typescript
// Middleware example
if (session.user.role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Session Recording

Development session recording using rrweb for playback and analysis.

**Recording Features:**
- DOM mutation capture
- Mouse/keyboard events
- Console output
- Network requests (optional)
- Terminal output (xterm)

**Storage:**
- Session metadata in SQLite
- Event data in compressed JSON
- Indexed by project and timestamp

**Playback:**
- Time-based navigation
- Speed control
- Event filtering
- Export capabilities

### Email Invitations

User invitation system with customizable messaging.

**Invitation Flow:**
1. Admin creates invitation
2. Custom message composition
3. Email sent via configured provider
4. Unique invite link generated
5. New user registers with link
6. Role assigned automatically

---

## API Routes Structure

### Project APIs

```
GET    /api/projects              - List user's projects
POST   /api/projects              - Create new project
GET    /api/projects/[id]         - Get project details
PATCH  /api/projects/[id]         - Update project
DELETE /api/projects/[id]         - Delete project

GET    /api/projects/[id]/packets - Get project's work packets
POST   /api/projects/[id]/packets - Create work packet
GET    /api/projects/[id]/sessions - Get project's sessions
POST   /api/projects/[id]/sessions - Create new session
```

### Linear APIs

```
GET  /api/linear/auth            - OAuth initiation
GET  /api/linear/callback        - OAuth callback
GET  /api/linear/workspaces      - List workspaces
GET  /api/linear/teams           - List teams
GET  /api/linear/projects        - List projects
GET  /api/linear/issues          - List issues with filters
POST /api/linear/import          - Import issues to project
POST /api/linear/sync            - Sync status updates
```

### GitLab APIs

```
GET  /api/gitlab/auth            - OAuth initiation
GET  /api/gitlab/callback        - OAuth callback
GET  /api/gitlab/projects        - List repositories
GET  /api/gitlab/projects/[id]   - Get repository details
GET  /api/gitlab/issues          - List issues
POST /api/gitlab/import          - Import issues to project
GET  /api/gitlab/mrs             - List merge requests
POST /api/gitlab/mrs             - Create merge request
```

### N8N APIs

```
GET  /api/n8n/workflows          - List workflows
POST /api/n8n/workflows          - Create workflow
GET  /api/n8n/workflows/[id]     - Get workflow
PUT  /api/n8n/workflows/[id]     - Update workflow
POST /api/n8n/workflows/[id]/execute - Execute workflow
GET  /api/n8n/executions         - List executions
POST /api/n8n/proxy/*            - Proxy to N8N instance
```

### Brain Dump APIs

```
POST /api/brain-dump             - Submit brain dump
POST /api/brain-dump/transcribe  - Transcribe audio
POST /api/brain-dump/analyze     - Analyze and extract requirements
POST /api/brain-dump/packetize   - Convert to work packets
GET  /api/brain-dump/[id]        - Get brain dump details
```

### Build Plan APIs

```
POST /api/build-plan/generate    - Generate build plan from requirements
POST /api/build-plan/refine      - Refine existing plan
POST /api/build-plan/expand      - Expand plan section
POST /api/build-plan/packets     - Generate packets from plan
GET  /api/build-plan/[id]        - Get build plan
PUT  /api/build-plan/[id]        - Update build plan
```

### Business Dev APIs

```
POST /api/business-dev/analyze   - Full business analysis
POST /api/business-dev/market    - Market analysis
POST /api/business-dev/pricing   - Pricing strategy
POST /api/business-dev/gtm       - Go-to-market plan
POST /api/business-dev/revenue   - Revenue modeling
GET  /api/business-dev/[id]      - Get analysis results
```

### Patent APIs

```
POST /api/patents                - Create new patent draft
GET  /api/patents                - List user's patents
GET  /api/patents/[id]           - Get patent details
PUT  /api/patents/[id]           - Update patent
POST /api/patents/[id]/generate  - Generate patent section
POST /api/patents/[id]/claims    - Generate claims
POST /api/patents/[id]/prior-art - Research prior art
```

### Admin APIs

```
GET    /api/admin/users          - List all users
GET    /api/admin/users/[id]     - Get user details
PATCH  /api/admin/users/[id]     - Update user (role, status)
DELETE /api/admin/users/[id]     - Delete user

GET    /api/admin/sessions       - List all sessions
GET    /api/admin/sessions/[id]  - Get session details
DELETE /api/admin/sessions/[id]  - Delete session

POST   /api/admin/invites        - Create invitation
GET    /api/admin/invites        - List invitations
DELETE /api/admin/invites/[id]   - Revoke invitation

GET    /api/admin/settings       - Get system settings
PUT    /api/admin/settings       - Update settings
```

---

## LLM Integration

### Server Configuration

**Beast Server (Primary)**
- Model: gpt-oss-20b
- Purpose: Complex reasoning, code generation, analysis
- Endpoint: Configured via environment variable
- Use cases: Build plan generation, patent drafting, business analysis

**Bedroom Server (Secondary)**
- Model: ministral-3-3b
- Purpose: Quick responses, simple tasks
- Endpoint: Configured via environment variable
- Use cases: Transcription cleanup, simple formatting, quick Q&A

**Cloud Fallback**
- Anthropic Claude (claude-3-opus, claude-3-sonnet)
- OpenAI (gpt-4, gpt-3.5-turbo)
- Purpose: Backup when local servers unavailable
- Automatic failover with retry logic

### LLM Request Flow

```typescript
async function llmRequest(prompt: string, options: LLMOptions) {
  // 1. Try primary server
  try {
    return await callBeastServer(prompt, options);
  } catch (error) {
    console.log('Beast server unavailable, trying secondary');
  }

  // 2. Try secondary server
  try {
    return await callBedroomServer(prompt, options);
  } catch (error) {
    console.log('Bedroom server unavailable, trying cloud');
  }

  // 3. Cloud fallback
  if (options.allowCloud) {
    return await callCloudProvider(prompt, options);
  }

  throw new Error('All LLM providers unavailable');
}
```

### Prompt Templates

Structured prompts for consistent LLM output across features:

- `BUILD_PLAN_PROMPT` - Build plan generation
- `WORK_PACKET_PROMPT` - Work packet creation
- `INTERVIEW_PROMPT` - Interview question generation
- `RESEARCH_PROMPT` - Competition research
- `PATENT_PROMPT` - Patent section generation
- `BUSINESS_ANALYSIS_PROMPT` - Business development analysis

---

## File Storage

### localStorage (Client-Side)

User-scoped key-value storage for application state.

**Key Format:** `claudia:{userId}:{feature}:{subkey}`

**Stored Data:**
- UI preferences
- Draft content
- Filter/sort settings
- Recent items
- Feature flags

**Example:**
```typescript
// Save project draft
const key = `claudia:${userId}:projects:draft`;
localStorage.setItem(key, JSON.stringify(projectDraft));

// Load project draft
const draft = JSON.parse(localStorage.getItem(key) || 'null');
```

### IndexedDB (Client-Side)

Binary and large file storage.

**Databases:**
- `claudia-audio` - Voice recordings
- `claudia-files` - Uploaded files
- `claudia-cache` - Response caching

**Audio Storage:**
```typescript
// Store audio recording
await audioDb.put('recordings', {
  id: recordingId,
  userId: userId,
  projectId: projectId,
  blob: audioBlob,
  duration: duration,
  createdAt: new Date().toISOString()
});
```

### SQLite (Server-Side)

Persistent relational storage via Better SQLite3.

**Tables:**
- `users` - User accounts
- `sessions` - Auth sessions
- `accounts` - OAuth connections
- `invitations` - Email invitations
- `development_sessions` - rrweb session metadata

**Schema Example:**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  message TEXT,
  token TEXT UNIQUE NOT NULL,
  expiresAt DATETIME NOT NULL,
  usedAt DATETIME,
  createdBy TEXT REFERENCES users(id),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### .local-storage/ (Server-Side JSON)

Server-side JSON file storage for larger data structures.

**Directory Structure:**
```
.local-storage/
├── projects/
│   └── {userId}/
│       └── {projectId}.json
├── packets/
│   └── {userId}/
│       └── {packetId}.json
├── build-plans/
│   └── {userId}/
│       └── {projectId}.json
├── brain-dumps/
│   └── {userId}/
│       └── {dumpId}.json
├── research/
│   └── {userId}/
│       └── {researchId}.json
├── patents/
│   └── {userId}/
│       └── {patentId}.json
└── sessions/
    └── {userId}/
        └── {sessionId}/
            ├── metadata.json
            └── events.json
```

**File Operations:**
```typescript
import { promises as fs } from 'fs';
import path from 'path';

const STORAGE_ROOT = '.local-storage';

async function saveProject(userId: string, project: Project) {
  const dir = path.join(STORAGE_ROOT, 'projects', userId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${project.id}.json`),
    JSON.stringify(project, null, 2)
  );
}

async function loadProject(userId: string, projectId: string) {
  const filePath = path.join(STORAGE_ROOT, 'projects', userId, `${projectId}.json`);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Authentication
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# Database
DATABASE_URL=./data/claudia.db

# LLM Servers
BEAST_SERVER_URL=http://beast.local:8080
BEDROOM_SERVER_URL=http://bedroom.local:8080

# Cloud LLM (fallback)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Integrations
LINEAR_API_KEY=lin_api_...
LINEAR_OAUTH_CLIENT_ID=...
LINEAR_OAUTH_CLIENT_SECRET=...

GITLAB_URL=https://gitlab.example.com
GITLAB_ACCESS_TOKEN=glpat-...

# N8N
N8N_URL=http://localhost:5678
N8N_API_KEY=...

# Open Web UI
OPENWEBUI_URL=http://localhost:8080

# Email (for invitations)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=noreply@example.com
```

---

## Development Guidelines

### Adding New Features

1. Create route in `app/` directory
2. Add API routes in `app/api/`
3. Implement data storage (choose appropriate layer)
4. Add userId scoping to all queries
5. Create UI components
6. Add to navigation

### Code Patterns

**API Route with Auth:**
```typescript
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  // ... userId-scoped data access
}
```

**Admin-Only Route:**
```typescript
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // ... admin operations
}
```

---

## Common Tasks Reference

### Creating a New Project from Scratch
1. Navigate to `/projects/new`
2. Enter project name and description
3. Optionally conduct brain dump or interview
4. Generate build plan
5. Review and refine work packets
6. Begin implementation

### Importing from Linear
1. Go to `/projects/new`
2. Select "Import from Linear"
3. Choose workspace and project
4. Select issues to import
5. Confirm import
6. Work packets created automatically

### Recording a Development Session
1. Open project detail page
2. Click "Start Session"
3. Work in embedded terminal
4. Session automatically records
5. Stop session when done
6. Playback available in sessions list

### Generating a Patent Draft
1. Navigate to `/patents/new`
2. Enter invention description
3. Click "Generate Patent"
4. Review generated sections
5. Refine claims as needed
6. Export for filing

---

## Troubleshooting

### Common Issues

**LLM Connection Failed:**
- Check server URLs in environment
- Verify servers are running
- Check network connectivity
- Review server logs

**Linear/GitLab Sync Issues:**
- Verify API tokens are valid
- Check OAuth connection status
- Review rate limits
- Confirm webhook configuration

**Session Recording Not Working:**
- Check browser permissions
- Verify rrweb initialization
- Review console for errors
- Check storage quota

**Authentication Issues:**
- Clear browser cookies
- Check BETTER_AUTH_SECRET consistency
- Verify database connection
- Review auth logs

---

## Version History

- **Current**: Next.js 16, React 19, TypeScript 5.x
- **Database**: SQLite with Better SQLite3
- **Auth**: Better Auth with email/password and OAuth

---

*This skill document serves as the definitive reference for Claudia Coder. For implementation details, refer to the source code in the repository.*
