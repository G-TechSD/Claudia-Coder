# OrangePi N8N Instance - Orchestrator and Multi-Tier Routing Workflows

## Overview

The OrangePi N8N instance at `http://192.168.245.11:5678` contains multiple sophisticated orchestrator workflows that implement multi-tier AI model routing, quality validation loops, and autonomous development pipelines.

---

## Primary Orchestrator Workflows

### 1. Claudia Code (ud7XYHk6QWFvgDxf)

**Status:** Active
**Node Count:** 50
**File:** `ud7XYHk6QWFvgDxf.json`

#### Architecture

This is the main Claudia Code orchestrator that acts as a "receptionist and ring leader" for multiple AI agents.

#### Multi-Tier Routing Structure

The workflow uses a command-based routing system via a central `Switch` node:

| Command | Route | Description |
|---------|-------|-------------|
| `/projects` | Project Selection | Linear project selection tool |
| `/primary_free:` | FREE Primary LM Studio Server | Local BEAST LM Studio (GPT-OSS-20b) |
| `/secondary_free:` | FREE Secondary LM Studio Server | Bedroom LM Studio (Qwen3-VL-8b) |
| `/paid_chatgpt:` | PAID ChatGPT | Cloud-based GPT 5.1 |
| `/paid_gemini:` | PAID Gemini | Cloud-based Gemini 3 Flash |
| `/paid_claude:` | PAID Anthropic | Cloud-based Claude Opus 4.5 |
| `/paid_nanobanana:` | PAID NanoBanana | Cloud-based Gemini Image Gen |
| `/paid_claude_code:` | Claude Code on OrangePi | SSH-based Claude CLI execution |

#### Key Components

```
When chat message received
       |
       v
   Orchestrator (AI Agent)
       |
       v
Set Active Command and Separate Prompt
       |
       v
     Switch (Multi-Output Router)
       |
  +----+----+----+----+----+----+----+
  |    |    |    |    |    |    |    |
  v    v    v    v    v    v    v    v
[Various Model Endpoints]
       |
       v
Save SubAgent Output (Data Table)
       |
       v
Respond to Chat
```

#### Model Hierarchy

1. **FREE Tier (Local LM Studio)**
   - BEAST LM Studio: Primary free option
   - Bedroom LM Studio: Secondary free option (Qwen3-VL-8b)

2. **PAID Tier (Cloud APIs)**
   - ChatGPT 5.1
   - Gemini 3 Flash
   - Claude Opus 4.5
   - NanoBanana (Image Gen)

#### Orchestrator System Prompt Logic

The orchestrator:
- Offloads work to FREE agents by default
- Asks permission before using PAID resources
- Uses special tag `<!@<!@<!ENGAGE AI SUB AGENT!>@!>@!>` to route to sub-agents
- Commands MUST be at the beginning of output
- Stores conversation context in Data Table for working memory

---

### 2. LMStudio Agentic Dev Tools v2 (PbSOq6RsFoCsLZUh)

**Status:** Active
**Node Count:** 90
**File:** `PbSOq6RsFoCsLZUh.json`

#### Architecture

This is the most sophisticated workflow with 90 nodes implementing:
- Parallel worker routing
- Quality validation loops
- Desktop testing integration
- Linear issue management

#### Multi-Tier Routing Structure

```
When chat message received
       |
       v
   Route Input (Switch)
       |
  +----+----+
  |         |
  v         v
Select    Get Linear
Project   Projects
  |         |
  v         v
Get Issues By Project
       |
       v
   Filter Open Issues
       |
       v
Choose Processing Mode (Switch)
       |
  +----+----+
  |         |
  v         v
Sequential  Parallel
Mode        Mode
```

#### Worker Classification System

The `Classify Issues for Routing` node implements intelligent task routing:

```javascript
// Classification Logic
if (UI/screenshot/design/visual/mockup/image) -> Google (Vision/UI task)
else if (architect/refactor/complex/trade-off) -> Anthropic (Complex reasoning)
else if (doc/test/readme) -> Bedroom (Documentation/test task)
else -> BEAST (Default coding task)
```

#### Parallel Worker Split

