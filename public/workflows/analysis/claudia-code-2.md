# Claudia Code 2 - N8N Workflow Analysis

**Rating: HIGH RELEVANCE - Reference Implementation**

This is the USER'S FAVORITE workflow - the gold standard for how N8N AI agent orchestration should be implemented.

---

## Overview

| Property | Value |
|----------|-------|
| **Workflow ID** | `4p4rBF0F4Ku5aY8x` |
| **Name** | Claudia Code 2 |
| **Status** | Active |
| **Created** | 2026-01-01T23:52:08.600Z |
| **Updated** | 2026-01-01T23:52:50.269Z |
| **Total Nodes** | 38 |
| **Purpose** | Multi-agent AI orchestrator with command-based routing to free and paid LLM providers |

---

## Architecture Summary

```
                                    +------------------+
                                    |  Chat Trigger    |
                                    | (Public Chat UI) |
                                    +--------+---------+
                                             |
                                             v
                                    +------------------+
                                    |   Orchestrator   |
                                    | (GPT-OSS-20b)    |
                                    +--------+---------+
                                             |
                        +--------------------+--------------------+
                        |                                         |
                        v                                         v
               +----------------+                        +------------------+
               | Respond Chat3  |                        | Current Prompt   |
               | (Save to DB)   |                        +--------+---------+
               +----------------+                                 |
                                                                  v
                                                        +------------------+
                                                        | Parse Command &  |
                                                        | Separate Prompt  |
                                                        +--------+---------+
                                                                  |
                                                                  v
                                                        +------------------+
                                                        | Upsert Settings  |
                                                        | (Data Table)     |
                                                        +--------+---------+
                                                                  |
                                                                  v
                                                        +------------------+
                                                        |     SWITCH       |
                                                        | (10 Routes)      |
                                                        +--------+---------+
                                                                  |
                    +----------+----------+----------+----------+----------+
                    |          |          |          |          |          |
                    v          v          v          v          v          v
              [Projects] [Primary] [Secondary] [ChatGPT] [Gemini] [Claude]...
                    |          |          |          |          |          |
                    +----------+----------+----------+----------+----------+
                                                                  |
                                                                  v
                                                        +------------------+
                                                        | Respond to Chat2 |
                                                        +--------+---------+
                                                                  |
                                                                  v
                                                        +------------------+
                                                        | Save SubAgent    |
                                                        | Output (Data)    |
                                                        +------------------+
```

---

## Node Inventory (38 Nodes)

### Entry Points (2)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **When chat message received** | `chatTrigger` | Public chat interface with custom CSS styling, n8n user authentication |
| **openwebui-chat** | `webhook` | Alternative webhook entry point (POST) |

### Orchestrator Layer (4)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Orchestrator** | `agent` | Main AI orchestrator that routes messages to sub-agents based on commands |
| **OpenAI Chat Model** | `lmChatOpenAi` | GPT-OSS-20b model (BEAST LMStudio) powering the orchestrator |
| **Simple Memory6** | `memoryBufferWindow` | Conversation memory for orchestrator |
| **Get row(s) in Data table** | `dataTableTool` | Tool for orchestrator to read conversation history |

### Command Processing (3)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Current Full Prompt** | `set` | Extracts chatInput from orchestrator output |
| **Set Active Command and Separate Prompt** | `code` | Parses slash commands, separates command from prompt text |
| **Upsert row(s)** | `dataTable` | Persists selected command and session to ClaudiaCodeSettings |

### Command Router (1)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Switch** | `switch` | Routes to different agents based on parsed command (10 outputs) |

### FREE LLM Agents (4)

| Node Name | Type | Model | Server |
|-----------|------|-------|--------|
| **FREE Primary LM Studio Server** | `agent` | - | Sub-agent wrapper |
| **FREE Beast LM Studio** | `lmChatOpenAi` | `openai/gpt-oss-20b` | BEAST LMStudio (192.168.245.155:1234) |
| **FREE Secondary LM Studio Server** | `agent` | - | Sub-agent wrapper |
| **FREE Secondary LM Studio Opus 4.5** | `lmChatOpenAi` | `nemotron-cascade-8b-thinking-claude-4.5-opus-high-reasoning-distill` | Bedroom LMStudio (192.168.27.182:1234) |

### PAID LLM Agents (8)

