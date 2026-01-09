# Project Issues Loader - FIXED v2 - N8N Workflow Analysis

**Rating: HIGH RELEVANCE - Critical Production Component**

This is a more recent version of the Issue Packets Loader, with enhanced prompts for complete issue data extraction.

---

## Overview

| Property | Value |
|----------|-------|
| **Workflow ID** | `yNkPX6701TffSJof` |
| **Name** | Project Issues Loader - FIXED v2 |
| **Status** | Active |
| **Created** | 2025-12-28T23:04:57.905Z |
| **Updated** | 2026-01-02T07:28:31.796Z |
| **Version Counter** | 101 |
| **Total Nodes** | 22 |
| **Tags** | WORKING, OLD VERSION, SANDBOX |
| **Purpose** | Load Linear issues and create work packets for Dev Agents |

---

## Architecture

```
[Chat Trigger]
      |
      v
[Linear Projects] --> [Format Project List] --> [Respond to Chat]
                                                       |
                                                       v
                                           [Resolve Project Selection]
                                                       |
                                                       v
                                             [Set Active Project]
                                                       |
                                                       v
                                             [Build Project Row]
                                                       |
                                                       v
                                              [Upsert Project]
                                                       |
                                                       v
                                            [Project Manager (AI)]
                                                       |
                                                       v
                                          [Normalize Plan Output]
                                                       |
                                                       v
                                              [Upsert row(s)1]
                                                       |
                                                       v
                                       [Project Issues Loader1 (AI Agent)]
                                                       |
                                                       v
                                          [Split Packets Items]
                                                       |
                                                       v
                                             [Split Packets]
                                                       |
                            +--------------------------|---------------------------+
                            |                                                      |
                            v                                                      v
               [Upsert Issue Packets]                           [Aggregate Packets For Summary]
                            |                                                      |
                            +----------> [Loop] <-----------------+               |
                                                                                   v
                                                                       [Format Response (AI)]
                                                                                   |
                                                                                   v
                                                                       [Respond to Chat1]
```

---

## Node Inventory (22 Nodes)

### Triggers (1)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **When chat message received** | `chatTrigger` | Interactive chat for project selection |

### Linear Integration (1)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Linear Projects** | `httpRequest` | GraphQL query for projects with "n8n" label |

### Project Selection Flow (4)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Format Project List** | `code` | Transforms Linear response to numbered list |
| **Respond to Chat** | `chat` | Prompts user to select project |
| **Resolve Project Selection** | `code` | Parses user input (number or fuzzy name match) |
| **Set Active Project** | `set` | Stores project ID, name, description, state |

### Data Persistence (4)

| Node Name | Type | Data Table |
|-----------|------|------------|
| **Build Project Row** | `code` | Prepares row for ClaudiaCodeProjects |
| **Upsert Project** | `dataTable` | ClaudiaCodeProjects |
| **Upsert row(s)1** | `dataTable` | ClaudiaCodeProjectPlans |
| **Upsert Issue Packets** | `dataTable` | ClaudiaCodeIssuePackets |

### AI Agents (3)

| Node Name | Type | Model | Purpose |
|-----------|------|-------|---------|
| **Project Manager** | `openAi` v2.1 | GPT-OSS-20b | Creates initial project plan JSON |
| **Project Issues Loader1** | `agent` v3 | GPT-OSS-20b | Main packetizer - creates work packets |
| **Format Response** | `openAi` v2.1 | GPT-OSS-20b | Creates human-readable summary |

### Data Processing (5)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Normalize Plan Output** | `code` | Extracts JSON from AI output |
| **Split Packets Items** | `code` | Robust JSON parser with multiple fallbacks |
| **Split Packets** | `splitInBatches` | Processes packets in batches of 25 |
| **Aggregate Packets For Summary** | `code` | Aggregates data for final summary |
| **Get Packets For Summary** | `dataTableTool` | AI tool for packet retrieval |

### Memory & LLM (3)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **GPT-OSS-20B** | `lmChatOpenAi` | Language model with 320s timeout |
| **Simple Memory** | `memoryBufferWindow` | 200-context window |
| **get_rows_issues1** | `dataTableTool` | Tool for fetching issues |

### Response (1)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Respond to Chat1** | `chat` | Returns final summary to user |

---

## Key Enhancement: Complete Issue Data

The "FIXED v2" version emphasizes including COMPLETE issue objects in packets:

### Required Issue Fields (per prompt)

```json
{
  "id": "LinearIssueID",
  "title": "IssueTitle",
  "description": "IssueDescription",
  "acceptanceCriteria": "AcceptanceCriteria",
  "state": "IssueState",
  "priority": "IssuePriority",
  "labels": "parsed array",
  "estimate": "EstimatedEffort",
  "attachments": "parsed array",
  "parentIssueId": "ParentIssueID",
  "relatedIssues": "parsed array",
  "assigneeId": "AssigneeID",
  "createdAt": "CreatedAt",
  "updatedAt": "UpdatedAt"
}
```

### Validation Checklist in Prompt

The AI is explicitly instructed to verify:
- Called get_rows_issues1 and got issue data
- Each issue has complete fields (not just ID stubs)
- All timestamps and metadata included

---

## Worker Assignment Logic

| Worker | Use Case |
|--------|----------|
| `worker_bee_opus` | UX/polish, ambiguous requirements, copy, interaction design |
| `worker_bee_gptoss` | Implementation-heavy, infra/tooling, deterministic engineering |

---

## Data Tables Used

| Table | Purpose |
|-------|---------|
| ClaudiaCodeProjects | Project metadata |
| ClaudiaCode Issues | Issue data from Linear |
| ClaudiaCodeProjectPlans | Project plans and summaries |
| ClaudiaCodeIssuePackets | Individual work packets |

---

## Comparison: v2 vs Issue Packets Loader Sub

| Feature | Project Issues Loader v2 | Issue Packets Loader Sub |
|---------|--------------------------|--------------------------|
| **ID** | `yNkPX6701TffSJof` | `J0Zf4eHFSQuqLv95` |
| **Complete Issue Data** | Emphasized in prompts | Less explicit |
| **Version Counter** | 101 | 25 |
| **Validation Checklist** | Explicit in prompt | Implicit |
| **Worker Routing** | worker_bee_opus/gptoss | Same |

Both serve similar purposes but v2 has more explicit data completeness requirements.

---

## Issues and Concerns

### Minor Issues

1. **Long Timeouts** - 320 second timeout may cause workflow execution issues
2. **High Max Iterations** - 500 iterations could run away
3. **Duplicate Workflows** - Similar to Issue Packets Loader Sub

### No Critical Issues

The workflow appears well-structured with proper error handling.

---

## Rating: 8/10

| Category | Score | Notes |
|----------|-------|-------|
| **Architecture** | 8/10 | Well-structured pipeline |
| **Robustness** | 8/10 | Good JSON parsing fallbacks |
| **AI Prompts** | 9/10 | Detailed with validation checklists |
| **Data Integration** | 9/10 | Comprehensive table usage |
| **Relevance** | 8/10 | Critical for autonomous dev |

**Recommendation:** Consider consolidating with Issue Packets Loader Sub to reduce duplication. This v2 version has better prompts for data completeness.

---

## Files

- **JSON Export**: `/home/bill/projects/claudia-admin/public/workflows/analysis/project-issues-loader-v2.json`
- **This Analysis**: `/home/bill/projects/claudia-admin/public/workflows/analysis/project-issues-loader-v2.md`

---

*Analysis generated: 2026-01-08*
*Source: N8N Instance at 192.168.245.11:5678 (OrangePi)*
