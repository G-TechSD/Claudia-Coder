# Claudia Code (Original) - N8N Workflow Analysis

**Rating: HIGH RELEVANCE - Production Orchestrator (v1)**

This is the original Claudia Code workflow - the predecessor to Claudia Code 2. While tagged as "OLD VERSION" with "HAS ISSUES", it contains valuable architecture patterns and is still marked as active.

---

## Overview

| Property | Value |
|----------|-------|
| **Workflow ID** | `ud7XYHk6QWFvgDxf` |
| **Name** | Claudia Code |
| **Status** | Active |
| **Created** | 2025-12-23T06:33:17.509Z |
| **Updated** | 2026-01-01T23:47:32.822Z |
| **Total Nodes** | 50 |
| **Tags** | WORKING, OLD VERSION, HAS ISSUES |
| **Purpose** | Multi-agent AI orchestrator with command routing and project management |

---

## Architecture Summary

```
                        +------------------+
                        |  Chat Trigger    |
                        | (Public Chat UI) |
                        +--------+---------+
                                 |
                 +---------------+---------------+
                 |                               |
                 v                               v
        +----------------+              +------------------+
        |  Orchestrator  |              | Project Selection|
        | (GPT-OSS-20b)  |              |     Flow         |
        +--------+-------+              +--------+---------+
                 |                               |
      +----------+----------+           +--------+---------+
      |                     |           |                  |
      v                     v           v                  v
[Direct Response]    [Command Parse]   [Linear Projects] [Set Active Project]
                           |
                           v
                    +------+------+
                    |   SWITCH    |
                    | (10 Routes) |
                    +------+------+
                           |
    +-----+-----+-----+----+----+-----+-----+-----+
    |     |     |     |    |    |     |     |     |
    v     v     v     v    v    v     v     v     v
  Free  Free  ChatGPT Gemini Claude Banana SSH   SSH
 Beast Bedroom               Code        OPi   Test
```

---

## Node Inventory (50 Nodes)

### Entry Points (2)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **When chat message received** | `chatTrigger` | Primary chat interface with custom styling |
| **openwebui-chat** | `webhook` | Alternative webhook entry (POST) |

### Orchestrator Layer (4)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Orchestrator** | `agent` | Main AI that routes to sub-agents |
| **OpenAI Chat Model** | `lmChatOpenAi` | GPT-OSS-20b via BEAST LMStudio |
| **Simple Memory6** | `memoryBufferWindow` | Orchestrator conversation memory |
| **Get row(s) in Data table** | `dataTableTool` | Tool for conversation history access |

### Project Management (8)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Linear Projects** | `httpRequest` | Fetches Linear projects with n8n label |
| **Message a model** | `openAi` | Formats project list for user selection |
| **Respond to Chat** | `chat` | Prompts user to select project |
| **Correlate User Selection** | `openAi` | Matches user input to project |
| **Set Active Project** | `set` | Stores selected project metadata |
| **Linear Issues by Project** | `httpRequest` | Fetches issues for selected project |
| **Message a model1** | `openAi` | Formats issues for display |
| **Respond to Chat1** | `chat` | Shows project issues to user |

### Command Processing (3)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Current Full Prompt** | `set` | Extracts prompt from orchestrator |
| **Set Active Command and Separate Prompt** | `code` | Parses slash commands |
| **Upsert row(s)** | `dataTable` | Persists command to settings |

### Command Router (1)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Switch** | `switch` | Routes to different agents (10 outputs) |

### FREE LLM Agents (4)

| Node Name | Model | Server |
|-----------|-------|--------|
| **FREE Primary LM Studio Server** | - | Sub-agent wrapper |
| **FREE Beast LM Studio** | `openai/gpt-oss-20b` | BEAST (192.168.245.155:1234) |
| **FREE Secondary LM Studio Server** | - | Sub-agent wrapper |
| **FREE Secondary LM Studio qwen3-vl-8b** | `qwen3-vl-8b` | Bedroom (192.168.27.182:1234) |

### PAID LLM Agents (8)

| Node Name | Model | Provider |
|-----------|-------|----------|
| **PAID ChatGPT** | - | Sub-agent wrapper |
| **PAID ChatGPT1** | `gpt-5.1` | OpenAI API |
| **PAID Gemini** | - | Sub-agent wrapper |
| **PAID Gemini 3 Flash** | `gemini-3-flash-preview` | Google |
| **PAID Anthropic** | - | Sub-agent wrapper |
| **PAID Claude Opus 4.5** | `claude-opus-4-5-20251101` | Anthropic |
| **PAID NanoBanana** | - | Sub-agent wrapper |
| **PAID Nano Banana2** | `gemini-2.5-flash-image` | Google (Image Gen) |

