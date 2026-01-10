# N8N Workflow Master Index

**Instance:** OrangePi N8N Server
**URL:** http://192.168.245.11:5678
**Total Workflows:** 48
**Active Workflows:** 15
**Export Date:** 2026-01-08

---

## Executive Summary

The OrangePi N8N instance hosts 48 workflows implementing a sophisticated multi-tier AI orchestration system. The system is designed around a "local-first" philosophy - routing tasks to FREE local LM Studio models by default and escalating to PAID cloud APIs (Claude, GPT, Gemini) only when necessary.

### Key Statistics
- **Production Ready:** 2 (Claudia Code 2, Packet Processor Standalone)
- **Active & Working:** 15 workflows
- **Needs Work:** 8 workflows
- **Archive Candidates:** 23 workflows
- **Core System:** 6 orchestrator workflows

---

## Complete Workflow Table

| ID | Name | Status | Category | Recommendation |
|----|------|--------|----------|----------------|
| `4p4rBF0F4Ku5aY8x` | Claudia Code 2 | **ACTIVE** | orchestrator | **KEEP - TESTED/WORKING** |
| `1iZ7FV2QPGaEpU88` | Packet Processor (Standalone) | inactive | processor | **KEEP - TESTED/WORKING** |
| `ud7XYHk6QWFvgDxf` | Claudia Code | **ACTIVE** | orchestrator | KEEP - Primary orchestrator v1 |
| `PbSOq6RsFoCsLZUh` | LMStudio Agentic Dev Tools v2 | **ACTIVE** | orchestrator | KEEP - Most advanced (90 nodes) |
| `9JoFVmCveQLWoCxw` | Autonomous Dev with Quality Loop | **ACTIVE** | orchestrator | KEEP - Quality loop pattern |
| `Eav7gyLzr7RuGaeT` | Packet Processor with Quality Check | **ACTIVE** | orchestrator | KEEP - Quality validation |
| `Np8FohK927IStXjG` | Packet Processor with Quality Loop | **ACTIVE** | processor | KEEP - Quality loop variant |
| `9VFsTvZJkJD3htXO` | Linear Issues to Data Table | **ACTIVE** | integration | KEEP - Core Linear sync |
| `J0Zf4eHFSQuqLv95` | Issue Packets Loader Sub | **ACTIVE** | sub-workflow | KEEP - Core sub-workflow |
| `yNkPX6701TffSJof` | Project Issues Loader - FIXED v2 | **ACTIVE** | loader | KEEP - Linear integration |
| `PXawd0xn6XxHlNEs` | LMStudio Agentic Dev Tools | **ACTIVE** | agentic | REVIEW - Duplicate? |
| `oOswOxrBRSNLRXrc` | LMStudio Agentic Dev Tools | **ACTIVE** | agentic | ARCHIVE - Duplicate |
| `3jGHJYTu4PhPw8X9` | Claudia Execute Webhook (Working) | **ACTIVE** | webhook | KEEP - Working webhook |
| `5nyJPfrirOtbczoS` | Claudia Simple Webhook Test | **ACTIVE** | webhook | REVIEW - Testing only |
| `AR1QJPBsX746UQgu` | Claudia Webhook (No Auth) - Testing | **ACTIVE** | webhook | REVIEW - Security concern |
| `bUUs2y75OZ0C3rJn` | Claudia Simple Webhook - Working | **ACTIVE** | webhook | KEEP - Working simple webhook |
| `V3jKwR9t38ncqYpP` | Autonomous Dev Agent - Multi-Stage Quality Pipeline | inactive | orchestrator | NEEDS WORK - Good pattern |
| `HoHkZgq9xzIC9Ing` | Claudia Webhook Trigger - Quality Loop Pipeline | inactive | orchestrator | NEEDS WORK - Not activated |
| `kvsadw8ZKBBeErQN` | Claudia Code - Beast Driven | inactive | orchestrator | NEEDS WORK - Variant |
| `H0FhKlC8OCs9EhWL` | Dev Agent (ENHANCED - Local-First) | inactive | agentic | NEEDS WORK - Enhanced version |
| `fEiO6OKIp1Dov2jL` | Dev Agent - FIXED v7 (Force Tool Calling) | inactive | agentic | NEEDS WORK - Tool calling |
| `qQljMT1sBztxYQVM` | Autonomous App Builder (Full Integration) | inactive | builder | NEEDS WORK - Full integration |
| `H0BJNDq3HGJjqD82` | Autonomous App Builder v2 | inactive | builder | NEEDS WORK - Builder pattern |
| `vsZH7emnHcUtApF8` | Unified ClaudiaCode Processor | inactive | processor | NEEDS WORK - Unification attempt |
| `XjHkwOQyasPylfBO` | RAG AI Agent Template V4 | inactive | template | REVIEW - Template value |
| `WPuxiZXV1cvR34Vk` | New Project Interview | inactive | utility | REVIEW - Utility value |
| `1XW5Q3fwUoM9RCSC` | Claudia Execute Webhook (Simple) | inactive | webhook | ARCHIVE - Superseded |
| `k8WuYzk6FPt55nk1` | Claudia Simple Webhook - Working | inactive | webhook | ARCHIVE - Duplicate |
| `yZQN8BoBDRDVjO7L` | Claudia Simple Webhook - Working | inactive | webhook | ARCHIVE - Duplicate |
| `X2Ox71QOgdDmWWus` | test-workflow-from-claude | inactive | test | ARCHIVE - Test only |
| `ca79e7b2-0761-4e` | LMStudio Agentic Dev Tools - FRESH | inactive | agentic | ARCHIVE - Empty/broken |
| `1xM2AKAUnV6bgSRr` | claudecode_test | inactive | test | ARCHIVE - Test only |
| `3ADvrOfL1E9KSeaw` | Linear Testing | inactive | test | ARCHIVE - Test only |
| `OXajDY41iL3e6l8o` | My workflow | inactive | test | ARCHIVE - Default empty |
| `57dhqmYizNAIFbkZ` | Claudia Code - Production | inactive | orchestrator | ARCHIVE - Old version |
| `7F5rMVM0oDMKFQ69` | LMStudio Agentic Dev Tools - WIDESCREEN COMPLETE | inactive | agentic | ARCHIVE - Old version |
| `GIIBAxWXuajs5a60` | LMStudio Agentic Dev Tools - WORKING | inactive | agentic | ARCHIVE - Old version |
| `84Q057mJFw0V43RT` | Autonomous App Builder v2 | inactive | builder | ARCHIVE - Duplicate ID |
| `7Wb6lgJ0BbU7tOL9` | Generate AI viral videos with NanoBanana & VEO3 | inactive | media | ARCHIVE - Unrelated |
| `aaCTXpS5nqGkK2P6` | Haiku | inactive | project | ARCHIVE - Empty placeholder |
| `5guwnQnd9v35XlQ4` | RoBox | inactive | project | ARCHIVE - Empty placeholder |
| `AyIrEjvnExd5GhI6` | GoldenEye | inactive | project | ARCHIVE - Empty placeholder |
| `Csv9Ss6YZjrSxwYa` | Ganesha | inactive | project | ARCHIVE - Empty placeholder |
| `bgo7RzbhSW09fryC` | LazLo | inactive | project | ARCHIVE - Empty placeholder |
| `csFqJ1qaXMUy51tv` | Project Unicorn | inactive | project | ARCHIVE - Empty placeholder |
| `p8llbwI2JuUVtze5` | Bambuzle | inactive | project | ARCHIVE - Empty placeholder |

