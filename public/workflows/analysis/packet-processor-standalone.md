# Packet Processor (Standalone) - Workflow Analysis

**Relevance Rating:** HIGH RELEVANCE - Tested and Working

**Workflow ID:** `NC7qyAYViYGWaFLr`
**Source:** N8N Instance at `192.168.245.211:5678`
**Created:** 2026-01-08 03:53:36
**Status:** Inactive (Manual Trigger)
**Export Location:** `/home/bill/projects/claudia-admin/public/workflows/analysis/packet-processor-standalone.json`

---

## Overview

This workflow processes development issue packets from an N8N Data Table, sends them to AI agents for implementation, and outputs structured markdown files. It features **two parallel processing pipelines** that can utilize different LLM backends (BEAST and BEDROOM servers).

The workflow is designed as a **standalone packet processor** that:
1. Reads issue packets from the `ClaudiaCodeIssuePackets` data table
2. Iterates through each packet using batch processing
3. Extracts and parses packet JSON data
4. Generates structured prompts for AI code generation
5. Routes to AI agents with configurable LLM models
6. Formats output as comprehensive markdown documentation
7. Writes files to the NAS storage (`/mnt/n8n-nas/packet_outputs/`)

---

## Node Inventory (14 Nodes)

| Node Name | Type | Purpose |
|-----------|------|---------|
| Start Processing | `manualTrigger` | Manual trigger to initiate workflow |
| Get row(s) | `dataTable` | Reads packets from ClaudiaCodeIssuePackets table |
| Process Each Packet | `splitInBatches` | Iterates through packets one at a time |
| Extract Packet Data | `code` | Parses packet JSON and determines worker model |
| Format Work Prompt | `code` | Generates structured prompt for AI agent |
| Worker Agent | `langchain.agent` | Primary AI agent (BEAST server) |
| GPT-OSS-20b Model | `langchain.lmChatOpenAi` | LLM model for primary agent |
| Format File Output | `code` | Formats AI output as markdown |
| Write File | `code` | Writes markdown to filesystem |
| Worker Agent1 | `langchain.agent` | Secondary AI agent (BEDROOM server) |
| bedroom quen3 | `langchain.lmChatOpenAi` | LLM model for secondary agent |
| Format File Output1 | `code` | Formats AI output for secondary pipeline |
| Write File1 | `code` | Writes markdown for secondary pipeline |

---

## Detailed Node Analysis

### 1. Start Processing (Manual Trigger)
**Type:** `n8n-nodes-base.manualTrigger`
**Purpose:** Entry point for the workflow. Requires manual execution to begin processing.

---

### 2. Get row(s) (Data Table Reader)
**Type:** `n8n-nodes-base.dataTable`
**Purpose:** Reads all packets from the N8N Data Table

**Configuration:**
- **Operation:** `get`
- **Data Table ID:** `uY29FyKg9JFPZa9a`
- **Data Table Name:** `ClaudiaCodeIssuePackets`
- **Project:** `CDNyPtsGxHdhfdhy`
- **Return All:** `true` (fetches all rows)

**Data Table URL:** `/projects/CDNyPtsGxHdhfdhy/datatables/uY29FyKg9JFPZa9a`

---

### 3. Process Each Packet (Split In Batches)
**Type:** `n8n-nodes-base.splitInBatches`
**Purpose:** Iterates through packets one at a time with loop support

**Configuration:**
- **Reset:** `false` (maintains state across iterations)

**Outputs:**
- Output 0: Empty (batch complete signal)
- Output 1: Current packet to process

---

### 4. Extract Packet Data (Code Node)
**Type:** `n8n-nodes-base.code`
**Purpose:** Parses packet JSON and determines which AI worker model to use

**Key Logic:**
```javascript
// Parse packetJSON field from data table row
let issueData = JSON.parse(packet.packetJSON);

// Worker model selection based on assignedWorker field:
// - "secondary" -> "Nemotron Cascade (Secondary Free)"
// - "opus" or "claude" -> "Claude Opus 4.5 (Paid)"
// - "chatgpt" -> "GPT-5.1 (Paid)"
// - "gemini" -> "Gemini 3 Flash (Paid)"
// - default -> "GPT-OSS-20b"
```

**Output Schema:**
```json
{
  "packetID": "string",
  "issueId": "string",
  "title": "string",
  "description": "string",
  "acceptanceCriteria": "string",
  "assignedWorker": "string",
  "modelName": "string",
  "_fullIssueData": "object",
  "_originalPacket": "object"
}
```

---

### 5. Format Work Prompt (Code Node)
**Type:** `n8n-nodes-base.code`
**Purpose:** Generates a structured prompt for the AI agent

