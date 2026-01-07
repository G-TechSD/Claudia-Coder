/**
 * Claudia Execution API
 * Executes work packets using:
 * - LOCAL MODE (Free): LM Studio - works completely offline, no subscriptions
 * - TURBO MODE (Paid): Claude Code CLI - higher quality but requires API key
 *
 * LOCAL MODE is the default and works in the desert with no internet.
 * TURBO MODE is optional premium for users who want faster/better refinement.
 */

import { NextRequest, NextResponse } from "next/server"
import { exec, spawn } from "child_process"
import { promisify } from "util"
import * as fs from "fs/promises"
import * as path from "path"
import { generateWithLocalLLM, getAvailableServer } from "@/lib/llm/local-llm"

const execAsync = promisify(exec)

// Timeout for Claude Code execution (10 minutes)
const EXECUTION_TIMEOUT_MS = 10 * 60 * 1000

// SSH configuration for remote execution
const SSH_HOST = process.env.CLAUDE_CODE_HOST || "172.18.22.114"
const SSH_USER = process.env.CLAUDE_CODE_USER || "johnny-test"
const SSH_KEY_PATH = process.env.CLAUDE_CODE_SSH_KEY || "~/.ssh/id_rsa"

// Execution mode: "local" (LM Studio - free), "turbo" (Claude Code - paid)
type ExecutionMode = "local" | "turbo" | "auto"

interface ExecutionRequest {
  projectId: string
  projectName: string
  repoPath: string
  packet: {
    id: string
    title: string
    description: string
    type: string
    priority: string
    tasks: Array<{ id: string; description: string; completed: boolean }>
    acceptanceCriteria: string[]
  }
  options?: {
    maxIterations?: number
    runTests?: boolean
    createCommit?: boolean
    createPR?: boolean
    useRemote?: boolean // Run on remote VM vs local Claude CLI
    mode?: ExecutionMode // "local" = LM Studio (free), "turbo" = Claude Code (paid)
    preferredServer?: string // Which LM Studio server to use (Beast/Bedroom)
  }
}

interface ExecutionEvent {
  type: "start" | "iteration" | "file_change" | "test_run" | "thinking" | "complete" | "error"
  timestamp: string
  message: string
  detail?: string
  iteration?: number
  progress?: number
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const events: ExecutionEvent[] = []

  const emit = (type: ExecutionEvent["type"], message: string, detail?: string, extra?: Partial<ExecutionEvent>) => {
    events.push({
      type,
      timestamp: new Date().toISOString(),
      message,
      detail,
      ...extra
    })
  }