---

## Workflows by Category

### Claudia Core Orchestrators (6 workflows)

The heart of the ClaudiaCode system - multi-tier routing and AI coordination.

| ID | Name | Status | Notes |
|----|------|--------|-------|
| `4p4rBF0F4Ku5aY8x` | **Claudia Code 2** | **ACTIVE** | Main orchestrator, 38 nodes, Issue Packets Loader integration |
| `ud7XYHk6QWFvgDxf` | Claudia Code | **ACTIVE** | Original v1, 50 nodes, full multi-model routing |
| `9JoFVmCveQLWoCxw` | Autonomous Dev with Quality Loop | **ACTIVE** | Quality validation, Context7 integration |
| `Eav7gyLzr7RuGaeT` | Packet Processor with Quality Check | **ACTIVE** | Editor review loops |
| `V3jKwR9t38ncqYpP` | Autonomous Dev Agent - Multi-Stage Quality Pipeline | inactive | Multi-phase validation |
| `HoHkZgq9xzIC9Ing` | Claudia Webhook Trigger - Quality Loop Pipeline | inactive | Webhook-triggered quality loop |

### Linear Integration (3 workflows)

Issue tracking and project management integration.

| ID | Name | Status | Notes |
|----|------|--------|-------|
| `9VFsTvZJkJD3htXO` | Linear Issues to Data Table | **ACTIVE** | Core sync workflow |
| `J0Zf4eHFSQuqLv95` | Issue Packets Loader Sub | **ACTIVE** | Sub-workflow for packet loading |
| `yNkPX6701TffSJof` | Project Issues Loader - FIXED v2 | **ACTIVE** | Chat-based issue loader |

