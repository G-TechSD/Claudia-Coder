# LMStudio Agentic Dev Tools v2 - Workflow Analysis

**Workflow ID:** `PbSOq6RsFoCsLZUh`
**Name:** LMStudio Agentic Dev Tools v2
**Status:** Active
**Created:** 2025-12-22T04:30:27.941Z
**Updated:** 2026-01-01T23:43:15.314Z
**Source:** http://192.168.245.11:5678 (OrangePi n8n instance)

## Tags
- AI GENERATED
- NOT TESTED
- NOT REVIEWED
- OLD VERSION

---

## Overview

This is a comprehensive autonomous development workflow that integrates Linear project management with local LM Studio AI servers for code generation, testing, and deployment. The workflow implements a "local-first" cost optimization strategy, preferring free local AI models over paid cloud APIs.

**Total Nodes:** 90
**Total Connections:** 87

---

## Node Inventory by Category

### 1. Trigger Nodes (1)

| Node Name | Type | Purpose |
|-----------|------|---------|
| When chat message received | @n8n/n8n-nodes-langchain.chatTrigger | Entry point via chat interface |

### 2. LM Studio Integration - FREE Local Models (4)

| Node Name | Type | Model | Server | Purpose |
|-----------|------|-------|--------|---------|
| FREE BEAST LM Studio | lmChatOpenAi | deepseek-coder-v2-lite-instruct | BEAST LMStudio | Primary coding model (90% usage target) |
| FREE Beast LM Studio Deepseek Coder V2 Lite | lmChatOpenAi | deepseek-coder-v2-lite-instruct | BEAST LMStudio | Backup deepseek instance |
| FREE Bedroom LMStudio | lmChatOpenAi | qwen/qwen3-vl-8b | Bedroom LMStudio | Secondary fallback |
| FREE Secondary LM Studio qwen3-vl-8b | lmChatOpenAi | qwen/qwen3-vl-8b | Bedroom LMStudio | Backup secondary |

**LM Studio Credentials:**
- `BEAST LMStudio` (ID: HE8StVq6t0epqs8Q) - Primary local server
- `Bedroom LMStudio` (ID: FYFVsKzjVFK0h0V2) - Secondary local server

### 3. Paid Cloud AI Models (6)

| Node Name | Type | Model | Cost Estimate |
|-----------|------|-------|---------------|
| PAID ChatGPT 5.2 Latest | lmChatOpenAi | gpt-5.2-chat-latest | ~$0.03/1K tokens |
| PAID ChatGPT 5.1 Codex | lmChatOpenAi | gpt-5.1-codex | ~$0.03/1K tokens |
| PAID Gemini 3 Flash | lmChatGoogleGemini | models/gemini-3-flash-preview | ~$0.001/1K tokens |
| PAID Gemini 2.5 Flash | lmChatGoogleGemini | (default) | ~$0.001/1K tokens |
| PAID Claude Opus 4.5 | lmChatAnthropic | claude-opus-4-5-20251101 | ~$0.015/1K tokens |
| PAID Claude Sonnet 2.5 | lmChatAnthropic | claude-sonnet-4-5-20250929 | ~$0.015/1K tokens |
| PAID Nano Banana2 | lmChatGoogleGemini | models/nano-banana-pro-preview | Image generation |

### 4. AI Agent Nodes (13)

| Node Name | Type | Purpose |
|-----------|------|---------|
| Orchestrator AI Agent | agent | Main orchestration agent |
| AI Fix Agent | agent | Test failure remediation |
| Worker BEAST | agent | Primary local worker (deepseek-coder) |
| Worker Bedroom | agent | Secondary local worker (qwen3-vl) |
| Worker Google | agent | Vision/UI tasks (Gemini) |
| Worker Anthropic | agent | Complex reasoning (Claude) |
| Worker ChatGPT | agent | General tasks (GPT-4o) |
| FREE Primary LM Studio Server | agentTool | Tool wrapper for BEAST |
| FREE Secondary LM Studio | agentTool | Tool wrapper for Bedroom |
| PAID ChatGPT | agentTool | Tool wrapper for OpenAI |
| PAID Google | agentTool | Tool wrapper for Gemini |
| PAID Anthropic | agentTool | Tool wrapper for Claude |
| PAID Nano Banana | agentTool | Image generation tool |

