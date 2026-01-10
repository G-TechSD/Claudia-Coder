/**
 * N8N Workflow Templates and LLM Prompts
 *
 * Contains detailed prompts and templates for generating common N8N workflow patterns:
 * - Webhook triggers
 * - API integrations
 * - Data transformations
 * - Conditional logic
 *
 * Used by workflow-generator.ts for pattern-specific generation
 */

// ============ Template Prompt Builders ============

/**
 * Build prompt for webhook trigger workflows
 */
export function buildWebhookTriggerPrompt(config: {
  webhookPath: string
  httpMethod?: string
  expectedPayload?: string
  responseType?: "immediate" | "delayed"
  processingSteps?: string[]
}): string {
  return `Create a webhook-triggered N8N workflow with these specifications:

WEBHOOK CONFIGURATION:
- Path: ${config.webhookPath}
- HTTP Method: ${config.httpMethod || "POST"}
- Response Mode: ${config.responseType === "delayed" ? "responseNode" : "onReceived"}
${config.expectedPayload ? `- Expected Payload Schema: ${config.expectedPayload}` : ""}

PROCESSING REQUIREMENTS:
${config.processingSteps?.map((step, i) => `${i + 1}. ${step}`).join("\n") || "- Process and transform incoming data"}

WORKFLOW STRUCTURE:
1. Webhook node to receive incoming requests
2. ${config.responseType === "delayed" ? "Process data before responding" : "Respond immediately, then process"}
3. Include proper error handling

Generate a complete N8N workflow JSON with all required nodes and connections.`
}

/**
 * Build prompt for API integration workflows
 */
export function buildAPIIntegrationPrompt(config: {
  apiName: string
  apiUrl: string
  authType?: "none" | "bearer" | "api_key" | "basic" | "oauth2"
  operations: Array<{
    name: string
    method: string
    endpoint: string
    requestBody?: string
    expectedResponse?: string
  }>
  triggerType?: "manual" | "schedule" | "webhook"
  scheduleInterval?: string
}): string {
  return `Create an API integration workflow for ${config.apiName}:

API DETAILS:
- Base URL: ${config.apiUrl}
- Authentication: ${config.authType || "none"}

OPERATIONS TO IMPLEMENT:
${config.operations.map((op, i) => `
${i + 1}. ${op.name}
   - Method: ${op.method}
   - Endpoint: ${op.endpoint}
   ${op.requestBody ? `- Request Body: ${op.requestBody}` : ""}
   ${op.expectedResponse ? `- Expected Response: ${op.expectedResponse}` : ""}
`).join("")}

TRIGGER:
- Type: ${config.triggerType || "manual"}
${config.triggerType === "schedule" ? `- Interval: ${config.scheduleInterval || "Every hour"}` : ""}

REQUIREMENTS:
1. Include proper HTTP Request nodes for each operation
2. Add error handling for failed API calls
3. Transform responses as needed
4. Use proper N8N expression syntax for dynamic values

Generate a complete N8N workflow JSON.`
}

/**
 * Build prompt for data transformation workflows
 */
export function buildDataTransformPrompt(config: {
  inputSource: string
  outputDestination: string
  transformations: Array<{
    type: "filter" | "map" | "aggregate" | "sort" | "merge" | "split" | "custom"
    description: string
    field?: string
    condition?: string
  }>
  batchProcessing?: boolean
}): string {
  return `Create a data transformation workflow:

INPUT SOURCE:
${config.inputSource}

OUTPUT DESTINATION:
${config.outputDestination}

TRANSFORMATIONS TO APPLY:
${config.transformations.map((t, i) => `
${i + 1}. ${t.type.toUpperCase()}: ${t.description}
   ${t.field ? `- Target Field: ${t.field}` : ""}
   ${t.condition ? `- Condition: ${t.condition}` : ""}
`).join("")}

${config.batchProcessing ? `
BATCH PROCESSING:
- Process data in batches to handle large datasets
- Use Split In Batches node for optimal performance
` : ""}

REQUIREMENTS:
1. Start with appropriate trigger (manual or schedule)
2. Implement each transformation step as a separate node
3. Use Code nodes for complex transformations
4. Include data validation steps
5. Handle empty data gracefully

Generate a complete N8N workflow JSON with proper node connections.`
}

