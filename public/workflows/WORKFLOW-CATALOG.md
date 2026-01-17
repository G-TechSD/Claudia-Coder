# N8N Workflow Catalog - ClaudiaCode System

## Summary

**Total Workflows Found:** 18 (on N8N Server) + 55 (exported)
**Workflow Locations:**
- N8N API: `http://localhost:5678/api/v1/workflows`
- Local exports: `./public/workflows/orangepi/`
- Claudia templates: `./public/workflows/`

---

## Key Architectural Patterns

### 1. Orchestrator Pattern - Multi-Tier Routing

**Workflow:** `Autonomous App Builder v2` (autonomous-app-builder-v2.json)

**Structure:**
```
Chat Trigger --> Parse Command --> Route Command (Switch)
                                    |
    +-------------------------------+-------------------------------+
    |              |              |              |              |
/build:      /issues:      /primary_free:   /paid_claude:   /ssh:
    |              |              |              |              |
Prepare      Linear API    Local Agent    Claude Agent    SSH Exec
Build            |              |              |              |
    |         Process       Local Model    Claude Model   Server
Execute        Issues        (LMStudio)    (Anthropic)
Builder            |              |              |
    +--------------+--------------+--------------+
                        |
                 Format Response
                        |
                  Send Response
```

**Routes Available:**
- `/build <project>` - Build a new project via master_orchestrator
- `/issues` - Load Linear issues with pagination
- `/primary_free: <prompt>` - Route to primary local LMStudio
- `/secondary_free: <prompt>` - Route to secondary local LMStudio
- `/paid_chatgpt: <prompt>` - Route to ChatGPT
- `/paid_gemini: <prompt>` - Route to Gemini Flash
- `/paid_claude: <prompt>` - Route to Claude Opus
- `/paid_claude_code: <prompt>` - Route to Claude Code via SSH
- `/ssh: <command>` - Execute SSH command on server
- `/n8n: <prompt>` - Internal N8N operations

---

### 2. Quality Loop Pattern (Ralph Wiggum Loop)

**Workflow:** `Claudia Execute - Quality Loop Pipeline` (claudia-execute.json)

**Structure:**
```
Webhook POST --> Validate Packet --> [valid?]
                                        |
                +----------- no --------+
                |                       |
          400 Error                 202 Accepted
                                        |
                            Prepare for Processing
                                        |
                              Progress Callback?
                                        |
                        Build Implementation Prompt
                                        |
                   Execute Implementation (Local LLM)
                                        |
                          Format Implementation Output
                                        |
                           Build Validation Prompt
                                        |
                    Execute Validation (Claude Sonnet)
                                        |
                          Parse Validation Results
                                        |
                     +--------+---------+---------+
                     |        |         |         |
                  ACCEPT   ITERATE    REJECT
                     |        |         |
                 Complete  Check      Fail
                            Retry      |
                            Count      +---> Callback
                     |        |
                     |   [retries < max?]
                     |        |
                     |   Prepare Iteration
                     |        |
                     +--------+--> Loop back to Implementation
```

**Quality Metrics:**
- `overall_quality_score`: 0-100
- `recommendation`: ACCEPT | ITERATE | REJECT
- `max_retries`: configurable (default 3)
- Categories: correctness, security, testing, dependencies, error handling

---

### 3. Multi-Stage Quality Pipeline

**Workflow:** `Autonomous Dev Agent - Multi-Stage Quality Pipeline` (multi-stage-quality-pipeline.json)

**Structure:**
```
Manual/Schedule Trigger
        |
Get Work Queue (Data Table)
        |
Packetize Work Items
        |
Loop Over Packets
        |
Route by Phase
        |
  +-----+-----+
  |           |
Initial    Iteration
  |           |
Build Prompt  Build Iteration Prompt
  |           |
Execute (Local LLM)
        |
Format Output --> Save to Storage
        |
Build Validation Prompt
        |
Execute Validation (Claude Opus)
        |
Parse Validation --> Decision Router
                          |
     +--------------------+--------------------+
     |                    |                    |
  ACCEPT               ITERATE              REJECT
     |                    |                    |
Generate           Generate             Analyze Failure
Improvement        Iteration            Create Correction
Tasks              Tasks                Task
     |                    |                    |
     +--------------------+--------------------+
                          |
               Save to Task Queue
```

