/**
 * Packet Execution API
 *
 * POST /api/execute
 * Execute a work packet and generate code
 */

import { NextRequest, NextResponse } from "next/server"

// Note: These are server-side reimplementations since localStorage is client-only
// In production, these would use a proper database

interface WorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  tasks: Array<{
    id: string
    description: string
    completed: boolean
    order: number
  }>
  suggestedTaskType: string
  assignedModel?: string
  blockedBy: string[]
  blocks: string[]
  estimatedTokens: number
  estimatedCost?: number
  acceptanceCriteria: string[]
}

interface Project {
  id: string
  name: string
  description: string
  repos: Array<{
    provider: "gitlab" | "github"
    id: number
    name: string
    path: string
    url: string
  }>
}

interface ExecutionRequest {
  packetId: string
  projectId: string
  packet?: WorkPacket
  project?: Project
  options?: {
    preferredServer?: string
    temperature?: number
    maxTokens?: number
    createBranch?: boolean
    branchName?: string
  }
}

interface ExecutionLog {
  timestamp: string
  level: "info" | "warn" | "error" | "success"
  message: string
  data?: unknown
}

interface FileChange {
  path: string
  content: string
  action: "create" | "update" | "delete"
}

interface ExecutionResult {
  success: boolean
  packetId: string
  files: FileChange[]
  logs: ExecutionLog[]
  commitUrl?: string
  branch?: string
  errors: string[]
  duration: number
}

const GITLAB_URL = process.env.NEXT_PUBLIC_GITLAB_URL || "https://bill-dev-linux-1"

// Get servers from environment
function getServers() {
  const servers = []
  if (process.env.NEXT_PUBLIC_LMSTUDIO_BEAST) {
    servers.push({
      name: "Beast",
      url: process.env.NEXT_PUBLIC_LMSTUDIO_BEAST,
      type: "lmstudio" as const
    })
  }
  if (process.env.NEXT_PUBLIC_LMSTUDIO_BEDROOM) {
    servers.push({
      name: "Bedroom",
      url: process.env.NEXT_PUBLIC_LMSTUDIO_BEDROOM,
      type: "lmstudio" as const
    })
  }
  return servers
}

// Check server status
async function checkServer(server: { name: string; url: string; type: string }) {
  try {
    const response = await fetch(`${server.url}/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) return null

    const data = await response.json()
    return {
      ...server,
      status: "online",
      currentModel: data.data?.[0]?.id
    }
  } catch {
    return null
  }
}

// Generate with LLM
async function generateWithLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: { preferredServer?: string; temperature?: number; max_tokens?: number }
) {
  const servers = getServers()

  for (const server of servers) {
    const status = await checkServer(server)
    if (!status) continue

    try {
      const response = await fetch(`${server.url}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: options?.temperature ?? 0.3,
          max_tokens: options?.max_tokens ?? 8192,
          stream: false
        }),
        signal: AbortSignal.timeout(120000) // 2 min timeout
      })

      if (!response.ok) continue

      const data = await response.json()
      return {
        content: data.choices?.[0]?.message?.content || "",
        server: server.name,
        model: status.currentModel
      }
    } catch {
      continue
    }
  }

  return { content: "", error: "No LLM servers available" }
}

// Parse code output
function parseCodeOutput(output: string): { files: FileChange[]; errors: string[] } {
  const files: FileChange[] = []
  const errors: string[] = []

  const filePattern = /===\s*FILE:\s*(.+?)\s*===\s*\n```\w*\n([\s\S]*?)```/g

  let match
  while ((match = filePattern.exec(output)) !== null) {
    const path = match[1].trim()
    let content = match[2]

    if (content.endsWith("\n")) {
      content = content.slice(0, -1)
    }

    if (!path || path.includes("..")) {
      errors.push(`Invalid path: ${path}`)
      continue
    }

    files.push({ path, content, action: "create" })
  }

  return { files, errors }
}

