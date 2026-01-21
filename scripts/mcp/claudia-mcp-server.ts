/**
 * Claudia MCP Server
 *
 * This MCP server allows Claude Code terminal to interact with Claudia Code,
 * enabling packet management, quality loops, and approval workflows.
 *
 * To use: claude mcp add claudia -- npx ts-node /path/to/claudia-mcp-server.ts
 *
 * Tools provided:
 * - list_projects: Get all Claudia projects
 * - get_project: Get project details by ID
 * - list_packets: Get packets for a project
 * - update_packet_status: Update packet status (queued, in_progress, completed, failed)
 * - execute_packet: Trigger packet execution via Claudia
 * - get_quality_gates: Get quality gate results for a packet
 * - submit_for_approval: Submit completed work for human approval
 * - get_build_plan: Get build plan for a project
 * - report_costs: Report API costs from Claude Code execution
 */

import * as fs from "fs"
import * as path from "path"

// Cost storage location
const COSTS_FILE = "/home/bill/projects/claudia-admin/.local-storage/costs.json"

interface CostEntry {
  id: string
  sessionId: string
  projectId?: string
  projectName?: string
  packetId?: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  cost: number
  timestamp: string
  description: string
}

interface CostsData {
  entries: CostEntry[]
  lastUpdated: string
}

// Helper to read costs file
function readCostsFile(): CostsData {
  try {
    if (fs.existsSync(COSTS_FILE)) {
      const data = fs.readFileSync(COSTS_FILE, "utf-8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error("[claudia-mcp] Failed to read costs file:", error)
  }
  return { entries: [], lastUpdated: new Date().toISOString() }
}

// Helper to write costs file
function writeCostsFile(data: CostsData): void {
  try {
    // Ensure directory exists
    const dir = path.dirname(COSTS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    data.lastUpdated = new Date().toISOString()
    fs.writeFileSync(COSTS_FILE, JSON.stringify(data, null, 2), "utf-8")
  } catch (error) {
    console.error("[claudia-mcp] Failed to write costs file:", error)
    throw error
  }
}

const CLAUDIA_API_BASE = process.env.CLAUDIA_API_URL || "https://localhost:3000/api"

// MCP Server implementation
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

// Tool definitions
const TOOLS = [
  {
    name: "list_projects",
    description: "List all projects in Claudia Code. Returns project IDs, names, status, and packet counts.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "planning", "active", "paused", "completed", "archived"],
          description: "Filter by project status (default: all)"
        }
      }
    }
  },
  {
    name: "get_project",
    description: "Get detailed information about a specific project including build plan, packets, and repos.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID (UUID)"
        }
      },
      required: ["projectId"]
    }
  },
  {
    name: "list_packets",
    description: "List all work packets for a project. Packets are units of work from the build plan.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID"
        },
        status: {
          type: "string",
          enum: ["all", "queued", "in_progress", "completed", "failed"],
          description: "Filter by packet status"
        }
      },
      required: ["projectId"]
    }
  },
  {
    name: "create_packet",
    description: "Create a new work packet for a project. Use to add new tasks discovered during development.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID"
        },
        title: {
          type: "string",
          description: "Title of the work packet"
        },
        description: {
          type: "string",
          description: "Description of what needs to be done"
        },
        type: {
          type: "string",
          enum: ["feature", "bugfix", "refactor", "test", "docs", "config", "research"],
          description: "Type of work (default: feature)"
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Priority level (default: medium)"
        },
        tasks: {
          type: "array",
          items: { type: "string" },
          description: "List of task descriptions"
        },
        acceptanceCriteria: {
          type: "array",
          items: { type: "string" },
          description: "Acceptance criteria for the packet"
        },
        dependencies: {
          type: "array",
          items: { type: "string" },
          description: "IDs of packets this depends on"
        }
      },
      required: ["projectId", "title"]
    }
  },
  {
    name: "update_packet_status",
    description: "Update the status of a work packet. Use after completing or failing a task.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID"
        },
        packetId: {
          type: "string",
          description: "The packet ID"
        },
        status: {
          type: "string",
          enum: ["queued", "in_progress", "completed", "failed"],
          description: "New status for the packet"
        },
        output: {
          type: "string",
          description: "Output or notes about the work done"
        },
        filesChanged: {
          type: "array",
          items: { type: "string" },
          description: "List of files that were modified"
        }
      },
      required: ["projectId", "packetId", "status"]
    }
  },
  {
    name: "execute_packet",
    description: "Trigger Claudia to execute a packet using its configured execution mode (Local/Turbo/N8N).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID"
        },
        packetId: {
          type: "string",
          description: "The packet ID to execute"
        },
        mode: {
          type: "string",
          enum: ["auto", "local", "turbo", "n8n"],
          description: "Execution mode (default: auto)"
        }
      },
      required: ["projectId", "packetId"]
    }
  },
  {
    name: "get_quality_gates",
    description: "Get quality gate results (tests, TypeScript, build) for the current project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID"
        }
      },
      required: ["projectId"]
    }
  },
  {
    name: "run_quality_gates",
    description: "Run quality gates (tests, TypeScript check, build) on the project and return results.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID"
        },
        repoPath: {
          type: "string",
          description: "Path to the repository (optional, uses project default)"
        }
      },
      required: ["projectId"]
    }
  },
  {
    name: "submit_for_approval",
    description: "Submit completed work for human approval. Creates an approval request in Claudia.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID"
        },
        packetId: {
          type: "string",
          description: "The packet ID"
        },
        summary: {
          type: "string",
          description: "Summary of the work completed"
        },
        changesDescription: {
          type: "string",
          description: "Detailed description of changes made"
        },
        testResults: {
          type: "string",
          description: "Test results or quality gate output"
        }
      },
      required: ["projectId", "packetId", "summary"]
    }
  },
  {
    name: "get_build_plan",
    description: "Get the build plan for a project, including all phases and packets.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID"
        }
      },
      required: ["projectId"]
    }
  },
  {
    name: "create_activity_event",
    description: "Log an activity event in Claudia's activity feed.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID"
        },
        type: {
          type: "string",
          enum: ["success", "error", "pending", "running"],
          description: "Event type"
        },
        message: {
          type: "string",
          description: "Event message"
        }
      },
      required: ["type", "message"]
    }
  },
  {
    name: "report_costs",
    description: "Report API costs from Claude Code execution. Call this at the end of each session or when significant work is completed to track spending.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Unique session identifier (use conversation ID or generate one)"
        },
        projectId: {
          type: "string",
          description: "The project ID this work was for"
        },
        projectName: {
          type: "string",
          description: "The project name for display"
        },
        packetId: {
          type: "string",
          description: "The packet ID if working on a specific packet"
        },
        model: {
          type: "string",
          description: "The model used (e.g., claude-opus-4-5-20251101, claude-sonnet-4-20250514)"
        },
        provider: {
          type: "string",
          description: "API provider (e.g., Anthropic, OpenAI)"
        },
        inputTokens: {
          type: "number",
          description: "Number of input tokens used"
        },
        outputTokens: {
          type: "number",
          description: "Number of output tokens generated"
        },
        cacheReadTokens: {
          type: "number",
          description: "Number of tokens read from cache (optional)"
        },
        cacheWriteTokens: {
          type: "number",
          description: "Number of tokens written to cache (optional)"
        },
        cost: {
          type: "number",
          description: "Total cost in USD (calculate based on model pricing)"
        },
        description: {
          type: "string",
          description: "Brief description of the work done"
        }
      },
      required: ["sessionId", "model", "provider", "inputTokens", "outputTokens", "cost", "description"]
    }
  }
]

