/**
 * AI-Powered N8N Workflow Generator
 *
 * Uses local LLM server (with gpt-oss-20b) to generate N8N workflow JSON
 * from natural language descriptions.
 *
 * Features:
 * - Natural language to N8N workflow conversion
 * - Common node type support (HTTP, Code, IF, Switch, etc.)
 * - Valid N8N workflow structure generation
 * - Template-based pattern recognition
 */

import { generateWithLocalLLM } from "@/lib/llm/local-llm"

// ============ N8N Workflow Types ============

export interface N8NPosition {
  x: number
  y: number
}

export interface N8NConnection {
  node: string
  type: string
  index: number
}

export interface N8NNodeParameter {
  [key: string]: unknown
}

export interface N8NNode {
  id: string
  name: string
  type: string
  typeVersion: number
  position: [number, number]
  parameters: N8NNodeParameter
  credentials?: {
    [key: string]: {
      id: string
      name: string
    }
  }
}

export interface N8NWorkflow {
  name: string
  nodes: N8NNode[]
  connections: {
    [nodeName: string]: {
      main: Array<N8NConnection[]>
    }
  }
  active: boolean
  settings: {
    executionOrder: string
    saveManualExecutions?: boolean
    callerPolicy?: string
    errorWorkflow?: string
  }
  tags?: Array<{ id: string; name: string }>
  meta?: {
    instanceId?: string
    templateCredsSetupCompleted?: boolean
  }
}

// ============ Common N8N Node Types ============

export const N8N_NODE_TYPES = {
  // Triggers
  WEBHOOK: "n8n-nodes-base.webhook",
  SCHEDULE: "n8n-nodes-base.scheduleTrigger",
  MANUAL: "n8n-nodes-base.manualTrigger",
  EMAIL_TRIGGER: "n8n-nodes-base.emailReadImap",

  // HTTP & API
  HTTP_REQUEST: "n8n-nodes-base.httpRequest",
  WEBHOOK_RESPONSE: "n8n-nodes-base.respondToWebhook",

  // Logic & Flow
  IF: "n8n-nodes-base.if",
  SWITCH: "n8n-nodes-base.switch",
  MERGE: "n8n-nodes-base.merge",
  SPLIT_IN_BATCHES: "n8n-nodes-base.splitInBatches",
  WAIT: "n8n-nodes-base.wait",
  NO_OP: "n8n-nodes-base.noOp",
  STOP_AND_ERROR: "n8n-nodes-base.stopAndError",

  // Code & Transform
  CODE: "n8n-nodes-base.code",
  SET: "n8n-nodes-base.set",
  FILTER: "n8n-nodes-base.filter",
  SORT: "n8n-nodes-base.sort",
  AGGREGATE: "n8n-nodes-base.aggregate",
  ITEM_LISTS: "n8n-nodes-base.itemLists",
  DATE_TIME: "n8n-nodes-base.dateTime",
  CRYPTO: "n8n-nodes-base.crypto",
  HTML_EXTRACT: "n8n-nodes-base.html",
  JSON_PARSE: "n8n-nodes-base.function",
  EDIT_FIELDS: "n8n-nodes-base.set",

  // Database
  POSTGRES: "n8n-nodes-base.postgres",
  MYSQL: "n8n-nodes-base.mySql",
  MONGODB: "n8n-nodes-base.mongoDb",
  REDIS: "n8n-nodes-base.redis",

  // Notifications
  SLACK: "n8n-nodes-base.slack",
  EMAIL_SEND: "n8n-nodes-base.emailSend",
  DISCORD: "n8n-nodes-base.discord",
  TELEGRAM: "n8n-nodes-base.telegram",

  // File Operations
  READ_BINARY_FILE: "n8n-nodes-base.readBinaryFile",
  WRITE_BINARY_FILE: "n8n-nodes-base.writeBinaryFile",
  SPREADSHEET: "n8n-nodes-base.spreadsheetFile",
  CSV: "n8n-nodes-base.csv",

  // External Services
  GOOGLE_SHEETS: "n8n-nodes-base.googleSheets",
  AIRTABLE: "n8n-nodes-base.airtable",
  NOTION: "n8n-nodes-base.notion",
  GITHUB: "n8n-nodes-base.github",
  GITLAB: "n8n-nodes-base.gitlab",
  JIRA: "n8n-nodes-base.jira",
  LINEAR: "n8n-nodes-base.linear",

  // AI/LLM
  OPENAI: "n8n-nodes-base.openAi",
  AI_AGENT: "@n8n/n8n-nodes-langchain.agent",
} as const