| Node Name | Type | Model | Provider |
|-----------|------|-------|----------|
| **PAID ChatGPT** | `agent` | - | Sub-agent wrapper |
| **PAID ChatGPT1** | `lmChatOpenAi` | `gpt-5.1` | OpenAI API |
| **PAID Gemini** | `agent` | - | Sub-agent wrapper |
| **PAID Gemini 3 Flash** | `lmChatGoogleGemini` | `models/gemini-3-flash-preview` | Google Gemini |
| **PAID Anthropic** | `agent` | - | Sub-agent wrapper |
| **PAID Claude Opus 4.5** | `lmChatAnthropic` | `claude-opus-4-5-20251101` | Anthropic (with thinking enabled) |
| **PAID NanoBanana** | `agent` | - | Sub-agent wrapper |
| **PAID Nano Banana2** | `lmChatGoogleGemini` | `models/gemini-2.5-flash-image` | Google Gemini (Image Gen) |

### SSH Agents (3)

| Node Name | Type | Purpose | Status |
|-----------|------|---------|--------|
| **Claude Code on OrangePi** | `ssh` | Runs `claude -p "<prompt>"` via SSH on OrangePi | Active |
| **SSH Command on OrangePi1** | `ssh` | General bash commands on OrangePi | Disabled |
| **SSH Command on Testing System** | `ssh` | Bash commands on testing environment | Disabled |

### Memory Nodes (6)

| Node Name | Connected To |
|-----------|--------------|
| Simple Memory | PAID ChatGPT |
| Simple Memory1 | (Unused) |
| Simple Memory2 | FREE Primary LM Studio Server |
| Simple Memory3 | PAID Anthropic |
| Simple Memory4 | PAID Gemini |
| Simple Memory5 | PAID NanoBanana |
| Simple Memory6 | Orchestrator |

### Response Handlers (2)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Respond to Chat2** | `chat` | Returns sub-agent output to chat UI with optional header |
| **Respond to Chat3** | `chat` | Returns orchestrator output directly |
| **Respond to Webhook** | `respondToWebhook` | Webhook response (disabled) |

### Data Persistence (4)

| Node Name | Type | Data Table | Purpose |
|-----------|------|------------|---------|
| **Upsert row(s)** | `dataTable` | ClaudiaCodeSettings | Stores selected command and session |
| **Save Message and Prompt** | `dataTable` | Claudia Code Conversations | Saves orchestrator messages |
| **Save SubAgent Output** | `dataTable` | Claudia Code Conversations | Saves sub-agent responses |
| **Get row(s) in Data table1** | `dataTableTool` | ClaudiaCodeSettings | Orchestrator tool for settings |

### Workflow Calls (1)

| Node Name | Type | Purpose |
|-----------|------|---------|
| **Call 'Issue Packets Loader Sub'** | `executeWorkflow` | Called when `/projects:` command is used |

---

## Command Routing System

The workflow uses slash commands to route messages to specific LLM agents:

| Command | Route | Target |
|---------|-------|--------|
| `/projects:` | Project Selection | Issue Packets Loader Sub workflow |
| `/primary_free:` | Primary Free Model | FREE Beast LM Studio (GPT-OSS-20b) |
| `/secondary_free:` | Secondary Free Model | FREE Secondary LM Studio (Nemotron) |
| `/paid_chatgpt:` | Paid ChatGPT | OpenAI GPT-5.1 |
| `/paid_gemini:` | Paid Gemini | Google Gemini 3 Flash |
| `/paid_claude:` | Paid Claude | Anthropic Claude Opus 4.5 |
| `/paid_nanobanana:` | Paid Nano Banana | Google Gemini 2.5 Flash Image |
| `/paid_claude_code:` | Paid Claude Code | SSH to OrangePi running `claude -p` |
| `/ssh_n8n_host:` | SSH to n8n host | SSH commands on OrangePi |
| `/ssh_testing_host:` | SSH to Testing | SSH commands on testing system |

---

## Command Parsing Logic

The `Set Active Command and Separate Prompt` node contains critical logic:

```javascript
// Key behavior:
// 1. If input starts with '/', extract command and prompt separately
// 2. If no message after command, use placeholder prompt
// 3. Ensure commands end with colon where needed
// 4. Default to /primary_free: if no command specified
// 5. Track session changes for header display

if (input.startsWith('/')) {
  showHeader = true;
  const firstSpaceIndex = input.indexOf(' ');
  if (firstSpaceIndex === -1) {
    commandToUse = input;
    promptText = "Please answer the previous question again...";
  } else {
    commandToUse = input.substring(0, firstSpaceIndex).trim();
    promptText = input.substring(firstSpaceIndex + 1).trim();
  }
} else {
  // Normal chat - use stored or default command
  commandToUse = dbStoredCommand ? dbStoredCommand : "/primary_free:";
}
```

---

## Orchestrator System Prompt

The orchestrator is configured with a sophisticated system prompt that:

1. **Routes to Sub-agents**: Uses special tag `<!@<!@<!ENGAGE AI SUB AGENT!>@!>@!>` to signal routing
2. **Preserves User Prompts**: Maintains exact wording when forwarding to sub-agents
3. **Cost Optimization**: Defaults to free LLM servers, requires permission for paid resources
4. **Context Awareness**: Uses data table tool to access conversation history
5. **Direct Response Mode**: When user addresses "orchestrator" directly, responds without routing

Key rules:
- Commands MUST be at the beginning of output
- Sub-agent tag MUST be at the end
- Never include channel tags in output
- Add "ORCHESTRATOR:" header for direct responses

---

## Data Tables Used

### 1. ClaudiaCodeSettings
- **Purpose**: Stores user preferences and session state
- **Fields**:
  - `selected_command` - Current default command
  - `last_session_id` - For detecting session changes
  - `free_only` - Boolean flag for cost control

### 2. Claudia Code Conversations
- **Purpose**: Conversation history and working memory
- **Fields**:
  - `message` - The message content
  - `source` - Which agent/orchestrator sent it
  - `prompt` - Original user prompt
  - `session_id` - Session identifier
  - `previous_message_id` - For threading

---

## Connection Flow

### Main Flow
```
Chat Trigger --> Orchestrator --> Current Full Prompt --> Parse Command --> Upsert Settings --> Switch
                     |
                     +--> Respond to Chat3 --> Save Message and Prompt
```

### Sub-agent Flow (for each command route)
```
Switch --> [Sub-agent] --> Respond to Chat2 --> Save SubAgent Output
```

### AI Model Connections
```
LLM Model Node --[ai_languageModel]--> Agent Node
Memory Node --[ai_memory]--> Agent Node
DataTable Tool --[ai_tool]--> Orchestrator
```

---

## What Makes This Workflow Work Well

### 1. Intelligent Command Routing
- Slash commands provide explicit control over which LLM handles each request
- Default to free resources, only use paid when specified
- Sticky command preferences persist across sessions

### 2. Hybrid Architecture
- **Free Local LLMs**: BEAST and Bedroom LMStudio servers for cost-free operation
- **Paid Cloud LLMs**: ChatGPT, Gemini, Claude for advanced capabilities
- **SSH Integration**: Direct access to Claude Code CLI for file operations

### 3. Conversation Memory
- Each agent has its own memory buffer for context retention
- All conversations saved to data table for long-term history
- Orchestrator can query conversation history via tool

### 4. User Experience
- Custom-styled chat interface with brand colors
- Clear headers indicating which agent is responding
- Session awareness for appropriate context display

### 5. Cost Control
- Orchestrator asks permission before using paid resources
- Free models as default
- `free_only` flag available for strict cost control

### 6. Extensibility
- Easy to add new commands and routes
- Sub-workflow integration for complex operations
- SSH nodes allow system-level automation

---

## Credentials Referenced

| Credential Name | Type | Used By |
|-----------------|------|---------|
| BEAST LMStudio | OpenAI API | FREE Primary, Orchestrator |
| Bedroom LMStudio | OpenAI API | FREE Secondary |
| OpenAi API account | OpenAI API | PAID ChatGPT |
| Google Gemini(PaLM) Api account | Google PaLM | PAID Gemini, PAID Nano Banana |
| Anthropic account | Anthropic API | PAID Claude Opus 4.5 |
| OrangePi SSH Access | SSH Password | All SSH nodes |

---

## Files

- **JSON Export**: `/home/bill/projects/claudia-admin/public/workflows/analysis/claudia-code-2.json`
- **This Analysis**: `/home/bill/projects/claudia-admin/public/workflows/analysis/claudia-code-2.md`

---

*Analysis generated: 2026-01-08*
*Source: N8N Instance at 192.168.245.11:5678*