/**
 * Build prompt for conditional logic workflows
 */
export function buildConditionalLogicPrompt(config: {
  conditionType: "if" | "switch" | "multi-branch"
  conditions: Array<{
    name: string
    expression: string
    action: string
  }>
  defaultAction?: string
  mergeResults?: boolean
}): string {
  return `Create a workflow with conditional routing:

CONDITION TYPE: ${config.conditionType}

CONDITIONS:
${config.conditions.map((c, i) => `
${i + 1}. ${c.name}
   - Expression: ${c.expression}
   - Action: ${c.action}
`).join("")}

${config.defaultAction ? `DEFAULT ACTION (when no conditions match):
${config.defaultAction}` : ""}

${config.mergeResults ? `
MERGE RESULTS:
- After conditional processing, merge all branches back together
- Combine results from different paths
` : ""}

REQUIREMENTS:
1. Use ${config.conditionType === "if" ? "IF node" : config.conditionType === "switch" ? "Switch node" : "Multiple IF nodes"}
2. Create separate processing paths for each condition
3. Use proper N8N expressions for conditions
4. ${config.mergeResults ? "Add Merge node to combine branch outputs" : "Keep branches separate"}

Generate a complete N8N workflow JSON.`
}

// ============ Ready-to-Use Template Definitions ============

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: "webhook" | "api" | "transform" | "conditional" | "notification" | "etl"
  defaultPrompt: string
  variables: Array<{
    name: string
    description: string
    required: boolean
    defaultValue?: string
  }>
  sampleWorkflow?: string // JSON string of a complete sample workflow
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ============ Webhook Templates ============
  {
    id: "webhook-basic",
    name: "Basic Webhook Handler",
    description: "Receive webhook, process data, return response",
    category: "webhook",
    defaultPrompt: buildWebhookTriggerPrompt({
      webhookPath: "webhook",
      httpMethod: "POST",
      responseType: "immediate",
      processingSteps: ["Validate incoming data", "Transform payload", "Return success response"]
    }),
    variables: [
      { name: "webhookPath", description: "URL path for the webhook", required: true, defaultValue: "webhook" },
      { name: "httpMethod", description: "HTTP method (GET, POST, etc.)", required: false, defaultValue: "POST" }
    ]
  },
  {
    id: "webhook-async-process",
    name: "Async Webhook Processor",
    description: "Receive webhook, respond immediately, process in background",
    category: "webhook",
    defaultPrompt: buildWebhookTriggerPrompt({
      webhookPath: "async-webhook",
      httpMethod: "POST",
      responseType: "delayed",
      processingSteps: [
        "Respond with acknowledgment immediately",
        "Process data asynchronously",
        "Send notification on completion"
      ]
    }),
    variables: [
      { name: "webhookPath", description: "URL path for the webhook", required: true, defaultValue: "async-webhook" },
      { name: "notificationChannel", description: "Where to send completion notification", required: false }
    ]
  },
  {
    id: "webhook-validation-routing",
    name: "Webhook with Validation and Routing",
    description: "Receive webhook, validate payload, route based on type",
    category: "webhook",
    defaultPrompt: `Create a webhook workflow that:
1. Receives POST requests at /incoming-data
2. Validates the payload has required fields (type, data, timestamp)
3. Routes to different processing based on the "type" field:
   - type="order": Process as order
   - type="user": Process as user update
   - type="notification": Forward to notification service
4. Returns appropriate response for each path

Include error handling for invalid payloads.`,
    variables: [
      { name: "webhookPath", description: "URL path for the webhook", required: true, defaultValue: "incoming-data" },
      { name: "requiredFields", description: "Comma-separated list of required fields", required: false, defaultValue: "type,data,timestamp" }
    ]
  },

  // ============ API Integration Templates ============
  {
    id: "api-fetch-transform",
    name: "API Fetch and Transform",
    description: "Fetch data from API, transform, and output",
    category: "api",
    defaultPrompt: buildAPIIntegrationPrompt({
      apiName: "External Data API",
      apiUrl: "https://api.example.com",
      authType: "bearer",
      operations: [
        { name: "Fetch Data", method: "GET", endpoint: "/data", expectedResponse: "JSON array of items" }
      ],
      triggerType: "schedule",
      scheduleInterval: "Every hour"
    }),
    variables: [
      { name: "apiUrl", description: "Base URL of the API", required: true },
      { name: "endpoint", description: "API endpoint path", required: true },
      { name: "authType", description: "Authentication type", required: false, defaultValue: "bearer" }
    ]
  },
  {
    id: "api-crud-operations",
    name: "API CRUD Operations",
    description: "Create, read, update, delete via API",
    category: "api",
    defaultPrompt: buildAPIIntegrationPrompt({
      apiName: "Resource API",
      apiUrl: "https://api.example.com",
      authType: "api_key",
      operations: [
        { name: "List Resources", method: "GET", endpoint: "/resources" },
        { name: "Get Resource", method: "GET", endpoint: "/resources/:id" },
        { name: "Create Resource", method: "POST", endpoint: "/resources", requestBody: '{"name": "...", "data": {...}}' },
        { name: "Update Resource", method: "PUT", endpoint: "/resources/:id", requestBody: '{"name": "...", "data": {...}}' },
        { name: "Delete Resource", method: "DELETE", endpoint: "/resources/:id" }
      ],
      triggerType: "manual"
    }),
    variables: [
      { name: "apiUrl", description: "Base URL of the API", required: true },
      { name: "resourceName", description: "Name of the resource", required: true, defaultValue: "resources" }
    ]
  },
  {
    id: "api-multi-source-aggregation",
    name: "Multi-API Aggregation",
    description: "Fetch from multiple APIs and combine results",
    category: "api",
    defaultPrompt: `Create a workflow that aggregates data from multiple APIs:

1. Trigger: Manual or scheduled
2. Parallel API calls:
   - API 1: GET https://api1.example.com/data
   - API 2: GET https://api2.example.com/data
   - API 3: GET https://api3.example.com/data
3. Wait for all API calls to complete
4. Merge and deduplicate results
5. Transform into unified format
6. Output combined data

Include error handling for individual API failures - continue with available data if one fails.`,
    variables: [
      { name: "api1Url", description: "First API URL", required: true },
      { name: "api2Url", description: "Second API URL", required: true },
      { name: "api3Url", description: "Third API URL (optional)", required: false }
    ]
  },

  // ============ Data Transformation Templates ============
  {
    id: "transform-filter-map",
    name: "Filter and Map Data",
    description: "Filter items by condition, map to new structure",
    category: "transform",
    defaultPrompt: buildDataTransformPrompt({
      inputSource: "Array of items from previous node",
      outputDestination: "Transformed array for next node",
      transformations: [
        { type: "filter", description: "Keep only items matching condition", condition: "status === 'active'" },
        { type: "map", description: "Transform each item to new structure" }
      ]
    }),
    variables: [
      { name: "filterCondition", description: "JavaScript condition for filtering", required: true },
      { name: "outputFields", description: "Fields to include in output", required: false }
    ]
  },
  {
    id: "transform-aggregate",
    name: "Aggregate and Summarize",
    description: "Group items and calculate summaries",
    category: "transform",
    defaultPrompt: buildDataTransformPrompt({
      inputSource: "Array of transaction records",
      outputDestination: "Aggregated summary by category",
      transformations: [
        { type: "aggregate", description: "Group by category", field: "category" },
        { type: "custom", description: "Calculate totals, averages, counts per group" }
      ]
    }),
    variables: [
      { name: "groupByField", description: "Field to group by", required: true, defaultValue: "category" },
      { name: "aggregations", description: "Aggregations to calculate (sum, avg, count)", required: false, defaultValue: "sum,count" }
    ]
  },
  {
    id: "transform-batch-process",
    name: "Batch Processing Pipeline",
    description: "Process large datasets in batches",
    category: "transform",
    defaultPrompt: buildDataTransformPrompt({
      inputSource: "Large array of items (100+ items)",
      outputDestination: "Processed items with results",
      transformations: [
        { type: "split", description: "Split into batches of 10 items" },
        { type: "custom", description: "Process each batch (API call, transformation, etc.)" },
        { type: "merge", description: "Combine results from all batches" }
      ],
      batchProcessing: true
    }),
    variables: [
      { name: "batchSize", description: "Number of items per batch", required: false, defaultValue: "10" },
      { name: "processingAction", description: "What to do with each item", required: true }
    ]
  },

  // ============ Conditional Logic Templates ============
  {
    id: "conditional-simple-if",
    name: "Simple IF/ELSE",
    description: "Route based on single condition",
    category: "conditional",
    defaultPrompt: buildConditionalLogicPrompt({
      conditionType: "if",
      conditions: [
        { name: "Condition Met", expression: "value > threshold", action: "Process as high priority" }
      ],
      defaultAction: "Process as normal priority"
    }),
    variables: [
      { name: "conditionField", description: "Field to evaluate", required: true },
      { name: "conditionValue", description: "Value to compare against", required: true }
    ]
  },
  {
    id: "conditional-switch",
    name: "Multi-Way Switch",
    description: "Route to multiple paths based on value",
    category: "conditional",
    defaultPrompt: buildConditionalLogicPrompt({
      conditionType: "switch",
      conditions: [
        { name: "Case A", expression: "type === 'A'", action: "Handle type A" },
        { name: "Case B", expression: "type === 'B'", action: "Handle type B" },
        { name: "Case C", expression: "type === 'C'", action: "Handle type C" }
      ],
      defaultAction: "Handle unknown type",
      mergeResults: false
    }),
    variables: [
      { name: "switchField", description: "Field to switch on", required: true, defaultValue: "type" },
      { name: "cases", description: "Comma-separated list of case values", required: true, defaultValue: "A,B,C" }
    ]
  },
  {
    id: "conditional-multi-branch-merge",
    name: "Multi-Branch with Merge",
    description: "Process in parallel branches, merge results",
    category: "conditional",
    defaultPrompt: buildConditionalLogicPrompt({
      conditionType: "multi-branch",
      conditions: [
        { name: "Branch 1", expression: "category === 'sales'", action: "Calculate sales metrics" },
        { name: "Branch 2", expression: "category === 'marketing'", action: "Calculate marketing metrics" },
        { name: "Branch 3", expression: "category === 'support'", action: "Calculate support metrics" }
      ],
      mergeResults: true
    }),
    variables: [
      { name: "branchField", description: "Field to branch on", required: true },
      { name: "branches", description: "Branch configurations", required: true }
    ]
  },

  // ============ Notification Templates ============
  {
    id: "notification-slack",
    name: "Slack Notification",
    description: "Send formatted message to Slack channel",
    category: "notification",
    defaultPrompt: `Create a workflow that sends Slack notifications:

1. Trigger: Webhook or manual
2. Format message with:
   - Title/header
   - Main message body
   - Key data points as fields
   - Color-coded attachment based on status
3. Send to specified Slack channel
4. Return success/failure status

Include:
- Slack node with message formatting
- Error handling for Slack API failures
- Retry logic for transient failures`,
    variables: [
      { name: "channel", description: "Slack channel name", required: true, defaultValue: "#notifications" },
      { name: "messageTemplate", description: "Message template with placeholders", required: false }
    ]
  },
  {
    id: "notification-multi-channel",
    name: "Multi-Channel Notification",
    description: "Send to Slack, Email, and/or Discord",
    category: "notification",
    defaultPrompt: `Create a workflow that sends notifications to multiple channels:

1. Trigger: Webhook with notification data
2. Determine which channels to use based on payload or settings
3. Parallel notification sends:
   - Slack: Rich formatted message
   - Email: HTML formatted email
   - Discord: Webhook message
4. Aggregate results
5. Return summary of what was sent

Include configuration for:
- Channel-specific formatting
- Conditional channel selection
- Error handling per channel`,
    variables: [
      { name: "slackChannel", description: "Slack channel", required: false },
      { name: "emailRecipients", description: "Email addresses", required: false },
      { name: "discordWebhook", description: "Discord webhook URL", required: false }
    ]
  },

  // ============ ETL Templates ============
  {
    id: "etl-database-sync",
    name: "Database Sync Pipeline",
    description: "Extract from source DB, transform, load to target",
    category: "etl",
    defaultPrompt: `Create an ETL workflow for database synchronization:

1. Schedule Trigger: Run every hour
2. EXTRACT:
   - Query source database for changed records (using last_modified > last_sync_time)
   - Handle pagination for large result sets
3. TRANSFORM:
   - Map source schema to target schema
   - Clean and validate data
   - Handle NULL values and type conversions
4. LOAD:
   - Upsert records to target database
   - Track sync progress
   - Log any failed records
5. CLEANUP:
   - Update last_sync_time
   - Send summary notification

Include error handling and retry logic.`,
    variables: [
      { name: "sourceDb", description: "Source database connection", required: true },
      { name: "targetDb", description: "Target database connection", required: true },
      { name: "tableName", description: "Table to sync", required: true }
    ]
  },
  {
    id: "etl-api-to-sheets",
    name: "API to Google Sheets",
    description: "Fetch API data and update spreadsheet",
    category: "etl",
    defaultPrompt: `Create an ETL workflow from API to Google Sheets:

1. Schedule Trigger: Run daily at 9 AM
2. EXTRACT:
   - Call external API to fetch latest data
   - Handle pagination if needed
3. TRANSFORM:
   - Flatten nested JSON structures
   - Format dates and numbers
   - Add calculated fields
4. LOAD:
   - Clear existing data in target sheet
   - Write new data rows
   - Format cells (headers, number formats)
5. NOTIFY:
   - Send Slack message with row count and summary

Include error handling for API and Sheets failures.`,
    variables: [
      { name: "apiUrl", description: "API endpoint URL", required: true },
      { name: "spreadsheetId", description: "Google Sheets ID", required: true },
      { name: "sheetName", description: "Sheet name", required: true, defaultValue: "Data" }
    ]
  }
]

