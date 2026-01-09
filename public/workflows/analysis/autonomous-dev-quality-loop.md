# Autonomous Dev with Quality Loop - Workflow Analysis

**Workflow ID:** `9JoFVmCveQLWoCxw`
**Status:** Active
**Created:** 2026-01-02T00:53:28.238Z
**Last Updated:** 2026-01-02T01:20:37.532Z
**Author:** Bill Griffith
**Tags:** AI GENERATED, SANDBOX

---

## Executive Summary

This workflow implements a sophisticated autonomous development pipeline with an iterative quality control loop (often called the "Ralph Wiggum Pattern" - where the system keeps trying until it gets it right or exhausts retries). It processes development packets from a queue, generates code using local LLM models, validates the output with a separate validator model, and iteratively improves the code until it passes quality thresholds or hits maximum iterations.

---

## Architecture Overview

```
Webhook Trigger
      |
      v
Get Next Queued Packet (from DataTable)
      |
      v
Analyze Complexity (keyword-based scoring)
      |
      v
Route by Complexity (3 paths)
      |
      +---> [Needs Planning] --> Check Escalation --> Auto-Approved? --> Request Approval OR Continue
      |
      +---> [Needs Tools] --> Prepare Context7 --> Context7 Decision --> Enhanced Prompt
      |
      +---> [Simple] --> Build Simple Prompt
      |
      v
Merge Execution Paths
      |
      v
Execute Local Model (LMStudio HTTP)
      |
      v
Format Output
      |
      v
Quality Validator (Qwen3-VL-8b) <----+
      |                               |
      v                               |
Parse Quality Report                  |
      |                               |
      v                               |
Decision Router                       |
      |                               |
      +---> ACCEPT --> Save --> Update Status (completed)
      |                               |
      +---> ITERATE --> Build Fix Prompt --> Check Max Iterations --> Loop Back
      |                               |
      +---> REJECT --> Build Retry Prompt --> Check Max Iterations --> Loop Back
                                      |
                        Max Reached --> Mark Failed --> Update Status (failed)
```

---

## Node-by-Node Analysis

### 1. Webhook Trigger
| Property | Value |
|----------|-------|
| **ID** | `manual-trigger-1` |
| **Type** | `n8n-nodes-base.webhook` |
| **Version** | 2 |
| **Purpose** | Entry point for workflow execution |
| **Path** | `quality-loop-test` |
| **Method** | POST |
| **Response Mode** | lastNode |

**Purpose:** Initiates the workflow via HTTP POST request. Can be triggered externally or by scheduled processes.

---

### 2. Get Next Queued Packet
| Property | Value |
|----------|-------|
| **ID** | `get-next-packet` |
| **Type** | `n8n-nodes-base.dataTable` |
| **Version** | 1 |
| **Purpose** | Retrieves the next work item from the queue |
| **Data Table** | ClaudiaCodeIssuePackets |
| **Filter** | `status = "queued"` |
| **Limit** | 1 |

**Purpose:** Fetches a single queued packet from the n8n DataTable for processing. Uses FIFO ordering.

---

### 3. Analyze Complexity
| Property | Value |
|----------|-------|
| **ID** | `analyze-complexity` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Scores task complexity and selects model |

**Algorithm:**
- **Complex Keywords** (+points): distributed (15), microservice (15), security (15), authentication (12), machine learning (15), real-time (12), etc.
- **Simple Keywords** (-points): simple (-8), basic (-8), utility (-5), format (-5), etc.
- **Description length factor:** Up to +20 points
- **Issue count factor:** +5 per issue (max +20)
- **Library detection:** FastAPI, React, Django, Docker, etc.

**Model Selection:**
- Complexity < 20, Probability > 85%: `ministral-3-3b`
- Complexity < 40, Probability > 70%: `gpt-oss-20b`
- Complexity < 70: `gpt-oss-20b+context7`
- Complexity >= 70: `needs-planning` (escalate)

**Output Fields:**
```javascript
{
  complexity: {
    score: 0-100,
    probability: 0-100,
    recommendedModel: string,
    detectedLibraries: string[],
    requiresPlanning: boolean,
    requiresContext7: boolean,
    estimatedTokens: number
  },
  iteration: 0,
  maxIterations: 3,
  qualityHistory: []
}
```

---