### 5. Memory Nodes (7)

| Node Name | Type | Purpose |
|-----------|------|---------|
| Simple Memory | memoryBufferWindow | Context window (20 messages) |
| Simple Memory1-6 | memoryBufferWindow | Agent conversation history |

### 6. Linear Integration Nodes (6)

| Node Name | Operation | Purpose |
|-----------|-----------|---------|
| Escalate to Human | comment | Create escalation comment when AI cannot handle |
| Update Linear Success | comment | Post success notification with commit info |
| Escalate Max Attempts | comment | Post when max retry attempts reached |
| Parallel Linear Update | comment | Parallel processing mode updates |
| Post Screenshot Comment | comment | Attach GUI test screenshots |
| Seq Post Screenshots | comment | Sequential mode screenshot posting |

### 7. Git/SSH Operations (14)

| Node Name | Purpose |
|-----------|---------|
| Git Setup & Branch | Clone repo, create/switch to AI branch |
| Run Tests | Auto-detect project type and run tests |
| Git Commit & Push | Commit changes with AI signature |
| Apply Code Changes | Parse AI output and write files |
| Apply Fix Changes | Apply test fix changes |
| Setup Agent Storage | Create issue-specific storage directories |
| Parallel Git Setup | Fast branch creation for parallel mode |
| Parallel Apply Code | Parallel file writing |
| Parallel Run Tests | Parallel test execution |
| Parallel Commit | Parallel commit/push |
| Sync Repo to Desktop | rsync to Ubuntu desktop for GUI tests |
| Run Tests on Desktop | SSH to desktop for GUI app testing |
| Detect Repo Type | Determine if desktop testing needed |
| Fetch Screenshots | SCP screenshots from desktop |

### 8. Routing/Decision Nodes (8)

| Node Name | Type | Purpose |
|-----------|------|---------|
| Tests Passed? | if | Check test results for pass/fail |
| Max Attempts? | if | Check if retry limit (3) reached |
| Has Code to Apply? | if | Validate AI generated code |
| Choose Processing Mode | switch | Parallel vs Sequential routing |
| Split FREE Workers | switch | Route to free local models |
| Split SPENDY Workers | switch | Route to paid cloud models |
| Needs Desktop Test | if | Check for GUI project type |
| Route Input | switch | Initial input routing |

### 9. Data Processing Nodes (20+)

| Node Name | Type | Purpose |
|-----------|------|---------|
| Get Linear Projects | httpRequest | Fetch projects with "n8n" label |
| Format Projects | set | Format project list for display |
| Get Issues By Project | httpRequest | Fetch open issues for project |
| Format Issues | set | Format issue list |
| Loop Issues | splitInBatches | Iterate through issues |
| Setup Issue Context | set | Prepare issue processing context |
| Extract Selected Project | set | Parse project selection |
| Build Issues Query | set | Construct Linear GraphQL query |
| Preserve Context | set | Maintain context through workflow |
| Increment Attempts | set | Track retry count |
| Parse Parallel Output | set | Handle parallel processing results |

---

## LM Studio Integration Details

### Server Configuration

**Primary Server (BEAST):**
- Credential: `BEAST LMStudio`
- Model: `deepseek-coder-v2-lite-instruct`
- Usage: 90% of all requests (cost optimization)
- Capabilities: Code generation, debugging, implementation

**Secondary Server (Bedroom):**
- Credential: `Bedroom LMStudio`
- Model: `qwen/qwen3-vl-8b`
- Usage: Fallback when BEAST unavailable
- Capabilities: Vision/multimodal, code generation