  try {
    const body: ExecutionRequest = await request.json()
    const { projectName, repoPath, packet, options = {} } = body
    const mode = options.mode || "auto"

    emit("start", `Starting execution: ${packet.title}`, `Project: ${projectName}`, { progress: 0 })

    // Build the prompt
    const prompt = buildClaudePrompt(packet)

    let result: { success: boolean; output: string; filesChanged: string[]; mode: string }

    // Determine execution mode
    if (mode === "local") {
      // Force LM Studio (free, offline)
      emit("thinking", "Using Local Mode (LM Studio)...", "Free, works offline")
      result = await executeWithLMStudio(prompt, repoPath, packet, options, emit)
    } else if (mode === "turbo") {
      // Force Claude Code (paid, higher quality)
      emit("thinking", "Using Turbo Mode (Claude Code)...", "Premium, cloud-powered")
      const claudeResult = await executeWithClaudeCode(prompt, repoPath, options, emit)
      result = { ...claudeResult, mode: "turbo" }
    } else {
      // Auto mode: Try LM Studio first, fall back to Claude Code
      const lmStudioAvailable = await getAvailableServer()

      if (lmStudioAvailable) {
        emit("thinking", `Using Local Mode (${lmStudioAvailable.name})...`, "Free, works offline")
        result = await executeWithLMStudio(prompt, repoPath, packet, options, emit)
      } else {
        // Fall back to Claude Code if no LM Studio available
        const claudeAvailable = await checkLocalClaudeAvailable()
        if (claudeAvailable) {
          emit("thinking", "No LM Studio available, using Claude Code...", "Falling back to premium mode")
          const claudeResult = await executeWithClaudeCode(prompt, repoPath, options, emit)
          result = { ...claudeResult, mode: "turbo" }
        } else {
          return NextResponse.json({
            success: false,
            events,
            error: "No execution backend available. Start LM Studio or install Claude Code CLI.",
            duration: Date.now() - startTime
          })
        }
      }
    }

    if (!result.success) {
      emit("error", "Execution failed", result.output)
      return NextResponse.json({
        success: false,
        events,
        error: result.output,
        duration: Date.now() - startTime,
        mode: result.mode
      })
    }

    emit("complete", `Completed: ${packet.title}`, `${result.filesChanged.length} files modified (${result.mode} mode)`, { progress: 100 })

    return NextResponse.json({
      success: true,
      packetId: packet.id,
      events,
      filesChanged: result.filesChanged,
      output: result.output,
      duration: Date.now() - startTime,
      mode: result.mode
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    emit("error", "Execution failed", message)

    return NextResponse.json({
      success: false,
      events,
      error: message,
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}

/**
 * Execute with Claude Code CLI (Turbo Mode - paid)
 * Wraps the local/remote Claude CLI execution
 */
async function executeWithClaudeCode(
  prompt: string,
  repoPath: string,
  options: ExecutionRequest["options"],
  _emit: (type: ExecutionEvent["type"], message: string, detail?: string, extra?: Partial<ExecutionEvent>) => void
): Promise<{ success: boolean; output: string; filesChanged: string[] }> {
  // Determine execution mode - prefer local when available
  const localAvailable = await checkLocalClaudeAvailable()
  const useLocal = localAvailable && (options?.useRemote === false || options?.useRemote === undefined)

  if (useLocal) {
    return executeLocally(prompt, repoPath, options)
  } else {
    return executeRemotely(prompt, repoPath, options)
  }
}

/**
 * Execute with LM Studio (Local Mode - free, works offline)
 * Uses local LLM to generate code changes and applies them directly
 */
async function executeWithLMStudio(
  _prompt: string,
  repoPath: string,
  packet: ExecutionRequest["packet"],
  options: ExecutionRequest["options"],
  emit: (type: ExecutionEvent["type"], message: string, detail?: string, extra?: Partial<ExecutionEvent>) => void
): Promise<{ success: boolean; output: string; filesChanged: string[]; mode: string }> {
  const filesChanged: string[] = []
  const maxIterations = options?.maxIterations || 5
  let lastOutput = ""

  try {
    // Read existing files in the project to understand context
    const projectContext = await gatherProjectContext(repoPath)

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      emit("iteration", `Iteration ${iteration}/${maxIterations}`, "Analyzing and generating code...", {
        iteration,
        progress: Math.round((iteration / maxIterations) * 80)
      })

      // Build the LM Studio prompt with structured output format
      const lmPrompt = buildLMStudioPrompt(packet, projectContext, iteration, lastOutput)

      // Generate with local LLM
      const response = await generateWithLocalLLM(
        LMSTUDIO_SYSTEM_PROMPT,
        lmPrompt,
        {
          temperature: 0.3, // Lower for more consistent code
          max_tokens: 8192, // Large for full file contents
          preferredServer: options?.preferredServer
        }
      )

      if (response.error) {
        emit("error", `LM Studio error (iter ${iteration})`, response.error)
        continue
      }

      emit("thinking", `Processing response from ${response.server}...`, response.model)

      // Parse the response for file operations
      const operations = parseFileOperations(response.content)

      if (operations.length === 0) {
        emit("thinking", `No file changes in iteration ${iteration}`, "Checking if complete...")
        // Check if the LLM thinks we're done
        if (response.content.toLowerCase().includes("complete") ||
            response.content.toLowerCase().includes("all tasks done") ||
            response.content.toLowerCase().includes("no further changes")) {
          emit("complete", "LM Studio indicates task complete", `After ${iteration} iterations`)
          break
        }
        continue
      }

      // Apply file operations
      for (const op of operations) {
        try {
          const fullPath = path.isAbsolute(op.path) ? op.path : path.join(repoPath, op.path)

          if (op.operation === "create" || op.operation === "update") {
            // Ensure directory exists
            await fs.mkdir(path.dirname(fullPath), { recursive: true })
            await fs.writeFile(fullPath, op.content, "utf-8")
            filesChanged.push(op.path)
            emit("file_change", `${op.operation === "create" ? "Created" : "Updated"}: ${op.path}`, undefined, {
              files: [op.path]
            })
          } else if (op.operation === "delete") {
            await fs.unlink(fullPath).catch(() => {})
            emit("file_change", `Deleted: ${op.path}`)
          }
        } catch (err) {
          emit("error", `Failed to ${op.operation} ${op.path}`, err instanceof Error ? err.message : "Unknown error")
        }
      }

      lastOutput = response.content

      // Run tests if requested
      if (options?.runTests && iteration === maxIterations) {
        emit("test_run", "Running tests...", "Checking implementation")
        const testResult = await runProjectTests(repoPath)
        if (!testResult.success) {
          emit("error", "Tests failed", testResult.output)
        }
      }
    }

    // Create commit if requested
    if (options?.createCommit && filesChanged.length > 0) {
      emit("thinking", "Creating commit...", `${filesChanged.length} files changed`)
      await createGitCommit(repoPath, packet.title, filesChanged)
    }

    return {
      success: true,
      output: `Completed with LM Studio. ${filesChanged.length} files modified.`,
      filesChanged,
      mode: "local"
    }

  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : "LM Studio execution failed",
      filesChanged,
      mode: "local"
    }
  }
}

// System prompt for LM Studio code generation
const LMSTUDIO_SYSTEM_PROMPT = `You are Claudia, an expert AI developer. You write PRODUCTION-QUALITY code.

When given a task, respond with file operations in this EXACT format:

===FILE: path/to/file.ext===
OPERATION: create|update|delete
---CONTENT---
[Full file content here]
---END---

Rules:
1. Include the COMPLETE file content, not snippets
2. Use relative paths from project root
3. One ===FILE=== block per file
4. Write clean, well-documented code
5. Follow existing project patterns
6. Handle errors and edge cases
7. Make it accessible (WCAG 2.1 AA)
8. Make it responsive and polished

If the task is complete and no more changes needed, say "COMPLETE - all tasks done"
`

/**
 * Build the prompt for LM Studio execution
 */
function buildLMStudioPrompt(
  packet: ExecutionRequest["packet"],
  projectContext: string,
  iteration: number,
  previousOutput: string
): string {
  const taskList = packet.tasks.map((t, i) => `${i + 1}. ${t.description}`).join("\n")
  const criteria = packet.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")

  let prompt = `# Task: ${packet.title}

## Description
${packet.description}

## Tasks to Complete
${taskList}

## Acceptance Criteria
${criteria}

## Current Project Structure
${projectContext}
`

  if (iteration > 1 && previousOutput) {
    prompt += `

## Previous Iteration Output
${previousOutput.substring(0, 2000)}

Continue from where you left off. What files need to be created or updated next?
`
  } else {
    prompt += `

Start implementing. Output file operations using the ===FILE=== format.
`
  }

  return prompt
}

/**
 * Gather project context (file tree, key files) for LM Studio
 */
async function gatherProjectContext(repoPath: string): Promise<string> {
  try {
    // Get directory listing
    const files = await listFilesRecursive(repoPath, 3, 50) // Max depth 3, max 50 files
    const fileTree = files.map(f => `  ${f}`).join("\n")

    // Try to read key configuration files
    let configContent = ""
    const keyFiles = ["package.json", "tsconfig.json", "pubspec.yaml", "Cargo.toml", "go.mod", "requirements.txt"]

    for (const keyFile of keyFiles) {
      try {
        const content = await fs.readFile(path.join(repoPath, keyFile), "utf-8")
        configContent += `\n### ${keyFile}\n\`\`\`\n${content.substring(0, 1000)}\n\`\`\`\n`
        break // Only include first found
      } catch {
        // File doesn't exist, continue
      }
    }

    return `File tree:\n${fileTree}\n${configContent}`
  } catch {
    return "Unable to read project structure"
  }
}

/**
 * List files recursively (with depth and count limits)
 */
async function listFilesRecursive(
  dir: string,
  maxDepth: number,
  maxFiles: number,
  currentDepth: number = 0,
  files: string[] = []
): Promise<string[]> {
  if (currentDepth > maxDepth || files.length >= maxFiles) {
    return files
  }

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (files.length >= maxFiles) break

      // Skip common non-essential directories
      if (entry.isDirectory() && ["node_modules", ".git", "dist", "build", ".dart_tool", "__pycache__"].includes(entry.name)) {
        continue
      }

      const relativePath = path.relative(process.cwd(), path.join(dir, entry.name))

      if (entry.isFile()) {
        files.push(entry.name)
      } else if (entry.isDirectory()) {
        files.push(`${entry.name}/`)
        await listFilesRecursive(path.join(dir, entry.name), maxDepth, maxFiles, currentDepth + 1, files)
      }
    }
  } catch {
    // Ignore errors
  }

  return files
}

/**
 * Parse file operations from LM Studio response
 */
interface FileOperation {
  path: string
  operation: "create" | "update" | "delete"
  content: string
}

/**
 * Clean content by removing markdown artifacts that LM models often include
 */
function cleanFileContent(content: string): string {
  let cleaned = content

  // Remove leading/trailing markdown code fences
  cleaned = cleaned.replace(/^```[\w]*\n?/, "")
  cleaned = cleaned.replace(/\n?```\s*$/, "")

  // Remove any trailing file markers that leaked in
  cleaned = cleaned.replace(/\n===FILE:[\s\S]*$/, "")

  // Remove trailing --- markers (used as file delimiters)
  cleaned = cleaned.replace(/\n?---+\s*$/, "")

  // Remove orphaned CONTENT markers
  cleaned = cleaned.replace(/\n?---CONTENT---\s*$/, "")
  cleaned = cleaned.replace(/\n?---END---\s*$/, "")

  // Trim whitespace but preserve internal formatting
  cleaned = cleaned.trimEnd()

  return cleaned
}

function parseFileOperations(response: string): FileOperation[] {
  const operations: FileOperation[] = []

  // Pattern: ===FILE: path/to/file===\nOPERATION: create|update|delete\n---CONTENT---\n...\n---END---
  // Make ---END--- optional since many LM models forget it
  const filePattern = /===FILE:\s*(.+?)===\s*\nOPERATION:\s*(create|update|delete)\s*\n---CONTENT---\n([\s\S]*?)(?:---END---|(?=\n===FILE:)|$)/gi

  let match
  while ((match = filePattern.exec(response)) !== null) {
    operations.push({
      path: match[1].trim(),
      operation: match[2].toLowerCase() as "create" | "update" | "delete",
      content: cleanFileContent(match[3])
    })
  }

  // Also try alternative format: ```filepath\n...content...\n```
  if (operations.length === 0) {
    const altPattern = /```(\S+)\n([\s\S]*?)```/g
    while ((match = altPattern.exec(response)) !== null) {
      const filepath = match[1]
      // Only treat as file if it looks like a path
      if (filepath.includes("/") || filepath.includes(".")) {
        operations.push({
          path: filepath,
          operation: "create",
          content: cleanFileContent(match[2])
        })
      }
    }
  }

  return operations
}

/**
 * Run project tests
 */
async function runProjectTests(repoPath: string): Promise<{ success: boolean; output: string }> {
  try {
    // Detect project type and run appropriate tests
    const packageJson = path.join(repoPath, "package.json")
    const pubspec = path.join(repoPath, "pubspec.yaml")

    let testCmd = ""

    try {
      await fs.access(packageJson)
      testCmd = "npm test"
    } catch {
      try {
        await fs.access(pubspec)
        testCmd = "flutter test"
      } catch {
        return { success: true, output: "No test framework detected" }
      }
    }

    const { stdout, stderr } = await execAsync(testCmd, {
      cwd: repoPath,
      timeout: 60000
    })

    return { success: true, output: stdout + stderr }
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : "Test execution failed"
    }
  }
}