### 4. Route by Complexity
| Property | Value |
|----------|-------|
| **ID** | `route-by-complexity` |
| **Type** | `n8n-nodes-base.switch` |
| **Version** | 3 |
| **Purpose** | Routes to appropriate processing path |

**Outputs:**
1. **Needs Planning** - `requiresPlanning === true` (complexity >= 70)
2. **Needs Tools** - `requiresContext7 === true` (libraries detected or complexity >= 30)
3. **Simple** (fallback) - Basic tasks

---

### 5. Check Escalation Settings
| Property | Value |
|----------|-------|
| **ID** | `check-escalation` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Determines if user approval is needed |

**Hardcoded Settings (TODO: Move to DataTable):**
```javascript
const userSettings = {
  auto_approve_planning: false,
  max_planning_budget: 5.00,
  max_execution_budget: 10.00,
  auto_approve_under: 2.00
};
```

**Cost Estimation:**
- Planning cost: $0.50 (Claude API)
- Execution cost: $3.00 if complexity > 70, else $0.00

---

### 6. Auto-Approved?
| Property | Value |
|----------|-------|
| **ID** | `auto-approved` |
| **Type** | `n8n-nodes-base.if` |
| **Version** | 2 |
| **Purpose** | Gates expensive operations |

**Logic:** `needsApproval === false` -> Continue | True -> Request Approval

---

### 7. Request Approval
| Property | Value |
|----------|-------|
| **ID** | `request-approval` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Pauses for user approval |

**Output Message Format:**
```
Task requires planning. Estimated cost: $X.XX.
Reply '/approve {packetID}' to proceed or '/skip {packetID}' to skip.
```

**Note:** This is a dead-end in the current workflow - no mechanism to resume after approval.

---

### 8. Build Simple Prompt
| Property | Value |
|----------|-------|
| **ID** | `build-simple-prompt` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Creates prompt for simple tasks |

**Model Assignment:** `ministral-3-3b`

**Prompt Structure:**
- Expert developer persona
- Task title and description
- Requirements (no placeholders, complete code, error handling)
- Issues to address
- Acceptance criteria
- Expected output format

---

### 9. Prepare Context7 Queries
| Property | Value |
|----------|-------|
| **ID** | `prepare-context7` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Prepares library documentation queries |

**Current Status:** DISABLED - Context7 MCP integration not available in n8n.

```javascript
// Context7 disabled for now - MCP nodes not available in n8n
return {
  json: {
    ...item,
    context7Docs: null,
    skipContext7: true
  }
};
```

---

### 10. Needs Context7?
| Property | Value |
|----------|-------|
| **ID** | `needs-context7` |
| **Type** | `n8n-nodes-base.if` |
| **Version** | 2 |
| **Purpose** | Routes based on Context7 availability |

**Logic:** `skipContext7 === false` (currently always false, so always bypassed)

---

### 11. Split Context7 Queries
| Property | Value |
|----------|-------|
| **ID** | `split-queries` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Parallelizes documentation queries |

**Note:** Currently unused due to Context7 being disabled.

---

### 12. Aggregate Context7 Results
| Property | Value |
|----------|-------|
| **ID** | `aggregate-context7` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Combines documentation from multiple sources |

**Note:** Currently unused.

---

### 13. Build Enhanced Prompt
| Property | Value |
|----------|-------|
| **ID** | `build-enhanced-prompt` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Creates documentation-enhanced prompt |

**Model Assignment:** `gpt-oss-20b`

**Additional Sections:**
- Official documentation section (when available)
- Framework/library best practices
- Dependencies with versions

---

### 14. Merge Execution Paths
| Property | Value |
|----------|-------|
| **ID** | `merge-paths` |
| **Type** | `n8n-nodes-base.merge` |
| **Version** | 3 |
| **Purpose** | Combines all prompt-building paths |

**Inputs:**
1. From Aggregate Context7
2. From Build Enhanced Prompt
3. From Build Simple Prompt

---

### 15. Execute Local Model
| Property | Value |
|----------|-------|
| **ID** | `execute-local-model` |
| **Type** | `n8n-nodes-base.httpRequest` |
| **Version** | 4.2 |
| **Purpose** | Calls LMStudio for code generation |
| **URL** | `http://localhost:1234/v1/chat/completions` |
| **Timeout** | 180000ms (3 minutes) |

