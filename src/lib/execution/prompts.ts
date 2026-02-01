/**
 * Code Generation Prompts
 *
 * Prompts for generating code from work packets.
 * Designed for local LLM execution (LM Studio/Ollama)
 */

import type { WorkPacket, PacketTask } from "@/lib/ai/build-plan"
import type { RepoContext } from "./repo-context"

export interface CodeGenerationPrompt {
  systemPrompt: string
  userPrompt: string
}

/**
 * Build a code generation prompt for a specific task
 */
export function buildCodeGenPrompt(
  task: PacketTask,
  packet: WorkPacket,
  context: RepoContext
): CodeGenerationPrompt {
  const systemPrompt = `You are a senior developer implementing features.
Output ONLY valid code. Use this format for each file:

=== FILE: path/to/file.tsx ===
\`\`\`typescript
// file contents here
\`\`\`

Rules:
- Output complete, working code
- Use proper imports and exports
- Follow existing code patterns from the project
- Do not explain - just write code
- Multiple files are allowed, each with its own === FILE: header
- CRITICAL: Use .tsx extension for files containing JSX/React components. Use .ts only for pure TypeScript without JSX.
- CRITICAL: If you create or modify package.json, you MUST run \`npm install\` afterward. Include a === RUN: npm install === block.
- CRITICAL: For project setup tasks, ensure dependencies are installed before writing code that uses them.`

  const existingFilesSection = context.relevantFiles.length > 0
    ? `EXISTING FILES:
${context.relevantFiles.map(f => `- ${f.path}: ${f.summary}`).join("\n")}`
    : ""

  const fileTreeSection = context.fileTree.length > 0
    ? `PROJECT STRUCTURE:
${context.fileTree.slice(0, 30).join("\n")}${context.fileTree.length > 30 ? "\n... and more" : ""}`
    : ""

  const userPrompt = `PROJECT: ${context.projectName}
TECH STACK: ${context.techStack.join(", ")}

CURRENT TASK: ${task.description}

CONTEXT (from packet "${packet.title}"):
${packet.description}

ACCEPTANCE CRITERIA:
${packet.acceptanceCriteria.map(c => `- ${c}`).join("\n")}

${existingFilesSection}

${fileTreeSection}

Generate the code to complete this task.`

  return { systemPrompt, userPrompt }
}

/**
 * Build a prompt for an entire packet (all tasks together)
 */
export function buildPacketPrompt(
  packet: WorkPacket,
  context: RepoContext
): CodeGenerationPrompt {
  const systemPrompt = `You are a senior developer implementing a feature.
Output ONLY valid code. Use this format for each file:

=== FILE: path/to/file.tsx ===
\`\`\`typescript
// file contents here
\`\`\`

Rules:
- Output complete, working code
- Use proper imports and exports
- Follow existing code patterns from the project
- Do not explain - just write code
- Create all necessary files to complete the feature
- Consider dependencies between files
- CRITICAL: Use .tsx extension for files containing JSX/React components. Use .ts only for pure TypeScript without JSX.
- CRITICAL: If you create or modify package.json, you MUST run \`npm install\` afterward. Include a === RUN: npm install === block.
- CRITICAL: For project setup tasks, ensure dependencies are installed before writing code that uses them.`

  const tasksSection = packet.tasks.length > 0
    ? `TASKS TO COMPLETE:
${packet.tasks.map((t, i) => `${i + 1}. ${t.description}`).join("\n")}`
    : ""

  const existingFilesSection = context.relevantFiles.length > 0
    ? `EXISTING FILES (for reference):
${context.relevantFiles.map(f => `- ${f.path}: ${f.summary}`).join("\n")}`
    : ""

  const existingCodeSection = context.existingCode
    ? `EXISTING CODE TO MODIFY:
\`\`\`
${context.existingCode}
\`\`\``
    : ""

  const userPrompt = `PROJECT: ${context.projectName}
TECH STACK: ${context.techStack.join(", ")}

FEATURE: ${packet.title}
${packet.description}

${tasksSection}

ACCEPTANCE CRITERIA:
${packet.acceptanceCriteria.map(c => `- ${c}`).join("\n")}

${existingFilesSection}

${existingCodeSection}

Generate all the code needed to complete this feature.`

  return { systemPrompt, userPrompt }
}