/**
 * Create a git commit for the changes
 */
async function createGitCommit(repoPath: string, message: string, files: string[]): Promise<void> {
  try {
    // Check if git repo
    await execAsync("git status", { cwd: repoPath })

    // Add files
    for (const file of files) {
      await execAsync(`git add "${file}"`, { cwd: repoPath }).catch(() => {})
    }

    // Commit
    const commitMsg = `${message}\n\nGenerated by Claudia (Local Mode)`
    await execAsync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: repoPath })
  } catch {
    // Git operations failed, continue without commit
  }
}

/**
 * Build prompt for Claude Code execution
 */
function buildClaudePrompt(packet: ExecutionRequest["packet"]): string {
  const taskList = packet.tasks.map((t, i) => `${i + 1}. ${t.description}`).join("\n")
  const criteria = packet.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")

  return `# Task: ${packet.title}

## Description
${packet.description}

## Tasks to Complete
${taskList}

## Acceptance Criteria
${criteria}

## QUALITY STANDARDS (Non-Negotiable)

You are Claudia - you build PRODUCTION-QUALITY software. Every deliverable must meet these standards:

### Code Quality
- Clean, readable, self-documenting code
- Proper error handling and edge cases
- No hardcoded values - use constants and configuration
- DRY principles - extract common patterns
- TypeScript strict mode compatible (if applicable)

### UI/UX Excellence
- Modern, polished visual design
- Smooth animations and transitions
- Responsive across all screen sizes
- Accessible (WCAG 2.1 AA minimum)
- Intuitive user interactions

### Architecture
- Clear separation of concerns
- Modular, reusable components
- Proper file organization
- Scalable patterns that grow with the app

### Testing & Reliability
- Comprehensive test coverage
- Handle loading, error, and empty states
- Graceful degradation when things fail
- Performance optimized

### Documentation
- Clear README with setup instructions
- Inline comments for complex logic only
- Type definitions that serve as documentation

## Instructions
1. Read existing code to understand patterns
2. Implement with the quality standards above
3. Write tests to verify the implementation
4. Iterate until the code is polished, not just working
5. The goal is EXCELLENCE, not just completion

Work autonomously. Do not stop until the deliverable is production-ready.
If something feels hacky, refactor it. If the UI feels rough, polish it.
You represent Claudia - make her proud.`
}