**Request Body:**
```javascript
{
  model: "$json.modelToUse || 'gpt-oss-20b'",
  messages: [{ role: 'user', content: $json.prompt }],
  temperature: iteration > 0 ? 0.1 : 0.2,  // Lower temp on retries
  max_tokens: $json.complexity.estimatedTokens || 4000
}
```

---

### 16. Format Output
| Property | Value |
|----------|-------|
| **ID** | `format-output` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Structures output for validation |

**Output Format:**
```markdown
# {title}

**Packet ID:** {packetID}
**Iteration:** {iteration}
**Model:** {modelToUse}
**Timestamp:** {ISO timestamp}

---

{generated code}

---

## Metadata
- Complexity: {score}/100
- Success Probability: {probability}%
- Libraries: {list}
```

---

### 17. Qwen3-VL-8b Validator
| Property | Value |
|----------|-------|
| **ID** | `validator-model` |
| **Type** | `@n8n/n8n-nodes-langchain.lmChatOpenAi` |
| **Version** | 1.3 |
| **Purpose** | Quality validation of generated code |
| **Model** | `qwen/qwen3-vl-8b` |
| **Credentials** | Bedroom LMStudio |
| **Timeout** | 120000ms (2 minutes) |

**This is the "Ralph Wiggum" validator** - a separate smaller model that judges the output of the main generator.

---

### 18. Parse Quality Report
| Property | Value |
|----------|-------|
| **ID** | `parse-quality-report` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Extracts structured quality metrics |

**Expected JSON Structure:**
```javascript
{
  overall_score: 0-100,
  completeness: 0-100,
  correctness: 0-100,
  code_quality: 0-100,
  security: 0-100,
  decision: "ACCEPT" | "ITERATE" | "REJECT",
  reasoning: string,
  issues: [{
    type: string,
    severity: "critical" | "high" | "medium" | "low",
    description: string,
    location: string
  }],
  fix_suggestions: string[],
  retry_guidance: string
}
```

**Fallback on Parse Error:**
```javascript
{
  overall_score: 50,
  decision: 'REJECT',
  reasoning: 'Validator failed to produce valid JSON',
  issues: [{ type: 'validation_error', severity: 'critical', description: 'Could not parse validation output' }]
}
```

---

### 19. Decision Router
| Property | Value |
|----------|-------|
| **ID** | `decision-router` |
| **Type** | `n8n-nodes-base.switch` |
| **Version** | 3 |
| **Purpose** | Routes based on validation decision |

**Outputs:**
1. **ACCEPT** - Code passes quality threshold
2. **ITERATE** - Code needs minor fixes (salvageable)
3. **REJECT** - Code has fundamental issues (restart)

---

### 20. Save Accepted Output
| Property | Value |
|----------|-------|
| **ID** | `save-accepted` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Persists successful output to filesystem |

**Output Path:** `/mnt/n8n-nas/packet_outputs/{packetID}-ACCEPTED-{timestamp}.md`

**File Content:**
- Implementation code
- Quality metrics (all 5 dimensions)
- Quality history (all iterations)
- Issues found

---

### 21. Update Packet Status (Completed)
| Property | Value |
|----------|-------|
| **ID** | `update-completed` |
| **Type** | `n8n-nodes-base.dataTable` |
| **Version** | 1 |
| **Purpose** | Marks packet as successfully processed |

**Updates:**
- `status`: "completed"
- `completedAt`: timestamp
- `finalScore`: quality score
- `iterations`: count
- `outputFile`: filename

---

### 22. Build Fix Prompt (ITERATE Path)
| Property | Value |
|----------|-------|
| **ID** | `build-fix-prompt` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Creates targeted fix prompt |

**Approach:** Incremental fix - provides original code with specific issues to address. Does NOT rewrite from scratch.

**Prompt Structure:**
- Issues to fix (with severity, type, location)
- Fix suggestions from validator
- Original code
- Instruction to fix ONLY listed issues

---

### 23. Build Retry Prompt (REJECT Path)
| Property | Value |
|----------|-------|
| **ID** | `build-retry-prompt` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Creates fresh attempt prompt |

**Approach:** Full restart with lessons learned from failure.

**Additional Context:**
- Why previous attempt failed
- Critical issues to avoid
- Stricter requirements emphasized
- Attempt number included