// ============ Workflow Pattern Templates ============

export const WORKFLOW_PATTERNS = {
  WEBHOOK_PROCESS_RESPOND: {
    name: "Webhook Process and Respond",
    description: "Receive webhook, process data, respond to caller",
    nodeSequence: ["webhook", "code", "respond"],
    template: `
      Webhook trigger receives data -> Code node processes/transforms data ->
      Respond to Webhook sends result back to caller
    `,
  },
  API_INTEGRATION: {
    name: "API Integration",
    description: "Call external API, transform data, store or forward",
    nodeSequence: ["trigger", "http", "code", "output"],
    template: `
      Trigger (manual/schedule/webhook) -> HTTP Request to external API ->
      Code node transforms response -> Output (database/notification/http)
    `,
  },
  DATA_SYNC: {
    name: "Data Synchronization",
    description: "Sync data between two systems",
    nodeSequence: ["schedule", "http_source", "code", "http_dest"],
    template: `
      Schedule Trigger runs periodically -> Fetch data from source system ->
      Transform/map data -> Push to destination system
    `,
  },
  CONDITIONAL_ROUTING: {
    name: "Conditional Routing",
    description: "Route data based on conditions",
    nodeSequence: ["trigger", "if/switch", "branch_nodes"],
    template: `
      Trigger receives data -> IF/Switch evaluates conditions ->
      Different branches handle different cases
    `,
  },
  NOTIFICATION_PIPELINE: {
    name: "Notification Pipeline",
    description: "Monitor and send notifications",
    nodeSequence: ["trigger", "check", "if", "notify"],
    template: `
      Trigger (schedule/webhook) -> Check condition/data ->
      IF condition met -> Send notification (Slack/Email/Discord)
    `,
  },
  ETL_PIPELINE: {
    name: "ETL Pipeline",
    description: "Extract, transform, load data",
    nodeSequence: ["trigger", "extract", "transform", "load"],
    template: `
      Trigger starts pipeline -> Extract data from source(s) ->
      Multiple transform steps (filter, map, aggregate) ->
      Load into destination
    `,
  },
  ERROR_HANDLING: {
    name: "Error Handling",
    description: "Workflow with try-catch error handling",
    nodeSequence: ["trigger", "main_flow", "error_handler"],
    template: `
      Trigger starts workflow -> Main processing flow ->
      On error: Error handler node sends alert/logs error
    `,
  },
  BATCH_PROCESSING: {
    name: "Batch Processing",
    description: "Process items in batches",
    nodeSequence: ["trigger", "split", "process", "merge"],
    template: `
      Trigger with array data -> Split into batches ->
      Process each batch -> Merge results
    `,
  },
} as const

export type WorkflowPatternKey = keyof typeof WORKFLOW_PATTERNS

// ============ System Prompts ============