**Prompt Template:**
```
You are an AI software developer processing a development issue.

ISSUE DETAILS
- Issue ID, Title, Description, Acceptance Criteria

YOUR TASK
1. Implementation: Full code files with complete content
2. Testing: Test cases and testing approach
3. Metadata: Assumptions, dependencies, next steps

IMPORTANT:
- Write FULL, COMPLETE code (not snippets or TODOs)
- Include all necessary imports and dependencies
- Consider edge cases and error handling
- Provide actual working code that can be used
```

---

### 6. Worker Agent (LangChain Agent - Primary)
**Type:** `@n8n/n8n-nodes-langchain.agent`
**Purpose:** Primary AI agent for code generation

**Configuration:**
- **Prompt Type:** `define`
- **Text Source:** `{{ $json.workPrompt }}`
- **System Message:** "You are an expert software developer. Provide complete, working implementations. No placeholders, no TODOs - write full, production-ready code."
- **Max Iterations:** 10

---

### 7. GPT-OSS-20b Model (LLM Model - Primary)
**Type:** `@n8n/n8n-nodes-langchain.lmChatOpenAi`
**Purpose:** LLM backend for primary Worker Agent

**Configuration:**
- **Model:** `openai/gpt-oss-20b`
- **Timeout:** 120000ms (2 minutes)
- **Credentials:** `BEAST LMStudio` (ID: `HE8StVq6t0epqs8Q`)
- **Server:** BEAST LMStudio server

---

### 8. Format File Output (Code Node)
**Type:** `n8n-nodes-base.code`
**Purpose:** Formats AI output as a structured markdown file

**Filename Pattern:**
```
{title}-{issueId}-{HH_MM_SS}-{MM}-{DD}-{YYYY}.md
```

**Output Path:**
```
/mnt/n8n-nas/packet_outputs/BEAST-{filename}
```

**Markdown Template:**
```markdown
# {issueId} - {title}

**Timestamp:** {ISO timestamp}
**Packet ID:** {packetID}
**Project ID:** {projectID}
**Plan Run ID:** {planRunID}
**Worker:** {modelName}
**Issue IDs:** {issueIDs}

---

## Issue Details
**Title:** {title}
**Description:** {description}
**Acceptance Criteria:** {acceptanceCriteria}

---

## Implementation Output
{agentOutput}

---

## Metadata
**Packet Data:**
- Packet ID, Project ID, Plan Run ID
- Assigned Worker, Model Used, Issue ID

---
*Generated by Claudia Code 2 - Packet Processor*
*Processing completed at {timestamp}*
```

---

### 9. Write File (Code Node)
**Type:** `n8n-nodes-base.code`
**Purpose:** Writes the markdown content to the filesystem

**Key Logic:**
```javascript
const fs = require('fs');
const path = require('path');

// Ensure directory exists
const dir = path.dirname(filePath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Write file
fs.writeFileSync(filePath, content, 'utf8');
```

**Output:**
```json
{
  "success": true,
  "filePath": "/mnt/n8n-nas/packet_outputs/BEAST-{filename}",
  "fileName": "{filename}",
  "bytesWritten": "number",
  "timestamp": "ISO string"
}
```

---

### 10. Worker Agent1 (LangChain Agent - Secondary)
**Type:** `@n8n/n8n-nodes-langchain.agent`
**Purpose:** Secondary AI agent (alternate processing pipeline)

**Configuration:** Same as primary Worker Agent
- References `Format Work Prompt1` node (not connected in current workflow)

---

### 11. bedroom quen3 (LLM Model - Secondary)
**Type:** `@n8n/n8n-nodes-langchain.lmChatOpenAi`
**Purpose:** LLM backend for secondary Worker Agent

**Configuration:**
- **Model:** `qwen/qwen3-vl-8b`
- **Timeout:** 120000ms (2 minutes)
- **Credentials:** `Bedroom LMStudio` (ID: `FYFVsKzjVFK0h0V2`)
- **Server:** BEDROOM LMStudio server

---

### 12. Format File Output1 (Code Node)
**Type:** `n8n-nodes-base.code`
**Purpose:** Formats AI output for secondary pipeline

**Output Path:**
```
/mnt/n8n-nas/packet_outputs/BEDROOM-{filename}
```

---

### 13. Write File1 (Code Node)
**Type:** `n8n-nodes-base.code`
**Purpose:** Writes markdown for secondary pipeline

---

## Connection Flow

### Primary Processing Pipeline (Active)
```
Start Processing
    |
    v
Get row(s) [Data Table: ClaudiaCodeIssuePackets]
    |
    v
Process Each Packet [Loop]
    |
    +--(Output 1)-> Extract Packet Data
                        |
                        v
                    Format Work Prompt
                        |
                        v
                    Worker Agent <-- GPT-OSS-20b Model
                        |
                        v
                    Format File Output
                        |
                        v
                    Write File
                        |
                        +--> Process Each Packet [Loop Back]
```