---

### 24. Max Iterations Reached?
| Property | Value |
|----------|-------|
| **ID** | `check-max-iterations` |
| **Type** | `n8n-nodes-base.if` |
| **Version** | 2 |
| **Purpose** | Prevents infinite loops |

**Logic:** `iteration >= maxIterations` (default: 3)

---

### 25. Mark as Failed
| Property | Value |
|----------|-------|
| **ID** | `mark-failed` |
| **Type** | `n8n-nodes-base.code` |
| **Version** | 2 |
| **Purpose** | Records failure details |

**Failure Message Format:**
```
Failed after {iteration} iterations. Final score: {score}/100. Last decision: {decision}.
```

---

### 26. Update Packet Status (Failed)
| Property | Value |
|----------|-------|
| **ID** | `update-failed` |
| **Type** | `n8n-nodes-base.dataTable` |
| **Version** | 1 |
| **Purpose** | Marks packet as failed |

**Updates:**
- `status`: "failed"
- `failureReason`: detailed reason
- `failedAt`: timestamp
- `finalScore`: last quality score
- `iterations`: count

---

## The Quality Loop (Ralph Wiggum Pattern)

### What Is It?
The "Ralph Wiggum Pattern" is a self-correcting loop where:
1. A **Generator Model** (GPT-OSS-20b) produces code
2. A **Validator Model** (Qwen3-VL-8b) reviews the code and provides structured feedback
3. Based on the decision:
   - **ACCEPT**: Work is complete
   - **ITERATE**: Feed issues back to generator for targeted fixes
   - **REJECT**: Restart with full context of what went wrong

### Why Two Models?
- **Generator** is optimized for code production (larger, more capable)
- **Validator** is optimized for judgment/analysis (smaller, faster, cheaper)
- Separation prevents the generator from being "overconfident" about its own output
- Different model architectures catch different types of errors

### Iteration Behavior
| Iteration | Temperature | Approach |
|-----------|-------------|----------|
| 0 (initial) | 0.2 | Standard creativity |
| 1+ (retry) | 0.1 | More deterministic, follow instructions closely |

### Quality Dimensions Tracked
1. **Overall Score** (0-100)
2. **Completeness** - Are all requirements addressed?
3. **Correctness** - Does the code work?
4. **Code Quality** - Style, patterns, maintainability
5. **Security** - Vulnerabilities, best practices

---

## Connection Flow Diagram

```
Webhook Trigger
      |
      v
Get Next Queued Packet --> Analyze Complexity --> Route by Complexity
                                                        |
                           +----------------------------+----------------------------+
                           |                            |                            |
                           v                            v                            v
                  Check Escalation           Prepare Context7              Build Simple Prompt
                           |                            |                            |
                           v                            v                            |
                    Auto-Approved?            Needs Context7?                        |
                     |         |               |          |                          |
                     v         v               v          v                          |
              Context7 Path   Request    Split Queries  Enhanced                     |
                     |        Approval        |         Prompt                       |
                     |         (end)          v           |                          |
                     |                   Aggregate        |                          |
                     |                        |           |                          |
                     +------------------------+-----------+--------------------------+
                                              |
                                              v
                                    Merge Execution Paths
                                              |
                                              v
                                    Execute Local Model
                                              |
                                              v
                                       Format Output
                                              |
                                              v
                                   [Validator - Qwen3]
                                              |
                                              v
                                   Parse Quality Report
                                              |
                                              v
                                     Decision Router
                           +------------------+------------------+
                           |                  |                  |
                           v                  v                  v
                    Save Accepted      Build Fix Prompt    Build Retry Prompt
                           |                  |                  |
                           v                  +------------------+
                    Update Completed                |
                           |                        v
                         (end)           Max Iterations Reached?
                                          |                |
                                          v                v
                                    [Loop Back]      Mark Failed
                                          |                |
                                          |                v
                                          |         Update Failed
                                          |                |
                                          v              (end)
                                   Execute Local Model (repeat)
```

---

## Identified Issues

### Critical Issues

1. **Missing Loop Connection**
   - The "Build Fix Prompt" and "Build Retry Prompt" nodes increment iteration and set a new prompt, but there's no visible connection back to "Execute Local Model"
   - **Impact:** The quality loop may not actually loop
   - **Fix:** Add connections from Max Iterations check (false branch) back to Execute Local Model