const WORKFLOW_GENERATION_SYSTEM_PROMPT = `You are an expert N8N workflow generator. Your task is to create valid N8N workflow JSON from natural language descriptions.

## N8N Workflow Structure
A valid N8N workflow has this structure:
{
  "name": "Workflow Name",
  "nodes": [...],  // Array of node objects
  "connections": {...},  // Object defining how nodes connect
  "active": false,
  "settings": { "executionOrder": "v1" }
}

## Node Structure
Each node must have:
- id: Unique identifier (e.g., "uuid-1234-5678")
- name: Human-readable name
- type: N8N node type (e.g., "n8n-nodes-base.webhook")
- typeVersion: Version number (usually 1, 1.1, or 2)
- position: [x, y] coordinates for canvas placement
- parameters: Node-specific configuration

## Common Node Types and Their Parameters

### Webhook Trigger (n8n-nodes-base.webhook)
{
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "parameters": {
    "httpMethod": "POST",
    "path": "webhook-path",
    "responseMode": "onReceived",
    "responseData": "allEntries"
  }
}

### HTTP Request (n8n-nodes-base.httpRequest)
{
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "parameters": {
    "method": "GET|POST|PUT|DELETE",
    "url": "https://api.example.com/endpoint",
    "sendHeaders": true,
    "headerParameters": { "parameters": [{ "name": "Authorization", "value": "Bearer token" }] },
    "sendBody": true,
    "bodyParameters": { "parameters": [{ "name": "key", "value": "value" }] }
  }
}

### Code Node (n8n-nodes-base.code)
{
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "// JavaScript code here\\nreturn items;"
  }
}

### IF Node (n8n-nodes-base.if)
{
  "type": "n8n-nodes-base.if",
  "typeVersion": 2,
  "parameters": {
    "conditions": {
      "options": { "caseSensitive": true, "leftValue": "" },
      "conditions": [
        {
          "leftValue": "={{ $json.field }}",
          "rightValue": "expected_value",
          "operator": { "type": "string", "operation": "equals" }
        }
      ],
      "combinator": "and"
    }
  }
}

### Switch Node (n8n-nodes-base.switch)
{
  "type": "n8n-nodes-base.switch",
  "typeVersion": 3,
  "parameters": {
    "rules": {
      "rules": [
        { "outputKey": "case1", "conditions": { "conditions": [...] } },
        { "outputKey": "case2", "conditions": { "conditions": [...] } }
      ]
    },
    "options": {}
  }
}

### Set/Edit Fields Node (n8n-nodes-base.set)
{
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "parameters": {
    "mode": "manual",
    "duplicateItem": false,
    "assignments": {
      "assignments": [
        { "id": "field1", "name": "outputField", "value": "={{ $json.inputField }}", "type": "string" }
      ]
    }
  }
}

### Slack Node (n8n-nodes-base.slack)
{
  "type": "n8n-nodes-base.slack",
  "typeVersion": 2.2,
  "parameters": {
    "resource": "message",
    "operation": "post",
    "channel": { "__rl": true, "mode": "name", "value": "#channel-name" },
    "text": "Message text"
  }
}

### Schedule Trigger (n8n-nodes-base.scheduleTrigger)
{
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.2,
  "parameters": {
    "rule": {
      "interval": [{ "field": "hours", "hoursInterval": 1 }]
    }
  }
}

### Respond to Webhook (n8n-nodes-base.respondToWebhook)
{
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1.1,
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ $json }}"
  }
}

## Connection Structure
Connections define data flow between nodes:
{
  "Node Name 1": {
    "main": [[{ "node": "Node Name 2", "type": "main", "index": 0 }]]
  }
}

For nodes with multiple outputs (IF, Switch):
{
  "IF Node": {
    "main": [
      [{ "node": "True Branch Node", "type": "main", "index": 0 }],  // true output
      [{ "node": "False Branch Node", "type": "main", "index": 0 }]  // false output
    ]
  }
}

## Position Guidelines
- Start trigger at position [250, 300]
- Space nodes horizontally by ~200-300 pixels
- Use vertical spacing of ~150 pixels for parallel branches

## Important Rules
1. Always start with a trigger node (webhook, schedule, manual)
2. Generate unique UUIDs for node IDs
3. Use proper N8N expression syntax: {{ $json.field }} for data access
4. Escape newlines in Code node JavaScript as \\n
5. Include all required parameters for each node type
6. Connect all nodes - no orphan nodes
7. Output ONLY valid JSON - no markdown, no explanations`