### Secondary Processing Pipeline (Disconnected)
```
Worker Agent1 <-- bedroom quen3 (qwen3-vl-8b)
    |
    v
Format File Output1
    |
    v
Write File1
    |
    v
[End]
```

**Note:** The secondary pipeline (Worker Agent1, bedroom quen3, Format File Output1, Write File1) exists but is not connected to the main flow. It appears to be a template for parallel processing or an alternate worker.

---

## Data Table Integration

### Source Data Table: ClaudiaCodeIssuePackets
- **Table ID:** `uY29FyKg9JFPZa9a`
- **Project ID:** `CDNyPtsGxHdhfdhy`

### Expected Packet Schema
```json
{
  "packetID": "string",
  "packetJSON": "string (JSON encoded)",
  "assignedWorker": "string",
  "projectID": "string",
  "planRunID": "string",
  "issueIDs": "string"
}
```

### packetJSON Field Structure
```json
{
  "issueId": "string",
  "title": "string",
  "description": "string",
  "acceptanceCriteria": "string"
}
```

---

## Output Configuration

### File Output Location
- **Primary Pipeline:** `/mnt/n8n-nas/packet_outputs/BEAST-{filename}`
- **Secondary Pipeline:** `/mnt/n8n-nas/packet_outputs/BEDROOM-{filename}`

### Filename Format
```
{sanitized_title}-{sanitized_issueId}-{HH}_{MM}_{SS}-{MM}-{DD}-{YYYY}.md
```

**Sanitization Rules:**
- Remove special characters (keep: a-z, A-Z, 0-9, -, _, space)
- Title limited to 50 characters
- Project ID limited to 30 characters
- Spaces converted to underscores

---

## Worker Model Routing

The `Extract Packet Data` node determines which AI model to use based on the `assignedWorker` field:

| assignedWorker contains | Model Name |
|------------------------|------------|
| `secondary` | Nemotron Cascade (Secondary Free) |
| `opus` or `claude` | Claude Opus 4.5 (Paid) |
| `chatgpt` | GPT-5.1 (Paid) |
| `gemini` | Gemini 3 Flash (Paid) |
| (default) | GPT-OSS-20b |

**Note:** The model routing logic exists in the code but the actual agent only uses GPT-OSS-20b via the BEAST LMStudio server in the current configuration.

---

## Credentials Used

| Credential Name | ID | Type | Server |
|----------------|-----|------|--------|
| BEAST LMStudio | `HE8StVq6t0epqs8Q` | OpenAI API | Primary LMStudio |
| Bedroom LMStudio | `FYFVsKzjVFK0h0V2` | OpenAI API | Secondary LMStudio |

---

## Settings

```json
{
  "executionOrder": "v1",
  "availableInMCP": false,
  "timeSavedMode": "fixed",
  "callerPolicy": "workflowsFromSameOwner"
}
```

---

## Key Observations

### Strengths
1. **Batch Processing:** Uses splitInBatches for iterating through multiple packets
2. **Error Handling:** Try-catch for JSON parsing with fallback
3. **Directory Safety:** Creates output directories recursively if missing
4. **Comprehensive Output:** Markdown includes full metadata and traceability
5. **Flexible Worker Routing:** Built-in logic for multiple AI model backends
6. **Timestamp Traceability:** Every output includes precise timestamps

### Architecture Notes
1. **Dual Pipeline Design:** Two complete processing pipelines exist (BEAST/BEDROOM)
2. **Secondary Pipeline Disconnected:** Worker Agent1 pipeline is not connected to main flow
3. **Loop-Back Pattern:** Write File connects back to Process Each Packet for batch iteration
4. **Data Table Native:** Uses N8N's built-in Data Table feature (not external DB)

### File System Integration
- Writes directly to NAS at `/mnt/n8n-nas/packet_outputs/`
- Uses Node.js `fs` module within Code nodes
- Creates directories automatically

---

## Usage

1. **Prepare Data:** Populate the `ClaudiaCodeIssuePackets` data table with issue packets
2. **Execute:** Manually trigger the workflow via "Start Processing" node
3. **Monitor:** Watch execution progress in N8N UI
4. **Output:** Find markdown files in `/mnt/n8n-nas/packet_outputs/BEAST-*.md`

---

## Related Resources

- **JSON Export:** `/home/bill/projects/claudia-admin/public/workflows/analysis/packet-processor-standalone.json`
- **N8N Instance:** `https://192.168.245.211:5678`
- **Data Table URL:** `/projects/CDNyPtsGxHdhfdhy/datatables/uY29FyKg9JFPZa9a`

---

*Analysis generated: 2026-01-08*
*Workflow version: NC7qyAYViYGWaFLr*