---

### 4. Subagent Worker Bee Pattern

**Workflow:** `Dev Agent (ENHANCED - Local-First)` (dev-agent-local-first.json)

**Worker Types:**
- `worker_bee_opus`: Complex/architectural tasks (Claude Opus distill via LMStudio)
- `worker_bee_local`: General coding (Local LLM via LMStudio)
- `vision_worker`: Image analysis (Vision model via LMStudio)
- `claude_code`: Full-stack development (via SSH to Claude Code CLI)

**Data Tables Used:**
- `ClaudiaCodeIssuePackets`: Work packets
- `ClaudiaCodeProjectPlans`: Strategic plans
- `ClaudiaCode Issues`: Linear issue mirror
- `ClaudiaCodeProjectLog`: Work history

---

### 5. Linear Integration Pattern

**Workflow:** `Linear Issues to Data Table` (linear-issues-to-data-table.json)

**Features:**
- Pagination support (100 issues per page)
- Project filtering (n8n-labeled projects only)
- Label extraction (`taskForAi`, `taskForBill`)
- Upsert to Data Table (prevents duplicates)
- Parent issue tracking

---

## Claudia Template Workflows

### universal-issue-import.json
**Purpose:** Accept issues from multiple external sources
**Supports:** GitHub, Jira, Notion, Linear, Slack, Custom
**Endpoint:** POST /webhook/issue-import

### claudia-execute.json
**Purpose:** Main quality loop pipeline for work execution
**Endpoint:** POST /webhook/claudia-execute
**Features:**
- Async processing (202 Accepted)
- Progress callbacks
- Quality validation with Claude
- Auto-iteration on failure

---

## Model Routing Summary

| Route | Model | Provider | Use Case |
|-------|-------|----------|----------|
| /primary_free | Local LLM | LMStudio (local-llm-server) | General coding, fast iteration |
| /secondary_free | Vision LLM | LMStudio (local-llm-server-2) | Vision, fallback |
| /paid_chatgpt | GPT-4+ | OpenAI API | Complex tasks |
| /paid_gemini | Gemini Flash | Google API | Multimodal |
| /paid_claude | Claude Opus | Anthropic API | Deep reasoning, code review |
| /paid_claude_code | Claude Code | SSH to server | Full agentic development |

---

## File Locations

```
./public/workflows/
    claudia-execute.json          # Quality loop pipeline
    universal-issue-import.json   # Multi-source issue import
    orangepi/                     # Exported workflows from N8N
        autonomous-app-builder-v2.json
        dev-agent-local-first.json
        linear-issues-to-data-table.json
        multi-stage-quality-pipeline.json
        quality-first-app-builder.json
        task-queue-processor.json
        local-first-smart-escalation.json
        ... and more
```

---

## Key Credentials Required

- `Local LMStudio` - OpenAI-compatible API for local models
- `OpenAI API account` - GPT-4+
- `Anthropic account` - Claude Opus
- `Google Gemini API account` - Gemini Flash
- `Linear account` - Linear API access
- `SSH Access` - SSH to local server (optional)

---

## Environment Variables

```bash
N8N_URL="http://localhost:5678"
N8N_API_KEY="[your-jwt-token]"
LINEAR_API_KEY="lin_api_..."
LMSTUDIO_SERVER_1="http://localhost:1234"
LMSTUDIO_SERVER_2="http://localhost:1235"
GITLAB_HOST="localhost"
N8N_WORKFLOW_VERSIONS_DIR="/path/to/workflow_versions"
```
