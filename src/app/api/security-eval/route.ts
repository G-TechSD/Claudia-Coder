/**
 * Security Evaluation API
 * Red Team automated security scanning using local LLM
 * Analyzes code for vulnerabilities and generates fix recommendations
 */

import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import type {
  SecurityFinding,
  SecurityScan,
  SecurityCategory,
  SecuritySeverity
} from "@/lib/data/types"

const SECURITY_EVAL_SYSTEM_PROMPT = `You are an expert security researcher and penetration tester conducting a comprehensive security audit.

Your mission is to find ALL security vulnerabilities in the provided code. Be thorough and adversarial in your analysis.

VULNERABILITY CATEGORIES TO CHECK:
1. INJECTION ATTACKS
   - SQL injection (parameterized queries, ORM misuse)
   - Command injection (shell execution, subprocess)
   - Code injection (eval, dynamic code execution)
   - LDAP injection, XPath injection

2. CROSS-SITE SCRIPTING (XSS)
   - Reflected XSS
   - Stored XSS
   - DOM-based XSS
   - Missing output encoding

3. AUTHENTICATION ISSUES
   - Weak password policies
   - Insecure session handling
   - Missing MFA considerations
   - Credential exposure in logs/errors
   - Insecure password storage

4. ACCESS CONTROL
   - Missing authorization checks
   - Insecure direct object references (IDOR)
   - Privilege escalation vectors
   - Missing rate limiting

5. CRYPTOGRAPHIC FAILURES
   - Weak algorithms (MD5, SHA1, DES)
   - Hardcoded keys/secrets
   - Improper key management
   - Missing encryption for sensitive data

6. DATA EXPOSURE
   - Sensitive data in logs
   - Information leakage in errors
   - Exposed debug endpoints
   - Insecure data transmission

7. SECURITY MISCONFIGURATION
   - Debug mode in production
   - Default credentials
   - Unnecessary features enabled
   - Missing security headers

8. VULNERABLE DEPENDENCIES
   - Known CVEs in packages
   - Outdated libraries
   - Insecure package versions

9. INPUT VALIDATION
   - Missing validation
   - Improper sanitization
   - Type confusion vulnerabilities
   - Path traversal

10. API SECURITY
    - Missing authentication
    - Excessive data exposure
    - Mass assignment vulnerabilities
    - Missing rate limiting

For each finding, provide:
- Severity (critical/high/medium/low/info)
- Category
- Specific location (file, line numbers if possible)
- Clear description of the vulnerability
- Exploitation scenario
- Concrete fix recommendation with code example
- CWE ID if applicable
- OWASP category if applicable

Return findings as a JSON array. Be comprehensive but avoid false positives.
Return ONLY valid JSON, no markdown.`

function generateUserPrompt(
  projectName: string,
  projectDescription: string,
  codeFiles: Array<{ path: string; content: string }>,
  focusAreas?: string[]
): string {
  const filesSection = codeFiles.map(f =>
    `=== FILE: ${f.path} ===\n${f.content}\n`
  ).join("\n")

  let prompt = `SECURITY AUDIT REQUEST

Project: ${projectName}
Description: ${projectDescription}

`

  if (focusAreas?.length) {
    prompt += `FOCUS AREAS: ${focusAreas.join(", ")}\n\n`
  }

  prompt += `CODE TO ANALYZE:
${filesSection}

TASK: Perform a comprehensive security audit. Find ALL vulnerabilities.

Return JSON array of findings with this structure:
[
  {
    "category": "injection|xss|auth|access-control|cryptography|data-exposure|configuration|dependencies|input-validation|session|logging|api-security|other",
    "severity": "critical|high|medium|low|info",
    "title": "Brief title",
    "description": "Detailed description of vulnerability",
    "filePath": "path/to/file.ts",
    "lineStart": 42,
    "lineEnd": 45,
    "codeSnippet": "the vulnerable code",
    "cweId": "CWE-89",
    "owaspCategory": "A03:2021-Injection",
    "recommendation": "How to fix this",
    "fixExample": "Code showing the fix",
    "estimatedEffort": "trivial|small|medium|large",
    "breakingChange": false
  }
]

Return ONLY the JSON array, no other text.`

  return prompt
}