// ============ Generation Functions ============

export interface WorkflowGenerationRequest {
  description: string
  patternHint?: WorkflowPatternKey
  includeErrorHandling?: boolean
  additionalContext?: string
}

export interface WorkflowGenerationResponse {
  success: boolean
  workflow?: N8NWorkflow
  error?: string
  llmResponse?: string
  server?: string
  model?: string
}

/**
 * Generate a unique UUID for N8N nodes
 */
function generateNodeId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Build the user prompt for workflow generation
 */
function buildGenerationPrompt(request: WorkflowGenerationRequest): string {
  let prompt = `Generate a complete N8N workflow JSON for the following requirement:

DESCRIPTION: ${request.description}
`

  if (request.patternHint && WORKFLOW_PATTERNS[request.patternHint]) {
    const pattern = WORKFLOW_PATTERNS[request.patternHint]
    prompt += `
SUGGESTED PATTERN: ${pattern.name}
PATTERN DESCRIPTION: ${pattern.description}
PATTERN TEMPLATE: ${pattern.template}
`
  }

  if (request.includeErrorHandling) {
    prompt += `
REQUIREMENT: Include error handling with try-catch logic and error notification.
`
  }

  if (request.additionalContext) {
    prompt += `
ADDITIONAL CONTEXT: ${request.additionalContext}
`
  }

  prompt += `
Generate a complete, valid N8N workflow JSON that can be directly imported into N8N.
Use descriptive node names that explain what each node does.
Generate unique UUIDs for each node's id field.
Output ONLY the JSON object, no markdown code blocks or explanations.`

  return prompt
}

/**
 * Parse and validate the LLM response as N8N workflow JSON
 */
function parseWorkflowResponse(response: string): { workflow?: N8NWorkflow; error?: string } {
  // Clean the response - remove markdown code blocks if present
  let cleanedResponse = response.trim()

  // Remove markdown code block wrappers
  if (cleanedResponse.startsWith('```json')) {
    cleanedResponse = cleanedResponse.slice(7)
  } else if (cleanedResponse.startsWith('```')) {
    cleanedResponse = cleanedResponse.slice(3)
  }

  if (cleanedResponse.endsWith('```')) {
    cleanedResponse = cleanedResponse.slice(0, -3)
  }

  cleanedResponse = cleanedResponse.trim()

  // Try to find JSON object in the response
  const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    cleanedResponse = jsonMatch[0]
  }

  try {
    const workflow = JSON.parse(cleanedResponse) as N8NWorkflow

    // Basic validation
    if (!workflow.name) {
      return { error: "Generated workflow missing 'name' field" }
    }

    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      return { error: "Generated workflow missing 'nodes' array" }
    }

    if (workflow.nodes.length === 0) {
      return { error: "Generated workflow has no nodes" }
    }

    if (!workflow.connections) {
      return { error: "Generated workflow missing 'connections' object" }
    }

    // Ensure required fields have defaults
    workflow.active = workflow.active ?? false
    workflow.settings = workflow.settings ?? { executionOrder: "v1" }

    // Generate IDs for nodes that don't have them
    for (const node of workflow.nodes) {
      if (!node.id) {
        node.id = generateNodeId()
      }
    }

    // Validate each node has required fields
    for (const node of workflow.nodes) {
      if (!node.name) {
        return { error: `Node missing 'name' field` }
      }
      if (!node.type) {
        return { error: `Node '${node.name}' missing 'type' field` }
      }
      if (!node.position || !Array.isArray(node.position)) {
        // Set default position if missing
        node.position = [250, 300]
      }
      if (!node.parameters) {
        node.parameters = {}
      }
      if (!node.typeVersion) {
        node.typeVersion = 1
      }
    }

    return { workflow }
  } catch (e) {
    return {
      error: `Failed to parse workflow JSON: ${e instanceof Error ? e.message : 'Unknown error'}`
    }
  }
}

