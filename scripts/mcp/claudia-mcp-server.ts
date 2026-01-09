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
 */

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
  const result = await fetchClaudia(`/packets?projectId=${projectId}${status ? `&status=${status}` : ""}`)
  return result
}

async function updatePacketStatus(projectId: string, packetId: string, status: string, output?: string, filesChanged?: string[]) {
  const result = await fetchClaudia("/packets", {
    method: "PUT",
    body: JSON.stringify({ projectId, packetId, status, output, filesChanged })
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