/**
 * Execute on remote VM via SSH
 */
async function executeRemotely(
  prompt: string,
  repoPath: string,
  options: ExecutionRequest["options"]
): Promise<{ success: boolean; output: string; filesChanged: string[] }> {
  // Escape prompt for shell - handle single quotes and special characters
  const escapedPrompt = escapeForShell(prompt)

  // Build Claude Code command with print mode for non-interactive execution
  const maxTurns = options?.maxIterations || 10
  const claudeCmd = `claude --print --dangerously-skip-permissions --max-turns ${maxTurns}`

  // SSH command to run on remote
  // Use heredoc style to avoid shell escaping issues with complex prompts
  const sshCmd = `ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SSH_USER}@${SSH_HOST} "cd ${repoPath} && echo '${escapedPrompt}' | ${claudeCmd}"`

  console.log("[executeRemotely] Starting SSH execution to", SSH_HOST)
  console.log("[executeRemotely] Repo path:", repoPath)
  console.log("[executeRemotely] Max turns:", maxTurns)

  try {
    const { stdout, stderr } = await execAsync(sshCmd, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
      timeout: EXECUTION_TIMEOUT_MS,
      env: {
        ...process.env,
        // Ensure SSH key path is expanded
        HOME: process.env.HOME
      }
    })

    // Combine stdout and stderr for complete output
    const fullOutput = stdout + (stderr ? `\n[stderr]: ${stderr}` : "")

    // Parse files changed from Claude Code output
    const filesChanged = parseFilesChanged(fullOutput)

    console.log("[executeRemotely] Execution completed successfully")
    console.log("[executeRemotely] Files changed:", filesChanged.length)

    return {
      success: true,
      output: fullOutput,
      filesChanged
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "SSH execution failed"
    const errorOutput = (error as { stdout?: string; stderr?: string }).stdout || ""
    const errorStderr = (error as { stderr?: string }).stderr || ""

    console.error("[executeRemotely] Execution failed:", errorMessage)

    // Check for specific error types
    if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timeout")) {
      return {
        success: false,
        output: `Execution timed out after ${EXECUTION_TIMEOUT_MS / 60000} minutes.\n\nPartial output:\n${errorOutput}\n${errorStderr}`,
        filesChanged: parseFilesChanged(errorOutput)
      }
    }

    if (errorMessage.includes("Permission denied") || errorMessage.includes("publickey")) {
      return {
        success: false,
        output: `SSH authentication failed. Check that the SSH key at ${SSH_KEY_PATH} is valid and has access to ${SSH_USER}@${SSH_HOST}`,
        filesChanged: []
      }
    }

    if (errorMessage.includes("Connection refused") || errorMessage.includes("No route to host")) {
      return {
        success: false,
        output: `Cannot connect to remote host ${SSH_HOST}. Ensure the VM is running and accessible.`,
        filesChanged: []
      }
    }

    return {
      success: false,
      output: `Execution failed: ${errorMessage}\n\nOutput:\n${errorOutput}\n${errorStderr}`,
      filesChanged: parseFilesChanged(errorOutput)
    }
  }
}