// Get GitLab file tree
async function getFileTree(repoId: number, token: string) {
  try {
    const response = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/tree?recursive=true&per_page=100`,
      { headers: { "PRIVATE-TOKEN": token } }
    )
    if (!response.ok) return []
    return response.json()
  } catch {
    return []
  }
}

// Get file content
async function getFileContent(repoId: number, filePath: string, token: string) {
  try {
    const encodedPath = encodeURIComponent(filePath)
    const response = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/files/${encodedPath}/raw?ref=main`,
      { headers: { "PRIVATE-TOKEN": token } }
    )
    if (!response.ok) return null
    return response.text()
  } catch {
    return null
  }
}

// Check if file exists
async function fileExists(repoId: number, filePath: string, branch: string, token: string) {
  try {
    const encodedPath = encodeURIComponent(filePath)
    const response = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/files/${encodedPath}?ref=${branch}`,
      { headers: { "PRIVATE-TOKEN": token } }
    )
    return response.ok
  } catch {
    return false
  }
}

// Ensure branch exists
async function ensureBranch(repoId: number, branchName: string, token: string) {
  try {
    // Check if exists
    const checkResponse = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/branches/${encodeURIComponent(branchName)}`,
      { headers: { "PRIVATE-TOKEN": token } }
    )
    if (checkResponse.ok) return true

    // Create branch
    const createResponse = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/branches`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PRIVATE-TOKEN": token
        },
        body: JSON.stringify({ branch: branchName, ref: "main" })
      }
    )
    return createResponse.ok
  } catch {
    return false
  }
}

// Create commit
async function createCommit(
  repoId: number,
  branch: string,
  message: string,
  actions: Array<{ action: string; file_path: string; content: string }>,
  token: string
) {
  try {
    const response = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/commits`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PRIVATE-TOKEN": token
        },
        body: JSON.stringify({ branch, commit_message: message, actions })
      }
    )
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return { success: false, error: error.message || `HTTP ${response.status}` }
    }
    const data = await response.json()
    return { success: true, commitId: data.id, webUrl: data.web_url }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// Detect tech stack from package.json