/**
 * Generate an N8N workflow from a natural language description
 * Uses local LLM server with gpt-oss-20b model
 */
export async function generateWorkflow(
  request: WorkflowGenerationRequest
): Promise<WorkflowGenerationResponse> {
  try {
    const userPrompt = buildGenerationPrompt(request)

    const llmResponse = await generateWithLocalLLM(
      WORKFLOW_GENERATION_SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.3, // Lower temperature for more consistent JSON output
        max_tokens: 4096, // Allow for complex workflows
        preferredServer: "local-llm-server",
        preferredModel: "gpt-oss-20b"
      }
    )

    if (llmResponse.error) {
      return {
        success: false,
        error: `LLM generation failed: ${llmResponse.error}`,
        server: llmResponse.server,
        model: llmResponse.model
      }
    }

    if (!llmResponse.content) {
      return {
        success: false,
        error: "LLM returned empty response",
        server: llmResponse.server,
        model: llmResponse.model
      }
    }

    const parseResult = parseWorkflowResponse(llmResponse.content)

    if (parseResult.error) {
      return {
        success: false,
        error: parseResult.error,
        llmResponse: llmResponse.content,
        server: llmResponse.server,
        model: llmResponse.model
      }
    }

    return {
      success: true,
      workflow: parseResult.workflow,
      llmResponse: llmResponse.content,
      server: llmResponse.server,
      model: llmResponse.model
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during workflow generation"
    }
  }
}

/**
 * Detect which workflow pattern best matches the description
 */
export function detectWorkflowPattern(description: string): WorkflowPatternKey | null {
  const lowerDesc = description.toLowerCase()

  // Pattern detection keywords
  const patternKeywords: Record<WorkflowPatternKey, string[]> = {
    WEBHOOK_PROCESS_RESPOND: ["webhook", "api endpoint", "receive", "respond", "callback"],
    API_INTEGRATION: ["call api", "external api", "fetch", "integrate", "third-party"],
    DATA_SYNC: ["sync", "synchronize", "mirror", "replicate", "copy data"],
    CONDITIONAL_ROUTING: ["if", "condition", "route", "switch", "branch", "when"],
    NOTIFICATION_PIPELINE: ["notify", "alert", "slack", "email", "notification", "message"],
    ETL_PIPELINE: ["etl", "extract", "transform", "load", "pipeline", "data processing"],
    ERROR_HANDLING: ["error", "catch", "handle failure", "retry", "fallback"],
    BATCH_PROCESSING: ["batch", "bulk", "many items", "process all", "iterate"],
  }

  let bestMatch: WorkflowPatternKey | null = null
  let highestScore = 0

  for (const [pattern, keywords] of Object.entries(patternKeywords)) {
    const score = keywords.filter(kw => lowerDesc.includes(kw)).length
    if (score > highestScore) {
      highestScore = score
      bestMatch = pattern as WorkflowPatternKey
    }
  }

  return highestScore > 0 ? bestMatch : null
}

/**
 * Validate an existing N8N workflow structure
 */