### LMStudio Agentic Tools (6 workflows)

Local AI model orchestration via LM Studio.

| ID | Name | Status | Notes |
|----|------|--------|-------|
| `PbSOq6RsFoCsLZUh` | **LMStudio Agentic Dev Tools v2** | **ACTIVE** | Most advanced, 90 nodes, parallel workers |
| `PXawd0xn6XxHlNEs` | LMStudio Agentic Dev Tools | **ACTIVE** | Active version |
| `oOswOxrBRSNLRXrc` | LMStudio Agentic Dev Tools | **ACTIVE** | Duplicate - archive |
| `H0FhKlC8OCs9EhWL` | Dev Agent (ENHANCED - Local-First) | inactive | Enhanced local-first |
| `fEiO6OKIp1Dov2jL` | Dev Agent - FIXED v7 (Force Tool Calling) | inactive | Tool calling fix |
| `7F5rMVM0oDMKFQ69` | LMStudio Agentic Dev Tools - WIDESCREEN | inactive | Archive - old |

### Autonomous Builders (4 workflows)

Full application building pipelines.

| ID | Name | Status | Notes |
|----|------|--------|-------|
| `qQljMT1sBztxYQVM` | Autonomous App Builder (Full Integration) | inactive | Most complete builder |
| `H0BJNDq3HGJjqD82` | Autonomous App Builder v2 | inactive | Builder v2 |
| `84Q057mJFw0V43RT` | Autonomous App Builder v2 | inactive | Duplicate - archive |
| `vsZH7emnHcUtApF8` | Unified ClaudiaCode Processor | inactive | Unification attempt |

### Packet Processors (3 workflows)

Work queue processing with quality validation.

| ID | Name | Status | Notes |
|----|------|--------|-------|
| `1iZ7FV2QPGaEpU88` | **Packet Processor (Standalone)** | inactive | **TESTED/WORKING** - Dual LM Studio |
| `Np8FohK927IStXjG` | Packet Processor with Quality Loop | **ACTIVE** | Quality loop variant |
| `Eav7gyLzr7RuGaeT` | Packet Processor with Quality Check | **ACTIVE** | Quality check variant |

### Webhook Endpoints (7 workflows)

HTTP trigger endpoints for external integration.

| ID | Name | Status | Notes |
|----|------|--------|-------|
| `3jGHJYTu4PhPw8X9` | Claudia Execute Webhook (Working) | **ACTIVE** | Primary webhook |
| `bUUs2y75OZ0C3rJn` | Claudia Simple Webhook - Working | **ACTIVE** | Simple working version |
| `AR1QJPBsX746UQgu` | Claudia Webhook (No Auth) - Testing | **ACTIVE** | No auth - security review |
| `5nyJPfrirOtbczoS` | Claudia Simple Webhook Test | **ACTIVE** | Testing version |
| `1XW5Q3fwUoM9RCSC` | Claudia Execute Webhook (Simple) | inactive | Superseded |
| `k8WuYzk6FPt55nk1` | Claudia Simple Webhook - Working | inactive | Duplicate |
| `yZQN8BoBDRDVjO7L` | Claudia Simple Webhook - Working | inactive | Duplicate |

### Project Placeholders (7 workflows)

Empty project-specific workflows - all archive candidates.