/**
 * Build a test generation prompt
 */
export function buildTestPrompt(
  packet: WorkPacket,
  generatedCode: string,
  context: RepoContext
): CodeGenerationPrompt {
  const systemPrompt = `You are a senior developer writing tests.
Output ONLY test code. Use this format:

=== FILE: path/to/file.test.ts ===
\`\`\`typescript
// test contents
\`\`\`

Rules:
- Write comprehensive tests
- Include edge cases
- Use the project's testing framework
- Follow existing test patterns
- Do not explain - just write tests`

  const userPrompt = `PROJECT: ${context.projectName}
TECH STACK: ${context.techStack.join(", ")}

FEATURE: ${packet.title}

GENERATED CODE:
${generatedCode}

ACCEPTANCE CRITERIA TO VERIFY:
${packet.acceptanceCriteria.map(c => `- ${c}`).join("\n")}

Generate tests to verify this code meets the acceptance criteria.`

  return { systemPrompt, userPrompt }
}

/**
 * Build a self-critique prompt
 */
export function buildSelfCritiquePrompt(
  packet: WorkPacket,
  generatedCode: string,
  context: RepoContext
): CodeGenerationPrompt {
  const systemPrompt = `You are a senior code reviewer evaluating generated code.
Be critical and thorough. Output your analysis as JSON:

{
  "issues": ["list of problems found"],
  "suggestions": ["list of improvements"],
  "confidence": 0.0 to 1.0,
  "passesAcceptanceCriteria": true/false,
  "criteriaMet": ["criteria that are met"],
  "criteriaMissing": ["criteria that are NOT met"]
}

Rules:
- Be honest and critical
- Check for bugs, security issues, edge cases
- Verify all acceptance criteria are met
- Rate confidence based on code quality`

  const userPrompt = `PROJECT: ${context.projectName}
TECH STACK: ${context.techStack.join(", ")}

FEATURE: ${packet.title}
${packet.description}

ACCEPTANCE CRITERIA:
${packet.acceptanceCriteria.map(c => `- ${c}`).join("\n")}

GENERATED CODE:
${generatedCode}

Review this code and provide your analysis.`

  return { systemPrompt, userPrompt }
}

/**
 * Build a fix prompt based on validation errors
 */
export function buildFixPrompt(
  originalCode: string,
  errors: string[],
  context: RepoContext
): CodeGenerationPrompt {
  const systemPrompt = `You are a senior developer fixing code errors.
Output ONLY the corrected code. Use this format:

=== FILE: path/to/file.tsx ===
\`\`\`typescript
// corrected file contents
\`\`\`

Rules:
- Fix all reported errors
- Preserve original functionality
- Do not add unnecessary changes
- Do not explain - just output fixed code
- CRITICAL: Use .tsx extension for files containing JSX/React components. Use .ts only for pure TypeScript without JSX.`

  const userPrompt = `PROJECT: ${context.projectName}
TECH STACK: ${context.techStack.join(", ")}

ORIGINAL CODE:
${originalCode}

ERRORS TO FIX:
${errors.map(e => `- ${e}`).join("\n")}

Fix these errors and output the corrected code.`

  return { systemPrompt, userPrompt }
}

/**
 * Build a documentation prompt
 */
export function buildDocPrompt(
  packet: WorkPacket,
  generatedCode: string,
  context: RepoContext
): CodeGenerationPrompt {
  const systemPrompt = `You are a technical writer creating documentation.
Output markdown documentation:

=== FILE: docs/feature-name.md ===
\`\`\`markdown
# Feature Name

Description...
\`\`\`

Rules:
- Write clear, concise documentation
- Include usage examples
- Document any configuration
- List any breaking changes`

  const userPrompt = `PROJECT: ${context.projectName}

FEATURE: ${packet.title}
${packet.description}

IMPLEMENTATION:
${generatedCode}

Write documentation for this feature.`

  return { systemPrompt, userPrompt }
}