// API helper functions
async function fetchClaudia(endpoint: string, options: RequestInit = {}) {
  const url = `${CLAUDIA_API_BASE}${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  })
  return response.json()
}

// Tool implementations
async function listProjects(status?: string) {
  // Projects are stored in localStorage on client, so we need to use a different approach
  // For now, return a message about how to get projects
  return {
    message: "Projects are stored in browser localStorage. To list projects, visit https://localhost:3000/projects",
    tip: "You can also use the Claudia API to manage projects programmatically"
  }
}

async function getProject(projectId: string) {
  return { message: `Project ${projectId} - Use Claudia UI or localStorage to get project details` }
}

async function listPackets(projectId: string, status?: string) {
  // Use the new file-based packets API
  const result = await fetchClaudia(`/projects/${projectId}/packets`)
  if (result.packets && status && status !== "all") {
    return {
      ...result,
      packets: result.packets.filter((p: { status: string }) => p.status === status)
    }
  }
  return result
}

async function createPacket(
  projectId: string,
  title: string,
  description?: string,
  type: string = "feature",
  priority: string = "medium",
  tasks?: string[],
  acceptanceCriteria?: string[],
  dependencies?: string[]
) {
  // Use the new Claude Code packets API
  const result = await fetchClaudia("/claude-code/packets", {
    method: "POST",
    headers: {
      "x-claudia-project": projectId,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      projectId,
      title,
      description,
      type,
      priority,
      tasks: tasks || [],
      acceptanceCriteria: acceptanceCriteria || [],
      dependencies: dependencies || []
    })
  })
  return result
}

async function updatePacketStatus(projectId: string, packetId: string, status: string, output?: string, filesChanged?: string[]) {
  // Use the new Claude Code packets API with proper headers
  const result = await fetchClaudia(`/claude-code/packets/${packetId}`, {
    method: "PATCH",
    headers: {
      "x-claudia-project": projectId,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status,
      outputSummary: output,
      filesChanged
    })
  })
  return result
}

async function executePacket(projectId: string, packetId: string, mode: string = "auto") {
  const result = await fetchClaudia("/execute", {
    method: "POST",
    body: JSON.stringify({ projectId, packetId, mode })
  })
  return result
}

async function getQualityGates(projectId: string) {
  // Quality gates are stored in localStorage
  return {
    message: "Quality gate results are stored in browser localStorage",
    tip: "Run quality gates using run_quality_gates tool or check https://localhost:3000/quality"
  }
}

async function runQualityGates(projectId: string, repoPath?: string) {
  const result = await fetchClaudia("/claude-execute", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      repoPath,
      runQualityGatesOnly: true
    })
  })
  return result
}

async function submitForApproval(projectId: string, packetId: string, summary: string, changesDescription?: string, testResults?: string) {
  // Create an approval request
  const result = await fetchClaudia("/activity-events", {
    method: "POST",
    body: JSON.stringify({
      type: "pending",
      message: `Approval requested: ${summary}`,
      projectId,
      detail: JSON.stringify({ packetId, changesDescription, testResults })
    })
  })
  return {
    success: true,
    message: "Approval request submitted",
    approvalUrl: `https://localhost:3000/approvals?packetId=${packetId}`
  }
}