/**
 * Get template by ID
 */
export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find(t => t.id === id)
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: WorkflowTemplate["category"]): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter(t => t.category === category)
}

/**
 * Get all template categories
 */
export function getTemplateCategories(): Array<{ id: string; name: string; count: number }> {
  const categories: Record<string, number> = {}

  for (const template of WORKFLOW_TEMPLATES) {
    categories[template.category] = (categories[template.category] || 0) + 1
  }

  const categoryNames: Record<string, string> = {
    webhook: "Webhook Triggers",
    api: "API Integrations",
    transform: "Data Transformations",
    conditional: "Conditional Logic",
    notification: "Notifications",
    etl: "ETL Pipelines"
  }

  return Object.entries(categories).map(([id, count]) => ({
    id,
    name: categoryNames[id] || id,
    count
  }))
}

/**
 * Build custom prompt from template with variable substitution
 */
export function buildPromptFromTemplate(
  templateId: string,
  variables: Record<string, string>
): { prompt: string; errors: string[] } {
  const template = getTemplateById(templateId)

  if (!template) {
    return {
      prompt: "",
      errors: [`Template not found: ${templateId}`]
    }
  }

  const errors: string[] = []

  // Check required variables
  for (const v of template.variables) {
    if (v.required && !variables[v.name] && !v.defaultValue) {
      errors.push(`Missing required variable: ${v.name}`)
    }
  }

  if (errors.length > 0) {
    return { prompt: "", errors }
  }

  // Substitute variables in prompt
  let prompt = template.defaultPrompt

  for (const v of template.variables) {
    const value = variables[v.name] || v.defaultValue || ""
    const regex = new RegExp(`\\$\\{${v.name}\\}|{{${v.name}}}`, "g")
    prompt = prompt.replace(regex, value)
  }

  return { prompt, errors: [] }
}