### SSH Agents (3)

| Node Name | Target | Purpose |
|-----------|--------|---------|
| **Claude Code on OrangePi** | OrangePi | Runs `claude -p` via SSH |
| **SSH Command on OrangePi1** | OrangePi | General bash commands |
| **SSH Command on Testing System** | Test System | Bash commands on test env |

### Memory Nodes (8)

| Node Name | Connected To |
|-----------|--------------|
| Simple Memory | PAID ChatGPT |
| Simple Memory1 | Unused |
| Simple Memory2 | FREE Primary |
| Simple Memory3 | PAID Anthropic |
| Simple Memory4 | PAID Gemini |
| Simple Memory5 | PAID NanoBanana |
| Simple Memory6 | Orchestrator |
| Simple Memory7 | Project Agent |

### Response & Persistence (8)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Respond to Chat2** | `chat` | Returns sub-agent output |
| **Respond to Chat3** | `chat` | Returns orchestrator output |
| **Respond to Webhook** | `respondToWebhook` | Webhook response (disabled) |
| **Save Message and Prompt** | `dataTable` | Saves orchestrator messages |
| **Save SubAgent Output** | `dataTable` | Saves sub-agent responses |
| **Get row(s)** | `dataTable` | Retrieves settings |
| **Upsert row(s)** | `dataTable` | Updates settings |
| **Upsert row(s)1** | `dataTable` | Project data persistence |

### Control Flow (2)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **If** | `if` | Conditional routing |
| **Project Agent** | `agent` | Handles project-specific queries |

---

## Command Routing System

| Command | Target |
|---------|--------|
| `/projects:` | Project selection flow |
| `/primary_free:` | FREE Beast LM Studio |
| `/secondary_free:` | FREE Secondary LM Studio |
| `/paid_chatgpt:` | OpenAI GPT-5.1 |
| `/paid_gemini:` | Google Gemini 3 Flash |
| `/paid_claude:` | Anthropic Claude Opus 4.5 |
| `/paid_nanobanana:` | Google Gemini Image Gen |
| `/paid_claude_code:` | SSH Claude Code on OrangePi |
| `/ssh_n8n_host:` | SSH to OrangePi |
| `/ssh_testing_host:` | SSH to Testing System |

---

## Comparison: Claudia Code vs Claudia Code 2

| Feature | Claudia Code (v1) | Claudia Code 2 |
|---------|-------------------|----------------|
| **Node Count** | 50 | 38 |
| **Project Management** | Built-in (8 nodes) | Separate sub-workflow |
| **Secondary LLM** | qwen3-vl-8b | Nemotron cascade |
| **Tags** | OLD VERSION, HAS ISSUES | Reference Implementation |
| **Architecture** | Monolithic | Modular |
| **Linear Integration** | Direct | Via Issue Packets Loader |

---

## Known Issues (Tagged "HAS ISSUES")

Based on the workflow structure, likely issues include:

1. **Monolithic Design** - 50 nodes in single workflow makes maintenance difficult
2. **Project Flow Complexity** - 8 nodes for project selection inline with chat routing
3. **Memory Management** - 8 separate memory nodes may cause confusion
4. **Duplication** - Some patterns duplicated that were later extracted to sub-workflows in v2

---

## What Made This Valuable

1. **First Working Multi-Agent Router** - Proved the slash-command routing pattern
2. **Cost Optimization** - Established free/paid tier separation
3. **SSH Integration** - Direct Claude Code execution via SSH
4. **Conversation Persistence** - Data table storage for history

---

## Rating: 7/10

| Category | Score | Notes |
|----------|-------|-------|
| **Architecture** | 6/10 | Monolithic, complex |
| **Functionality** | 8/10 | Full-featured |
| **Maintainability** | 5/10 | Too many nodes |
| **Historical Value** | 9/10 | Reference for v2 |
| **Current Relevance** | 6/10 | Superseded by v2 |

**Recommendation:** Use Claudia Code 2 for production. Keep this as reference for understanding the evolution of the architecture.

---

## Files

- **JSON Export**: `/home/bill/projects/claudia-admin/public/workflows/analysis/claudia-code-original.json`
- **This Analysis**: `/home/bill/projects/claudia-admin/public/workflows/analysis/claudia-code-original.md`

---

*Analysis generated: 2026-01-08*
*Source: N8N Instance at 192.168.245.11:5678 (OrangePi)*