function generateId(): string {
  return `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function parseSecurityFindings(content: string): SecurityFinding[] {
  let jsonStr = content.trim()

  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  try {
    const parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed)) {
      console.error("Security findings not an array")
      return []
    }

    return parsed.map((finding: Record<string, unknown>) => ({
      id: generateId(),
      category: (finding.category as SecurityCategory) || "other",
      severity: (finding.severity as SecuritySeverity) || "medium",
      title: (finding.title as string) || "Untitled Finding",
      description: (finding.description as string) || "",
      filePath: finding.filePath as string | undefined,
      lineStart: finding.lineStart as number | undefined,
      lineEnd: finding.lineEnd as number | undefined,
      codeSnippet: finding.codeSnippet as string | undefined,
      cweId: finding.cweId as string | undefined,
      owaspCategory: finding.owaspCategory as string | undefined,
      cvssScore: finding.cvssScore as number | undefined,
      recommendation: (finding.recommendation as string) || "Review and fix this issue",
      fixExample: finding.fixExample as string | undefined,
      resources: finding.resources as string[] | undefined,
      estimatedEffort: finding.estimatedEffort as "trivial" | "small" | "medium" | "large" | undefined,
      breakingChange: finding.breakingChange as boolean | undefined,
      acknowledged: false,
      falsePositive: false
    }))
  } catch (error) {
    console.error("Failed to parse security findings:", error)
    console.error("Raw content:", content)
    return []
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const {
      projectId,
      projectName,
      projectDescription,
      codeFiles = [],
      focusAreas,
      preferredProvider
    } = body

    if (!projectName || codeFiles.length === 0) {
      return NextResponse.json(
        { error: "Project name and code files are required" },
        { status: 400 }
      )
    }

    // Prepare the prompts
    const userPrompt = generateUserPrompt(
      projectName,
      projectDescription || "",
      codeFiles,
      focusAreas
    )

    // Call local LLM for security analysis
    const llmResponse = await generateWithLocalLLM(
      SECURITY_EVAL_SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.2, // Low temperature for consistent analysis
        max_tokens: 8192,
        preferredServer: preferredProvider
      }
    )

    if (llmResponse.error) {
      return NextResponse.json({
        error: llmResponse.error,
        suggestion: "Ensure LM Studio or Ollama is running with a capable model"
      }, { status: 503 })
    }

    // Parse findings
    const findings = parseSecurityFindings(llmResponse.content)

    // Calculate summary
    const summary = {
      critical: findings.filter(f => f.severity === "critical").length,
      high: findings.filter(f => f.severity === "high").length,
      medium: findings.filter(f => f.severity === "medium").length,
      low: findings.filter(f => f.severity === "low").length,
      info: findings.filter(f => f.severity === "info").length,
      totalFiles: codeFiles.length,
      scanDuration: (Date.now() - startTime) / 1000
    }

    // Build scan result
    const scan: SecurityScan = {
      id: `scan-${Date.now()}`,
      projectId: projectId || "unknown",
      status: "completed",
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      scanScope: {
        paths: codeFiles.map((f: { path: string }) => f.path)
      },
      findings,
      summary,
      generatedBy: `${llmResponse.server}:${llmResponse.model}`
    }

    return NextResponse.json({
      success: true,
      scan,
      source: llmResponse.server,
      model: llmResponse.model
    })

  } catch (error) {
    console.error("Security evaluation error:", error)

    return NextResponse.json({
      error: error instanceof Error ? error.message : "Security evaluation failed"
    }, { status: 500 })
  }
}

/**
 * GET endpoint to fetch file contents from a repo for scanning
 * In a real implementation, this would integrate with GitLab/GitHub API
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const repoId = searchParams.get("repoId")

  if (!repoId) {
    return NextResponse.json({ error: "Repo ID required" }, { status: 400 })
  }

  // TODO: Implement actual repo file fetching
  // For now, return a placeholder
  return NextResponse.json({
    error: "File fetching not yet implemented",
    suggestion: "Upload code files directly or implement GitLab/GitHub integration"
  }, { status: 501 })
}