**FREE Workers:**
- Worker BEAST (LM Studio GPT-OSS-20b)
- Worker Bedroom (LM Studio Qwen3-VL-8b)

**SPENDY Workers:**
- Worker Google (Gemini)
- Worker Anthropic (Claude)
- Worker ChatGPT (GPT 5.x)

#### Quality Loop Structure

```
Setup Issue Context
       |
       v
Git Setup & Branch
       |
       v
Orchestrator AI Agent
       |
       v
Apply Code Changes
       |
       v
Run Tests
       |
       v
Tests Passed? (If)
    |     |
    v     v
  Pass   Fail
    |     |
    v     v
Git     Increment Attempts
Commit      |
    |       v
    v   Max Attempts? (If)
Update      |     |
Linear      v     v
Success  AI Fix  Escalate
         Agent   Max Attempts
```

#### Desktop Testing Integration

For UI-related issues:
```
Needs Desktop Test (If)
       |
       v
Sync Repo to Desktop
       |
       v
Run Tests on Desktop
       |
       v
Fetch Screenshots
       |
       v
Comment Screenshots to Linear
```

---

### 3. Claudia Code 2 (4p4rBF0F4Ku5aY8x)

**Status:** Active
**Node Count:** 38
**File:** `4p4rBF0F4Ku5aY8x.json`

#### Architecture

Updated version of Claudia Code with Issue Packets Loader integration.

#### Key Differences from v1

- Integrated `Call 'Issue Packets Loader Sub'` workflow call
- Added `FREE Secondary LM Studio Opus 4.5` option
- Streamlined model selection

#### Model Options

| Model | Type | Credential |
|-------|------|------------|
| GPT-OSS-20b | FREE | BEAST LMStudio |
| Qwen3-VL-8b | FREE | Bedroom LMStudio |
| Claude Opus 4.5 | PAID | Anthropic API |
| GPT 5.1 | PAID | OpenAI API |
| Gemini 3 Flash | PAID | Google API |

---

### 4. Autonomous Dev with Quality Loop (9JoFVmCveQLWoCxw)

**Status:** Active
**Node Count:** 26
**File:** `9JoFVmCveQLWoCxw.json`

#### Architecture

Webhook-triggered autonomous development workflow with quality validation.

#### Processing Pipeline

```
Webhook Trigger
       |
       v
Get Next Queued Packet
       |
       v
Analyze Complexity
       |
       v
Route by Complexity (Switch)
       |
  +----+----+
  |         |
  v         v
Simple    Complex
Prompt    Prompt
  |         |
  v         v
Needs Context7? (If)
       |
  +----+----+
  |         |
  v         v
 Skip     Split Context7 Queries
           |
           v
       Aggregate Context7 Results
           |
           v
       Build Enhanced Prompt
```

#### Quality Validation

```
Execute Local Model
       |
       v
Format Output
       |
       v
Qwen3-VL-8b Validator
       |
       v
Parse Quality Report
       |
       v
Decision Router (Switch)
       |
  +----+----+----+
  |    |    |    |
  v    v    v    v
Accept Fix  Retry Fail
  |    |    |    |
  v    v    v    v
Save Build Build Mark
Output Fix  Retry Failed
       Prompt
```

#### Escalation Settings

- Auto-approval for simple tasks
- Human approval request for complex tasks
- Max iteration limits with failure handling

---

### 5. Packet Processor with Quality Check (Eav7gyLzr7RuGaeT)

**Status:** Active
**Node Count:** 22
**File:** `Eav7gyLzr7RuGaeT.json`

#### Architecture

Quality-focused packet processor with validation and editor review loops.

#### Processing Flow

```
Webhook Trigger / Manual Execute
       |
       v
Get row(s) from Data Table
       |
       v
Process Each Packet (Loop)
       |
       v
Extract Packet Data
       |
       v
Format Work Prompt
       |
       v
Worker Agent (GPT-OSS-20b)
       |
       v
Build Quality Check Prompt
       |
       v
Quality Validator
       |
       v
Parse Quality Score
       |
       v
Decision Router
       |
  +----+----+----+
  |    |    |    |
  v    v    v    v
Accept Retry Edit Reject
```

#### Quality Validation Stages