### API Compatibility

LM Studio exposes an OpenAI-compatible API, allowing n8n's `lmChatOpenAi` node to communicate with local models. The workflow uses the OpenAI node type with custom credentials pointing to local LM Studio endpoints.

### Cost Optimization Strategy

```
Escalation Ladder:
1. FREE Primary (BEAST deepseek-coder) -> Try 3x
2. FREE Secondary (Bedroom qwen3-vl) -> Try 3x
3. PAID Google Gemini -> Try 1x (~$0.001/1K)
4. PAID OpenAI GPT -> Try 1x (~$0.03/1K)
5. PAID Anthropic Claude -> Try 1x (~$0.015/1K)
6. Escalate to Human
```

---

## Agentic Patterns Used

### 1. Tool-Based Agent Architecture
The Orchestrator AI Agent uses sub-agents as "tools" through the `agentTool` wrapper pattern:
- Each LLM is wrapped as a tool with a specific description
- The orchestrator selects which tool to use based on task requirements
- Tool descriptions guide selection (e.g., "FREE: use 90% of time", "PAID: only after FREE fails")

### 2. Retry with Escalation
```
Loop: Issue Processing
  |-> Attempt Implementation (FREE local)
  |-> Run Tests
  |-> If FAIL: Increment Counter
  |-> If attempts < 3: Retry with error context
  |-> If attempts >= 3: Escalate to PAID or Human
```

### 3. Context Preservation
Memory buffer windows (20 messages) maintain conversation context across:
- Issue analysis
- Implementation attempts
- Test failure debugging
- Fix iterations

### 4. Self-Triage Pattern
Issues are analyzed before implementation to determine:
- Complexity level (Simple/Medium/Complex)
- Whether AI can handle autonomously
- Which model tier is appropriate
- Potential blockers requiring human input

### 5. Parallel Processing Mode
For batch processing, issues can be processed in parallel:
- Parallel Git Setup
- Parallel Apply Code
- Parallel Run Tests
- Parallel Commit

### 6. GUI Testing Integration
For desktop applications (Flutter, Electron, Rust GUI, Qt, etc.):
- Detect project type requiring display
- Sync to Ubuntu desktop with display
- Run tests with screenshot capture
- Fetch and attach screenshots to Linear

---

## Project Type Detection

The workflow auto-detects and handles:

| File/Marker | Project Type | Test Command |
|-------------|--------------|--------------|
| pubspec.yaml | Flutter | flutter test |
| package.json + electron | Electron | npm test |
| Cargo.toml | Rust | cargo test |
| CMakeLists.txt | CMake/C++ | cmake && make && ctest |
| meson.build | Meson | meson test |
| pyproject.toml/setup.py | Python | pytest |
| package.json | Node.js | npm test |
| go.mod | Go | go test ./... |
| Gemfile | Ruby | bundle exec rspec |
| pom.xml | Maven/Java | mvn test |
| build.gradle | Gradle | ./gradlew test |
| mix.exs | Elixir | mix test |
| deno.json | Deno | deno test |
| bun.lockb | Bun | bun test |

---

## Code Application Pattern

AI-generated code follows a structured format:
```
---FILE: path/to/file.ext---
```language
code content
```

---AI_SIGNATURE---
platform: LMStudio-BEAST
model: deepseek-coder-v2-lite
timestamp: 2026-01-08T12:00:00Z
---END_SIGNATURE---
```

A Python parser extracts files and applies changes:
```python
file_pattern = r'---FILE:\s*([^-\n]+)---\s*```[a-z]*\n(.*?)```'
matches = re.findall(file_pattern, content, re.DOTALL)
for filepath, code in matches:
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w') as f:
        f.write(code.strip())
```

---

## Errors and Issues Identified

### Critical Issues