| ID | Name | Status |
|----|------|--------|
| `5guwnQnd9v35XlQ4` | RoBox | inactive |
| `AyIrEjvnExd5GhI6` | GoldenEye | inactive |
| `Csv9Ss6YZjrSxwYa` | Ganesha | inactive |
| `bgo7RzbhSW09fryC` | LazLo | inactive |
| `csFqJ1qaXMUy51tv` | Project Unicorn | inactive |
| `p8llbwI2JuUVtze5` | Bambuzle | inactive |
| `aaCTXpS5nqGkK2P6` | Haiku | inactive |

### Test & Development (4 workflows)

Testing and development workflows - archive candidates.

| ID | Name | Status |
|----|------|--------|
| `1xM2AKAUnV6bgSRr` | claudecode_test | inactive |
| `3ADvrOfL1E9KSeaw` | Linear Testing | inactive |
| `OXajDY41iL3e6l8o` | My workflow | inactive |
| `X2Ox71QOgdDmWWus` | test-workflow-from-claude | inactive |

### Other (5 workflows)

Miscellaneous and specialized workflows.

| ID | Name | Status | Category |
|----|------|--------|----------|
| `XjHkwOQyasPylfBO` | RAG AI Agent Template V4 | inactive | template |
| `WPuxiZXV1cvR34Vk` | New Project Interview | inactive | utility |
| `7Wb6lgJ0BbU7tOL9` | Generate AI viral videos with NanoBanana | inactive | media |
| `kvsadw8ZKBBeErQN` | Claudia Code - Beast Driven | inactive | orchestrator |

---

## Tested & Working Workflows

These workflows have been verified as production-ready:

### 1. Claudia Code 2 (`4p4rBF0F4Ku5aY8x`)

**Status:** ACTIVE - PRODUCTION READY

**Features:**
- 38-node orchestrator with multi-model routing
- Issue Packets Loader integration
- FREE tier: BEAST LMStudio (GPT-OSS-20b), Bedroom LMStudio (Qwen3-VL-8b)
- PAID tier: Claude Opus 4.5, GPT 5.1, Gemini 3 Flash
- Data table persistence for conversation memory
- Sub-agent delegation with `<!@<!@<!ENGAGE AI SUB AGENT!>@!>@!>` tag

**Commands:**
```
/projects        - Select Linear project
/primary_free:   - Route to BEAST (GPT-OSS-20b)
/secondary_free: - Route to Bedroom (Qwen3-VL-8b)
/paid_claude:    - Route to Claude Opus 4.5
/paid_chatgpt:   - Route to GPT 5.1
/paid_gemini:    - Route to Gemini 3 Flash
```

### 2. Packet Processor (Standalone) (`1iZ7FV2QPGaEpU88`)

**Status:** INACTIVE but TESTED/WORKING

**Features:**
- Standalone packet processing with dual LM Studio support
- BEAST + Bedroom worker routing
- Quality validation loop
- Data table integration
- No external dependencies

---

## Workflows Needing Work

These workflows have potential but require attention:

| Workflow | Issue | Effort |
|----------|-------|--------|
| Dev Agent (ENHANCED - Local-First) | Not activated, needs testing | Medium |
| Dev Agent - FIXED v7 | Tool calling needs verification | Medium |
| Autonomous App Builder (Full Integration) | Complex, incomplete | High |
| Autonomous App Builder v2 | Needs consolidation | Medium |
| Unified ClaudiaCode Processor | Unfinished unification | High |
| Multi-Stage Quality Pipeline | Good pattern, not activated | Low |
| Claudia Webhook Trigger - Quality Loop | Not activated | Low |
| Claudia Code - Beast Driven | Variant needs evaluation | Low |

---

## Recommended Actions

### KEEP (17 workflows)

Essential workflows that should remain:

1. **Core Orchestrators:**
   - Claudia Code 2 (primary)
   - Claudia Code (v1 backup)
   - Autonomous Dev with Quality Loop
   - Packet Processor with Quality Check
   - LMStudio Agentic Dev Tools v2

2. **Linear Integration:**
   - Linear Issues to Data Table
   - Issue Packets Loader Sub
   - Project Issues Loader - FIXED v2

3. **Processors:**
   - Packet Processor (Standalone)
   - Packet Processor with Quality Loop

4. **Webhooks:**
   - Claudia Execute Webhook (Working)
   - Claudia Simple Webhook - Working