1. **Initial Generation** - Worker Agent produces code
2. **Quality Check** - Validator scores output
3. **Decision Routing** - Based on quality score:
   - Accept (high score) -> Save output
   - Retry (medium score) -> Loop back with feedback
   - Edit (needs revision) -> Editor Validator review
   - Reject (low score) -> Max iteration check

---

### 6. Autonomous Dev Agent - Multi-Stage Quality Pipeline (V3jKwR9t38ncqYpP)

**Status:** Inactive
**Node Count:** 27
**File:** `V3jKwR9t38ncqYpP.json`

#### Architecture

Multi-stage pipeline with distinct implementation and validation phases.

#### Pipeline Stages

```
Manual Trigger / Schedule
       |
       v
Get Work Queue from Data Table
       |
       v
Packetize Work Items
       |
       v
Loop Over Packets
       |
       v
Route by Phase (Switch)
       |
  +----+----+
  |         |
  v         v
Initial   Validation
Phase     Phase
```

#### Phase 1: Initial Implementation

```
Build Initial Implementation Prompt
       |
       v
Execute Initial Implementation (GPT-OSS-20b)
       |
       v
Format Initial Output
       |
       v
Save Initial Output to NAS
```

#### Phase 2: Validation

```
Build Validation Prompt
       |
       v
Execute Validation (Claude Opus)
       |
       v
Parse Validation Results
       |
       v
Decision Router
       |
  +----+----+----+
  |    |    |    |
  v    v    v    v
Improve Iterate Correct Pass
```

---

## Supporting Workflows

### Issue Packets Loader Sub (J0Zf4eHFSQuqLv95)

**Status:** Active
**Node Count:** 24
**File:** `J0Zf4eHFSQuqLv95.json`

Sub-workflow callable by other workflows for loading issues from Linear into packets.

#### Integration Points

- Called by `Claudia Code 2` via `When Executed by Another Workflow` trigger
- Reads from Linear API
- Writes to N8N Data Tables

### Project Issues Loader - FIXED v2 (yNkPX6701TffSJof)

**Status:** Active
**Node Count:** 23
**File:** `yNkPX6701TffSJof.json`

Standalone version of the project/issues loader with chat interface.

---

## Model Infrastructure

### FREE Tier (Local LM Studio)

| Name | Model | Server | Credential ID |
|------|-------|--------|---------------|
| BEAST LM Studio | openai/gpt-oss-20b | Local | HE8StVq6t0epqs8Q |
| Bedroom LM Studio | qwen/qwen3-vl-8b | Local | FYFVsKzjVFK0h0V2 |

### PAID Tier (Cloud APIs)

| Name | Model | Provider |
|------|-------|----------|
| Claude Opus 4.5 | claude-opus-4-5 | Anthropic |
| GPT 5.1 Codex | gpt-5.1-codex | OpenAI |
| GPT 5.2 Latest | gpt-5.2-latest | OpenAI |
| Gemini 3 Flash | gemini-3-flash | Google |
| Gemini 2.5 Flash | gemini-2.5-flash | Google |
| NanoBanana | gemini-image-gen | Google |

---

## Data Tables

The workflows use N8N Data Tables for state management:

| Table | Purpose |
|-------|---------|
| ClaudiaCodeIssuePackets | Issue packet queue |
| ClaudiaCodeConversations | Conversation history and working memory |

---

## Webhook Endpoints

| Workflow | Path | Method |
|----------|------|--------|
| Claudia Execute Webhook (Working) | `/claudia-execute` | POST |
| Claudia Simple Webhook Test | `/webhook-test/claudia-simple` | POST |
| Autonomous Dev with Quality Loop | (webhook trigger) | POST |
| Packet Processor with Quality Check | (webhook trigger) | POST |

---

## Summary

The OrangePi N8N instance implements a sophisticated multi-tier AI orchestration system with:

1. **Cost Optimization** - Routes to FREE local models by default, escalates to PAID only when needed
2. **Quality Assurance** - Multi-stage validation loops with retry and correction mechanisms
3. **Parallel Processing** - Distributes work across multiple workers based on task classification
4. **Integration** - Deep integration with Linear for issue tracking and Git for code management
5. **Extensibility** - Sub-workflow architecture allows modular composition