1. **Hardcoded Credentials in SSH Commands**
   - Password `'roboto'` is hardcoded in SSH/SCP commands
   - Should use SSH keys or n8n credentials

2. **NOT TESTED / NOT REVIEWED Tags**
   - Workflow is marked as not tested
   - Production use is risky without validation

3. **OLD VERSION Tag**
   - This appears to be superseded by newer versions
   - May contain outdated logic

### Moderate Issues

4. **Complex Node Graph**
   - 90 nodes makes debugging difficult
   - Consider breaking into sub-workflows

5. **Memory Management**
   - 7 separate memory buffers may cause inconsistency
   - Context could be lost between agent switches

6. **Error Handling Gaps**
   - Some SSH nodes use `onError: continueRegularOutput`
   - Silent failures may go unnoticed

### Minor Issues

7. **Duplicate Nodes**
   - Multiple similar nodes (e.g., "Simple Memory1" through "Simple Memory6")
   - Could be consolidated

8. **Inconsistent Naming**
   - Mix of "Seq" prefix and no prefix for sequential vs parallel nodes
   - "SPENDY" vs "PAID" naming

---

## Workflow Diagram (Simplified)

```
[Chat Trigger]
     |
     v
[Get Linear Projects] -> [Show Projects] -> [Select Project]
     |
     v
[Get Issues] -> [Format Issues] -> [Loop Issues]
     |
     v
[Setup Issue Context] -> [Git Setup & Branch]
     |
     v
[Orchestrator AI Agent] -----> [FREE BEAST/Bedroom]
     |                    |
     |                    +--> [PAID Google/ChatGPT/Claude]
     v
[Apply Code Changes] -> [Run Tests]
     |
     +---[PASS]---> [Git Commit] -> [Update Linear Success]
     |
     +---[FAIL]---> [Increment Attempts]
                         |
                         +--[< 3]---> [AI Fix Agent] -> [Run Tests]
                         |
                         +--[>= 3]--> [Escalate to Human]
```

---

## Rating and Relevance

### Overall Rating: 6.5/10

**Strengths:**
- Comprehensive local-first AI strategy
- Good cost optimization (FREE before PAID)
- Multi-project type support
- Linear integration for issue tracking
- Screenshot capture for GUI testing
- Retry logic with escalation

**Weaknesses:**
- Marked as NOT TESTED/NOT REVIEWED
- Hardcoded credentials (security risk)
- Complex graph (90 nodes) hard to maintain
- OLD VERSION tag suggests superseded
- No observability/logging integration
- Limited error recovery options

### Relevance to ClaudiaCode Project

**High Relevance:**
- Demonstrates LM Studio integration patterns
- Shows n8n agentic workflow architecture
- Useful reference for cost optimization strategies
- Linear integration patterns reusable

**Recommendations:**
1. Use newer active workflows if available
2. Extract LM Studio integration patterns for reuse
3. Do not deploy without security review (hardcoded passwords)
4. Consider modularizing into smaller sub-workflows
5. Add proper logging and monitoring

---

## Related Workflows

From the same n8n instance:
- `LMStudio Agentic Dev Tools` (PXawd0xn6XxHlNEs) - v1, Active
- `LMStudio Agentic Dev Tools - WORKING` (GIIBAxWXuajs5a60) - Working version
- `LMStudio Agentic Dev Tools - WIDESCREEN COMPLETE` (7F5rMVM0oDMKFQ69)
- `LMStudio Agentic Dev Tools - FRESH` (ca79e7b2-0761-4e)

---

## Export Information

- **JSON Export Path:** `/home/bill/projects/claudia-admin/public/workflows/analysis/lmstudio-agentic-dev-tools.json`
- **Analysis Path:** `/home/bill/projects/claudia-admin/public/workflows/analysis/lmstudio-agentic-dev-tools.md`
- **Exported:** 2026-01-08
- **Source Server:** 192.168.245.11:5678

---

*Analysis generated by Claude Code*