### REVIEW (8 workflows)

Evaluate for consolidation or archival:

1. Multi-Stage Quality Pipeline - Good pattern, activate or archive
2. Claudia Webhook Trigger - Quality Loop Pipeline - Activate or archive
3. LMStudio Agentic Dev Tools (duplicate) - Consolidate
4. RAG AI Agent Template V4 - Evaluate template value
5. New Project Interview - Evaluate utility value
6. Claudia Webhook (No Auth) - Security review
7. Claudia Simple Webhook Test - Testing only
8. Claudia Code - Beast Driven - Evaluate variant

### ARCHIVE (23 workflows)

Remove from active instance:

1. **Duplicates:** 6 workflows (webhook duplicates, LMStudio duplicates)
2. **Empty Placeholders:** 8 project workflows
3. **Test Workflows:** 4 development/test workflows
4. **Superseded:** 5 old versions (Production, WIDESCREEN, WORKING, etc.)

---

## Model Infrastructure

### FREE Tier (Local LM Studio)

| Server | Model | IP Address | Use Case |
|--------|-------|------------|----------|
| BEAST | GPT-OSS-20b | 192.168.245.155:1234 | Primary coding, fast iteration |
| Bedroom | Qwen3-VL-8b | 192.168.27.182:1234 | Vision tasks, documentation |

### PAID Tier (Cloud APIs)

| Provider | Model | Use Case |
|----------|-------|----------|
| Anthropic | Claude Opus 4.5 | Deep reasoning, code review, validation |
| OpenAI | GPT 5.1 Codex | Complex coding tasks |
| Google | Gemini 3 Flash | Multimodal, UI analysis |
| Google | NanoBanana | Image generation |

---

## Architectural Patterns

### 1. Multi-Tier Routing Pattern

Used by: Claudia Code, Claudia Code 2, LMStudio Agentic Dev Tools v2

```
Chat Input --> Orchestrator AI Agent --> Parse Command
                                              |
                     +------------------------+------------------------+
                     |            |           |           |            |
                 /primary    /secondary   /paid_claude  /paid_gpt   /paid_gemini
                     |            |           |           |            |
                  BEAST      Bedroom      Claude      ChatGPT      Gemini
                (FREE)       (FREE)       (PAID)      (PAID)       (PAID)
                     |            |           |           |            |
                     +------------+-----------+-----------+------------+
                                              |
                                    Save Output to Data Table
                                              |
                                    Respond to Chat
```

### 2. Quality Loop Pattern (Ralph Wiggum Loop)

Used by: Autonomous Dev with Quality Loop, Packet Processors

```
Work Item --> Implementation (Local Model)
                      |
                      v
              Quality Validation (Claude/Validator)
                      |
            +---------+---------+
            |         |         |
         ACCEPT    ITERATE   REJECT
            |         |         |
        Complete   Retry?    Escalate
                      |
                  [retries < max?]
                      |
              Build Iteration Prompt
                      |
              Loop Back to Implementation
```

### 3. Sub-Workflow Composition

Used by: Issue Packets Loader Sub, called by Claudia Code 2

```
Main Workflow --> Execute Workflow Node --> Sub-Workflow
                                                  |
                                           (independent execution)
                                                  |
                                           Return Results
```

---

## Data Tables

| Table Name | Purpose | Used By |
|------------|---------|---------|
| ClaudiaCodeIssuePackets | Work packet queue | Multiple orchestrators |
| ClaudiaCodeConversations | Conversation history, working memory | Claudia Code variants |
| ClaudiaCodeProjectPlans | Strategic plans | Dev agents |
| ClaudiaCodeProjectLog | Work history | Dev agents |

---

## Webhook Endpoints

| Workflow | Path | Authentication |
|----------|------|----------------|
| Claudia Execute Webhook (Working) | `/webhook/claudia-execute` | N8N Header Auth |
| Claudia Simple Webhook - Working | `/webhook/claudia-simple` | None |
| Claudia Webhook (No Auth) | `/webhook/claudia-test` | None |

---

## File Locations