async function getBuildPlan(projectId: string) {
  const result = await fetchClaudia(`/build-plan?projectId=${projectId}`)
  return result
}

async function createActivityEvent(type: string, message: string, projectId?: string) {
  const result = await fetchClaudia("/activity-events", {
    method: "POST",
    body: JSON.stringify({ type, message, projectId })
  })
  return result
}

async function reportCosts(
  sessionId: string,
  model: string,
  provider: string,
  inputTokens: number,
  outputTokens: number,
  cost: number,
  description: string,
  projectId?: string,
  projectName?: string,
  packetId?: string,
  cacheReadTokens?: number,
  cacheWriteTokens?: number
) {
  // Read current costs
  const costsData = readCostsFile()

  // Create new cost entry
  const entry: CostEntry = {
    id: `cost-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    sessionId,
    projectId,
    projectName,
    packetId,
    model,
    provider,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    cost,
    timestamp: new Date().toISOString(),
    description
  }

  // Add to entries
  costsData.entries.push(entry)

  // Write back to file
  writeCostsFile(costsData)

  // Calculate session totals
  const sessionEntries = costsData.entries.filter(e => e.sessionId === sessionId)
  const sessionTotal = sessionEntries.reduce((sum, e) => sum + e.cost, 0)
  const sessionInputTokens = sessionEntries.reduce((sum, e) => sum + e.inputTokens, 0)
  const sessionOutputTokens = sessionEntries.reduce((sum, e) => sum + e.outputTokens, 0)

  // Calculate project totals if projectId is provided
  let projectTotal = 0
  if (projectId) {
    const projectEntries = costsData.entries.filter(e => e.projectId === projectId)
    projectTotal = projectEntries.reduce((sum, e) => sum + e.cost, 0)
  }

  return {
    success: true,
    entryId: entry.id,
    sessionTotals: {
      cost: sessionTotal,
      inputTokens: sessionInputTokens,
      outputTokens: sessionOutputTokens,
      entries: sessionEntries.length
    },
    projectTotal: projectId ? projectTotal : undefined,
    message: `Cost recorded: $${cost.toFixed(4)} for ${inputTokens} input + ${outputTokens} output tokens`
  }
}

// Main server setup
async function main() {
  const server = new Server(
    {
      name: "claudia-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }))

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      let result: unknown

      switch (name) {
        case "list_projects":
          result = await listProjects(args?.status as string)
          break
        case "get_project":
          result = await getProject(args?.projectId as string)
          break
        case "list_packets":
          result = await listPackets(args?.projectId as string, args?.status as string)
          break
        case "create_packet":
          result = await createPacket(
            args?.projectId as string,
            args?.title as string,
            args?.description as string,
            args?.type as string,
            args?.priority as string,
            args?.tasks as string[],
            args?.acceptanceCriteria as string[],
            args?.dependencies as string[]
          )
          break
        case "update_packet_status":
          result = await updatePacketStatus(
            args?.projectId as string,
            args?.packetId as string,
            args?.status as string,
            args?.output as string,
            args?.filesChanged as string[]
          )
          break
        case "execute_packet":
          result = await executePacket(
            args?.projectId as string,
            args?.packetId as string,
            args?.mode as string
          )
          break
        case "get_quality_gates":
          result = await getQualityGates(args?.projectId as string)
          break
        case "run_quality_gates":
          result = await runQualityGates(args?.projectId as string, args?.repoPath as string)
          break
        case "submit_for_approval":
          result = await submitForApproval(
            args?.projectId as string,
            args?.packetId as string,
            args?.summary as string,
            args?.changesDescription as string,
            args?.testResults as string
          )
          break
        case "get_build_plan":
          result = await getBuildPlan(args?.projectId as string)
          break
        case "create_activity_event":
          result = await createActivityEvent(
            args?.type as string,
            args?.message as string,
            args?.projectId as string
          )
          break
        case "report_costs":
          result = await reportCosts(
            args?.sessionId as string,
            args?.model as string,
            args?.provider as string,
            args?.inputTokens as number,
            args?.outputTokens as number,
            args?.cost as number,
            args?.description as string,
            args?.projectId as string,
            args?.projectName as string,
            args?.packetId as string,
            args?.cacheReadTokens as number,
            args?.cacheWriteTokens as number
          )
          break
        default:
          throw new Error(`Unknown tool: ${name}`)
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  })

  // Start server
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Claudia MCP Server started")
}

main().catch(console.error)