function detectTechStack(packageJson: string | null): string[] {
  if (!packageJson) return ["Unknown"]
  try {
    const pkg = JSON.parse(packageJson)
    const stack: string[] = []
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }

    if (allDeps.next) stack.push("Next.js")
    else if (allDeps.react) stack.push("React")
    if (allDeps.typescript) stack.push("TypeScript")
    if (allDeps.tailwindcss) stack.push("Tailwind CSS")
    if (allDeps.prisma) stack.push("Prisma")
    if (allDeps.express) stack.push("Express")

    return stack.length > 0 ? stack : ["Node.js"]
  } catch {
    return ["Unknown"]
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const logs: ExecutionLog[] = []
  const errors: string[] = []

  const log = (level: ExecutionLog["level"], message: string, data?: unknown) => {
    logs.push({ timestamp: new Date().toISOString(), level, message, data })
    console.log(`[${level}] ${message}`, data || "")
  }

  try {
    const body: ExecutionRequest = await request.json()
    const { packetId, projectId, options } = body

    log("info", `Starting execution for packet ${packetId} in project ${projectId}`)

    // Get GitLab token from header (passed from client)
    const gitlabToken = request.headers.get("X-GitLab-Token")
    if (!gitlabToken) {
      return NextResponse.json(
        { success: false, error: "GitLab token required" },
        { status: 401 }
      )
    }

    // Get packet from request body (passed from client localStorage)
    const packet: WorkPacket | undefined = body.packet as WorkPacket | undefined
    const project: Project | undefined = body.project as Project | undefined

    if (!packet) {
      return NextResponse.json(
        { success: false, error: "Packet data required" },
        { status: 400 }
      )
    }

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project data required" },
        { status: 400 }
      )
    }

    if (project.repos.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project has no linked repositories" },
        { status: 400 }
      )
    }

    const repo = project.repos[0]
    log("info", `Using repository: ${repo.name} (${repo.id})`)

    // Get repo context
    log("info", "Fetching repository context...")
    const tree = await getFileTree(repo.id, gitlabToken)
    const packageJsonContent = await getFileContent(repo.id, "package.json", gitlabToken)
    const techStack = detectTechStack(packageJsonContent)
    log("success", `Tech stack: ${techStack.join(", ")}`)

    // Build file list summary
    const fileList = tree
      .filter((t: { type: string }) => t.type === "blob")
      .map((t: { path: string }) => t.path)
      .slice(0, 50)
      .join("\n")

    // Build prompt
    const systemPrompt = `You are a senior developer implementing features.
Output ONLY valid code. Use this format for each file:

=== FILE: path/to/file.ts ===
\`\`\`typescript
// file contents here
\`\`\`

Rules:
- Output complete, working code
- Use proper imports and exports
- Follow existing code patterns
- Do not explain - just write code
- Create all necessary files`

    const tasksSection = packet.tasks
      .map((t, i) => `${i + 1}. ${t.description}`)
      .join("\n")

    const userPrompt = `PROJECT: ${project.name}
TECH STACK: ${techStack.join(", ")}

FEATURE: ${packet.title}
${packet.description}

TASKS TO COMPLETE:
${tasksSection}

ACCEPTANCE CRITERIA:
${packet.acceptanceCriteria.map(c => `- ${c}`).join("\n")}

PROJECT FILES:
${fileList || "Empty repository"}

Generate all the code needed to complete this feature.`

    // Generate code with LLM
    log("info", "Generating code with LLM...")
    const result = await generateWithLLM(systemPrompt, userPrompt, {
      preferredServer: options?.preferredServer,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 8192
    })

    if (result.error) {
      log("error", `LLM error: ${result.error}`)
      return NextResponse.json({
        success: false,
        packetId,
        files: [],
        logs,
        errors: [result.error],
        duration: Date.now() - startTime
      })
    }

    log("success", `Generated code using ${result.server}/${result.model}`)

    // Parse output
    const parsed = parseCodeOutput(result.content)
    log("info", `Parsed ${parsed.files.length} files`)

    if (parsed.files.length === 0) {
      log("warn", "No files parsed from LLM output")
      errors.push("No files generated")

      // Return the raw output for debugging
      return NextResponse.json({
        success: false,
        packetId,
        files: [],
        logs,
        errors,
        rawOutput: result.content,
        duration: Date.now() - startTime
      })
    }

    // Apply to GitLab
    const branchName = options?.branchName || `claudia/${packet.id}`
    log("info", `Creating branch: ${branchName}`)

    const branchCreated = await ensureBranch(repo.id, branchName, gitlabToken)
    if (!branchCreated) {
      log("error", "Failed to create branch")
      errors.push("Failed to create branch")
    }

    // Build commit actions
    const actions = []
    for (const file of parsed.files) {
      const exists = await fileExists(repo.id, file.path, branchName, gitlabToken)
      actions.push({
        action: exists ? "update" : "create",
        file_path: file.path,
        content: file.content
      })
    }

    // Create commit
    log("info", `Creating commit with ${actions.length} files...`)
    const commitResult = await createCommit(
      repo.id,
      branchName,
      `feat: ${packet.title}\n\nGenerated by Claudia`,
      actions,
      gitlabToken
    )

    if (!commitResult.success) {
      log("error", `Commit failed: ${commitResult.error}`)
      errors.push(`Commit failed: ${commitResult.error}`)
    } else {
      log("success", `Commit created: ${commitResult.webUrl}`)
    }

    const duration = Date.now() - startTime
    const success = parsed.files.length > 0 && commitResult.success

    log(success ? "success" : "error", `Execution ${success ? "completed" : "failed"} in ${duration}ms`)

    return NextResponse.json({
      success,
      packetId,
      files: parsed.files,
      logs,
      commitUrl: commitResult.webUrl,
      branch: branchName,
      errors,
      duration
    } satisfies ExecutionResult)

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    log("error", `Execution failed: ${message}`)

    return NextResponse.json({
      success: false,
      packetId: "",
      files: [],
      logs,
      errors: [message],
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}

export async function GET() {
  // Return server status
  const servers = getServers()
  const statuses = await Promise.all(servers.map(checkServer))

  return NextResponse.json({
    servers: statuses.filter(Boolean),
    available: statuses.some(s => s !== null)
  })
}