export function validateWorkflow(workflow: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!workflow || typeof workflow !== 'object') {
    return { valid: false, errors: ["Workflow must be an object"] }
  }

  const w = workflow as Record<string, unknown>

  if (!w.name || typeof w.name !== 'string') {
    errors.push("Workflow must have a 'name' string field")
  }

  if (!w.nodes || !Array.isArray(w.nodes)) {
    errors.push("Workflow must have a 'nodes' array")
  } else {
    const nodes = w.nodes as unknown[]
    if (nodes.length === 0) {
      errors.push("Workflow must have at least one node")
    }

    // Check for trigger node
    const hasTrigger = nodes.some((n: unknown) => {
      if (n && typeof n === 'object') {
        const node = n as Record<string, unknown>
        const type = node.type as string | undefined
        return type?.includes('Trigger') || type?.includes('webhook')
      }
      return false
    })

    if (!hasTrigger) {
      errors.push("Workflow should have a trigger node (webhook, schedule, or manual)")
    }

    // Validate individual nodes
    nodes.forEach((node: unknown, index: number) => {
      if (!node || typeof node !== 'object') {
        errors.push(`Node at index ${index} must be an object`)
        return
      }

      const n = node as Record<string, unknown>

      if (!n.name || typeof n.name !== 'string') {
        errors.push(`Node at index ${index} must have a 'name' string field`)
      }

      if (!n.type || typeof n.type !== 'string') {
        errors.push(`Node at index ${index} must have a 'type' string field`)
      }

      if (!n.position || !Array.isArray(n.position) || n.position.length !== 2) {
        errors.push(`Node '${n.name || index}' must have a 'position' [x, y] array`)
      }
    })
  }

  if (!w.connections || typeof w.connections !== 'object') {
    errors.push("Workflow must have a 'connections' object")
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Create a minimal empty workflow template
 */
export function createEmptyWorkflow(name: string): N8NWorkflow {
  return {
    name,
    nodes: [
      {
        id: generateNodeId(),
        name: "Manual Trigger",
        type: "n8n-nodes-base.manualTrigger",
        typeVersion: 1,
        position: [250, 300],
        parameters: {}
      }
    ],
    connections: {},
    active: false,
    settings: {
      executionOrder: "v1"
    }
  }
}

/**
 * Create a workflow from a specific pattern template
 */
export function createWorkflowFromPattern(
  name: string,
  pattern: WorkflowPatternKey
): N8NWorkflow {
  const baseWorkflow = createEmptyWorkflow(name)

  switch (pattern) {
    case "WEBHOOK_PROCESS_RESPOND":
      baseWorkflow.nodes = [
        {
          id: generateNodeId(),
          name: "Webhook",
          type: N8N_NODE_TYPES.WEBHOOK,
          typeVersion: 2,
          position: [250, 300],
          parameters: {
            httpMethod: "POST",
            path: "webhook",
            responseMode: "responseNode"
          }
        },
        {
          id: generateNodeId(),
          name: "Process Data",
          type: N8N_NODE_TYPES.CODE,
          typeVersion: 2,
          position: [500, 300],
          parameters: {
            mode: "runOnceForAllItems",
            jsCode: "// Process incoming data\nconst items = $input.all();\n\n// Transform data here\nconst processed = items.map(item => ({\n  json: {\n    ...item.json,\n    processedAt: new Date().toISOString()\n  }\n}));\n\nreturn processed;"
          }
        },
        {
          id: generateNodeId(),
          name: "Respond to Webhook",
          type: N8N_NODE_TYPES.WEBHOOK_RESPONSE,
          typeVersion: 1.1,
          position: [750, 300],
          parameters: {
            respondWith: "json",
            responseBody: "={{ $json }}"
          }
        }
      ]
      baseWorkflow.connections = {
        "Webhook": {
          main: [[{ node: "Process Data", type: "main", index: 0 }]]
        },
        "Process Data": {
          main: [[{ node: "Respond to Webhook", type: "main", index: 0 }]]
        }
      }
      break

    case "API_INTEGRATION":
      baseWorkflow.nodes = [
        {
          id: generateNodeId(),
          name: "Manual Trigger",
          type: N8N_NODE_TYPES.MANUAL,
          typeVersion: 1,
          position: [250, 300],
          parameters: {}
        },
        {
          id: generateNodeId(),
          name: "HTTP Request",
          type: N8N_NODE_TYPES.HTTP_REQUEST,
          typeVersion: 4.2,
          position: [500, 300],
          parameters: {
            method: "GET",
            url: "https://api.example.com/data"
          }
        },
        {
          id: generateNodeId(),
          name: "Transform Response",
          type: N8N_NODE_TYPES.CODE,
          typeVersion: 2,
          position: [750, 300],
          parameters: {
            mode: "runOnceForAllItems",
            jsCode: "// Transform API response\nconst items = $input.all();\nreturn items;"
          }
        }
      ]
      baseWorkflow.connections = {
        "Manual Trigger": {
          main: [[{ node: "HTTP Request", type: "main", index: 0 }]]
        },
        "HTTP Request": {
          main: [[{ node: "Transform Response", type: "main", index: 0 }]]
        }
      }
      break

    case "CONDITIONAL_ROUTING":
      baseWorkflow.nodes = [
        {
          id: generateNodeId(),
          name: "Manual Trigger",
          type: N8N_NODE_TYPES.MANUAL,
          typeVersion: 1,
          position: [250, 300],
          parameters: {}
        },
        {
          id: generateNodeId(),
          name: "IF Condition",
          type: N8N_NODE_TYPES.IF,
          typeVersion: 2,
          position: [500, 300],
          parameters: {
            conditions: {
              options: { caseSensitive: true, leftValue: "" },
              conditions: [
                {
                  leftValue: "={{ $json.status }}",
                  rightValue: "success",
                  operator: { type: "string", operation: "equals" }
                }
              ],
              combinator: "and"
            }
          }
        },
        {
          id: generateNodeId(),
          name: "Success Path",
          type: N8N_NODE_TYPES.NO_OP,
          typeVersion: 1,
          position: [750, 200],
          parameters: {}
        },
        {
          id: generateNodeId(),
          name: "Failure Path",
          type: N8N_NODE_TYPES.NO_OP,
          typeVersion: 1,
          position: [750, 400],
          parameters: {}
        }
      ]
      baseWorkflow.connections = {
        "Manual Trigger": {
          main: [[{ node: "IF Condition", type: "main", index: 0 }]]
        },
        "IF Condition": {
          main: [
            [{ node: "Success Path", type: "main", index: 0 }],
            [{ node: "Failure Path", type: "main", index: 0 }]
          ]
        }
      }
      break

    case "NOTIFICATION_PIPELINE":
      baseWorkflow.nodes = [
        {
          id: generateNodeId(),
          name: "Schedule Trigger",
          type: N8N_NODE_TYPES.SCHEDULE,
          typeVersion: 1.2,
          position: [250, 300],
          parameters: {
            rule: {
              interval: [{ field: "hours", hoursInterval: 1 }]
            }
          }
        },
        {
          id: generateNodeId(),
          name: "Check Condition",
          type: N8N_NODE_TYPES.CODE,
          typeVersion: 2,
          position: [500, 300],
          parameters: {
            mode: "runOnceForAllItems",
            jsCode: "// Check if notification should be sent\nreturn [{ json: { shouldNotify: true, message: 'Alert!' } }];"
          }
        },
        {
          id: generateNodeId(),
          name: "Should Notify?",
          type: N8N_NODE_TYPES.IF,
          typeVersion: 2,
          position: [750, 300],
          parameters: {
            conditions: {
              options: { caseSensitive: true, leftValue: "" },
              conditions: [
                {
                  leftValue: "={{ $json.shouldNotify }}",
                  rightValue: "true",
                  operator: { type: "boolean", operation: "true" }
                }
              ],
              combinator: "and"
            }
          }
        },
        {
          id: generateNodeId(),
          name: "Send Notification",
          type: N8N_NODE_TYPES.NO_OP,
          typeVersion: 1,
          position: [1000, 200],
          parameters: {}
        }
      ]
      baseWorkflow.connections = {
        "Schedule Trigger": {
          main: [[{ node: "Check Condition", type: "main", index: 0 }]]
        },
        "Check Condition": {
          main: [[{ node: "Should Notify?", type: "main", index: 0 }]]
        },
        "Should Notify?": {
          main: [
            [{ node: "Send Notification", type: "main", index: 0 }],
            []
          ]
        }
      }
      break

    default:
      // Return basic template for unimplemented patterns
      break
  }

  return baseWorkflow
}