/**
 * Execute locally (when Claude Code is installed on this machine)
 */
async function executeLocally(
  prompt: string,
  repoPath: string,
  options: ExecutionRequest["options"]
): Promise<{ success: boolean; output: string; filesChanged: string[] }> {
  const maxTurns = options?.maxIterations || 10

  console.log("[executeLocally] Starting local execution")
  console.log("[executeLocally] Repo path:", repoPath)
  console.log("[executeLocally] Max turns:", maxTurns)

  return new Promise((resolve) => {
    const args = [
      "--print",
      "--dangerously-skip-permissions",
      "--max-turns", String(maxTurns)
    ]

    console.log("[executeLocally] Spawning: claude", args.join(" "))

    const child = spawn("claude", args, {
      cwd: repoPath,
      env: {
        ...process.env,
        // Ensure Claude can find necessary tools
        PATH: process.env.PATH
      },
      stdio: ["pipe", "pipe", "pipe"]
    })

    let stdout = ""
    let stderr = ""

    // Write the prompt to stdin
    child.stdin.write(prompt)
    child.stdin.end()

    // Collect stdout
    child.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString()
      stdout += chunk
      // Log progress for debugging
      if (chunk.includes("Thinking") || chunk.includes("Editing") || chunk.includes("Creating")) {
        console.log("[executeLocally] Progress:", chunk.substring(0, 100))
      }
    })

    // Collect stderr
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString()
    })

    // Handle timeout
    const timeoutId = setTimeout(() => {
      console.error("[executeLocally] Execution timed out, killing process")
      child.kill("SIGTERM")
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL")
        }
      }, 5000)
    }, EXECUTION_TIMEOUT_MS)

    // Handle completion
    child.on("close", (code) => {
      clearTimeout(timeoutId)
      const fullOutput = stdout + (stderr ? `\n[stderr]: ${stderr}` : "")
      const filesChanged = parseFilesChanged(fullOutput)

      console.log("[executeLocally] Process exited with code:", code)
      console.log("[executeLocally] Files changed:", filesChanged.length)

      if (code === 0) {
        resolve({
          success: true,
          output: fullOutput,
          filesChanged
        })
      } else {
        resolve({
          success: false,
          output: `Claude Code exited with code ${code}\n\n${fullOutput}`,
          filesChanged
        })
      }
    })

    // Handle spawn errors
    child.on("error", (error) => {
      clearTimeout(timeoutId)
      console.error("[executeLocally] Spawn error:", error.message)

      if (error.message.includes("ENOENT")) {
        resolve({
          success: false,
          output: "Claude Code CLI not found. Ensure 'claude' is installed and in PATH.",
          filesChanged: []
        })
      } else {
        resolve({
          success: false,
          output: `Failed to start Claude Code: ${error.message}`,
          filesChanged: []
        })
      }
    })
  })
}