2. **Missing Validator Prompt**
   - The Qwen3-VL-8b Validator node doesn't have a visible prompt defining what to validate
   - The node appears to be an LLM Chat node but lacks the validation prompt
   - **Impact:** Validator may not know what to check
   - **Fix:** Add a "Build Validator Prompt" node before the validator

3. **Dead End - Request Approval**
   - When approval is needed, the workflow stops at "Request Approval" with no mechanism to resume
   - **Impact:** High-complexity tasks requiring approval are never processed
   - **Fix:** Implement an approval webhook or polling mechanism

### Medium Issues

4. **Context7 Integration Disabled**
   - The entire Context7 path is disabled with `skipContext7: true`
   - **Impact:** No documentation augmentation, reducing code quality for library-heavy tasks
   - **Fix:** Implement MCP integration or use HTTP-based documentation fetching

5. **Hardcoded User Settings**
   - Budget thresholds and approval settings are hardcoded in "Check Escalation Settings"
   - **Impact:** No per-user customization
   - **Fix:** Move to ClaudiaCodeSettings DataTable

6. **Localhost LMStudio URL**
   - `http://localhost:1234` assumes n8n runs on same machine as LMStudio
   - **Impact:** Won't work in distributed setup
   - **Fix:** Use environment variable or configuration

### Minor Issues

7. **No Error Handling on HTTP Request**
   - Execute Local Model has no error handling for LMStudio failures
   - **Impact:** Workflow fails completely on model timeout/error
   - **Fix:** Add error handling node

8. **Validator JSON Parsing Fragile**
   - Uses regex to extract JSON from validator output
   - **Impact:** May fail on edge cases
   - **Fix:** Use proper JSON mode or structured output

---

## Rating and Relevance

### Overall Rating: 7.5/10

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Architecture** | 8/10 | Well-structured with clear separation of concerns |
| **Completeness** | 6/10 | Missing loop connections and approval mechanism |
| **Error Handling** | 5/10 | Minimal error handling throughout |
| **Maintainability** | 8/10 | Clear node naming, good code comments |
| **Scalability** | 7/10 | Single-threaded, one packet at a time |
| **Innovation** | 9/10 | Dual-model validation is sophisticated |

### Relevance to Claudia Code Project

**HIGH RELEVANCE** - This workflow represents a core component of the Claudia Code autonomous development system:

1. **Packet Processing Pipeline** - Directly implements the packet-based work distribution model
2. **Quality Assurance** - Automated code review before delivery
3. **Cost Control** - Budget-aware escalation for expensive operations
4. **Iterative Improvement** - Self-correcting output quality
5. **Local-First** - Uses local LMStudio models to minimize API costs

### Recommended Improvements

1. **Complete the Loop** - Add missing connections for ITERATE/REJECT paths
2. **Add Validator Prompt Node** - Define clear validation criteria
3. **Implement Approval Flow** - Either blocking webhook or async queue
4. **Enable Context7** - Add HTTP-based documentation fetching
5. **Add Metrics Collection** - Track iteration counts, quality scores over time
6. **Parallel Processing** - Process multiple packets concurrently
7. **Better Error Recovery** - Retry on transient failures, alert on persistent failures

---

## Technical Specifications

### Data Table Schema
**ClaudiaCodeIssuePackets** (`uY29FyKg9JFPZa9a`):
- `packetID`: string
- `packetJSON`: string (JSON)
- `status`: "queued" | "processing" | "completed" | "failed" | "awaiting_approval"
- `completedAt`: timestamp
- `failedAt`: timestamp
- `failureReason`: string
- `finalScore`: number
- `iterations`: number
- `outputFile`: string

### External Dependencies
- **LMStudio** (localhost:1234) - Code generation
- **Bedroom LMStudio** (credentials) - Validation
- **NAS Storage** (/mnt/n8n-nas/packet_outputs/) - Output persistence

### Models Used
| Purpose | Model | Location |
|---------|-------|----------|
| Simple Tasks | ministral-3-3b | LMStudio |
| Complex Tasks | gpt-oss-20b | LMStudio |
| Validation | qwen/qwen3-vl-8b | Bedroom LMStudio |

---

*Analysis generated: 2026-01-08*
*Source: N8N Workflow API (192.168.245.11:5678)*