```
Server: http://192.168.245.11:5678
API: /api/v1/workflows

Local Exports:
/home/bill/projects/claudia-admin/public/workflows/
    claudia-execute.json              # Quality loop pipeline template
    claudia-orchestrator.json         # Orchestrator template
    universal-issue-import.json       # Multi-source issue import
    WORKFLOW-CATALOG.md              # Catalog documentation
    orangepi/                        # Full workflow exports
        *.json                       # 48 workflow exports
        WORKFLOW_INDEX.json          # Structured index
        ORCHESTRATOR_DOCUMENTATION.md # Detailed docs
    analysis/
        MASTER-INDEX.md              # This file
```

---

## Ecosystem Summary

The N8N workflow ecosystem on the OrangePi instance represents a sophisticated attempt at building an autonomous AI development system. Key observations:

### Strengths

1. **Cost Optimization:** Strong "local-first" philosophy routing to FREE models before PAID
2. **Quality Assurance:** Multiple quality loop implementations with validation and iteration
3. **Integration:** Deep Linear integration for issue tracking
4. **Modularity:** Sub-workflow architecture enables composition
5. **Multi-Model Support:** Flexible routing to 6+ different AI models

### Weaknesses

1. **Duplication:** Many duplicate/variant workflows need consolidation
2. **Documentation:** Workflows lack inline documentation
3. **Testing:** Only 2 workflows verified as production-ready
4. **Cleanup Needed:** 23 workflows are archive candidates (48% of total)

### Recommendations

1. **Consolidate** duplicates into single canonical versions
2. **Archive** empty placeholders and test workflows
3. **Activate** quality loop patterns (Multi-Stage Pipeline)
4. **Document** working workflows with inline comments
5. **Test** remaining active workflows systematically

### Evolution Path

```
Current State                    Target State
--------------                   ------------
48 workflows                     ~20 workflows
15 active                        15-18 active
2 tested                         10+ tested
23 archive candidates            0 (archived)
```

---

## Detailed Analysis Files

The following workflows have detailed analysis documents:

### Core Orchestrators

| Workflow | Analysis File | Rating |
|----------|---------------|--------|
| Claudia Code 2 | [claudia-code-2.md](claudia-code-2.md) | HIGH - Reference Implementation |
| Claudia Code (Original) | [claudia-code-original.md](claudia-code-original.md) | HIGH - Production v1 |
| Claudia Orchestrator | [claudia-orchestrator.md](claudia-orchestrator.md) | LOW - Needs Rework |

### Linear Integration

| Workflow | Analysis File | Rating |
|----------|---------------|--------|
| Linear Issues to Data Table | [linear-issues-data-table.md](linear-issues-data-table.md) | 7.5/10 |
| Issue Packets Loader Sub | [issue-packets-loader.md](issue-packets-loader.md) | 8.5/10 |
| Project Issues Loader v2 | [project-issues-loader-v2.md](project-issues-loader-v2.md) | 8/10 |

### Packet Processors

| Workflow | Analysis File | Rating |
|----------|---------------|--------|
| Packet Processor Standalone | [packet-processor-standalone.md](packet-processor-standalone.md) | MEDIUM |
| Autonomous Dev Quality Loop | [autonomous-dev-quality-loop.md](autonomous-dev-quality-loop.md) | MEDIUM |
| Unified ClaudiaCode Processor | [unified-claudiacode-processor.md](unified-claudiacode-processor.md) | 5/10 - Needs Work |

### Webhooks

| Workflow | Analysis File | Rating |
|----------|---------------|--------|
| Claudia Execute Webhooks | [claudia-execute-webhooks.md](claudia-execute-webhooks.md) | MEDIUM |
| Claudia Simple Webhook Test | [claudia-simple-webhook-test.md](claudia-simple-webhook-test.md) | LOW - Test Only |
| Claudia Simple Webhook Working | [claudia-simple-webhook-working.md](claudia-simple-webhook-working.md) | LOW - Test Only |

### Agentic Tools

| Workflow | Analysis File | Rating |
|----------|---------------|--------|
| LMStudio Agentic Dev Tools | [lmstudio-agentic-dev-tools.md](lmstudio-agentic-dev-tools.md) | MEDIUM |

---

*Generated: 2026-01-08*
*Updated: 2026-01-09 - Added new analysis files*
*Source: OrangePi N8N API + Local Exports*