/**
 * Escape a string for safe use in shell commands (single-quoted context)
 */
function escapeForShell(str: string): string {
  // For single-quoted strings, we need to:
  // 1. Replace single quotes with: '\'' (end quote, escaped quote, start quote)
  // 2. Handle other special characters
  return str
    .replace(/'/g, "'\\''")
    .replace(/\\/g, "\\\\")
    .replace(/\$/g, "\\$")
    .replace(/`/g, "\\`")
    .replace(/!/g, "\\!")
}

/**
 * Parse Claude Code output to extract list of files changed
 * Claude Code typically outputs file operations like:
 * - "Created file: /path/to/file"
 * - "Modified: /path/to/file"
 * - "Editing /path/to/file"
 * - Also look for git status indicators
 */
function parseFilesChanged(output: string): string[] {
  const filesSet = new Set<string>()

  // Pattern 1: "Created file: /path" or "Created: /path"
  const createdPattern = /(?:Created|Creating)\s+(?:file:?\s*)?([\/\w\-_.]+\.\w+)/gi
  let match
  while ((match = createdPattern.exec(output)) !== null) {
    if (match[1] && !match[1].includes("...")) {
      filesSet.add(match[1])
    }
  }

  // Pattern 2: "Modified: /path" or "Edited: /path"
  const modifiedPattern = /(?:Modified|Edited|Editing|Updated|Updating)\s*:?\s*([\/\w\-_.]+\.\w+)/gi
  while ((match = modifiedPattern.exec(output)) !== null) {
    if (match[1] && !match[1].includes("...")) {
      filesSet.add(match[1])
    }
  }

  // Pattern 3: Look for file paths in Write/Edit tool usage
  const toolPattern = /(?:Write|Edit)\s+tool.*?(?:file_path|path)\s*[=:]\s*["']?([\/\w\-_.]+\.\w+)["']?/gi
  while ((match = toolPattern.exec(output)) !== null) {
    if (match[1]) {
      filesSet.add(match[1])
    }
  }

  // Pattern 4: Git diff output (shows changed files)
  const gitDiffPattern = /^(?:\+\+\+|---)\s+[ab]?\/(.+)$/gm
  while ((match = gitDiffPattern.exec(output)) !== null) {
    if (match[1] && match[1] !== "/dev/null") {
      filesSet.add(match[1])
    }
  }

  // Pattern 5: Lines starting with file path indicators
  const filePathPattern = /^\s*(?:[\+\-M\?]|\s{2})\s+(src\/[\w\-_./]+\.\w+)/gm
  while ((match = filePathPattern.exec(output)) !== null) {
    if (match[1]) {
      filesSet.add(match[1])
    }
  }

  return Array.from(filesSet).sort()
}

/**
 * Check if Claude CLI is available locally
 */
async function checkLocalClaudeAvailable(): Promise<boolean> {
  try {
    await execAsync("which claude", { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

/**
 * Check if remote host is reachable via SSH
 */
async function checkRemoteAvailable(): Promise<boolean> {
  try {
    await execAsync(
      `ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no -o ConnectTimeout=5 -o BatchMode=yes ${SSH_USER}@${SSH_HOST} "echo ok"`,
      { timeout: 10000 }
    )
    return true
  } catch {
    return false
  }
}

/**
 * GET endpoint - check execution capability
 * Reports both Local Mode (LM Studio) and Turbo Mode (Claude Code)
 */
export async function GET() {
  // Check all backends in parallel
  const [claudeLocalAvailable, claudeRemoteAvailable, lmStudioServer] = await Promise.all([
    checkLocalClaudeAvailable(),
    checkRemoteAvailable(),
    getAvailableServer()
  ])

  const lmStudioAvailable = lmStudioServer !== null

  return NextResponse.json({
    // Overall availability
    available: lmStudioAvailable || claudeLocalAvailable || claudeRemoteAvailable,

    // Local Mode (LM Studio) - FREE, works offline
    localMode: {
      available: lmStudioAvailable,
      server: lmStudioServer?.name || null,
      model: lmStudioServer?.currentModel || null,
      description: "Free, works offline - no internet required"
    },

    // Turbo Mode (Claude Code) - PAID, higher quality
    turboMode: {
      available: claudeLocalAvailable || claudeRemoteAvailable,
      local: claudeLocalAvailable,
      remote: claudeRemoteAvailable,
      remoteHost: SSH_HOST,
      description: "Premium, cloud-powered - requires API subscription"
    },

    // Recommended mode
    recommendedMode: lmStudioAvailable ? "local" : (claudeLocalAvailable || claudeRemoteAvailable) ? "turbo" : "none",

    // Legacy fields for backward compatibility
    remote: {
      host: SSH_HOST,
      user: SSH_USER,
      available: claudeRemoteAvailable
    },
    local: {
      available: claudeLocalAvailable,
    },
    modes: [
      ...(lmStudioAvailable ? ["local"] : []),
      ...(claudeLocalAvailable || claudeRemoteAvailable ? ["turbo"] : [])
    ]
  })
}
