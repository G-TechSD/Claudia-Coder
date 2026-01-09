/**
 * Prompt Injection Filter for Claudia Code
 *
 * Detects and blocks prompt injection attempts in user input
 * before it reaches Claude Code sessions.
 *
 * Security patterns detected:
 * - Attempts to override previous instructions
 * - Attempts to impersonate different AI
 * - System prompt access attempts
 * - Claudia Code modification attempts
 * - System prefix injection attempts
 */

import { logSecurityEvent } from "./activity-log"

// Types
export interface FilterResult {
  safe: boolean
  blocked: boolean
  detectedPatterns: DetectedPattern[]
  sanitizedInput?: string
  originalInput: string
}

export interface DetectedPattern {
  pattern: string
  type: InjectionType
  severity: "low" | "medium" | "high" | "critical"
  matchedText: string
  position: number
}

export type InjectionType =
  | "instruction_override"
  | "ai_impersonation"
  | "system_prompt_access"
  | "claudia_modification"
  | "system_prefix"
  | "role_hijacking"
  | "context_manipulation"
  | "code_injection"

// Pattern definitions with severity levels
const INJECTION_PATTERNS: Array<{
  regex: RegExp
  type: InjectionType
  severity: "low" | "medium" | "high" | "critical"
  description: string
}> = [
  // Instruction Override Patterns (Critical)
  {
    regex: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/gi,
    type: "instruction_override",
    severity: "critical",
    description: "Attempt to ignore previous instructions"
  },
  {
    regex: /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/gi,
    type: "instruction_override",
    severity: "critical",
    description: "Attempt to disregard prior context"
  },
  {
    regex: /forget\s+(everything|all|what)\s+(you('ve)?\s+)?(know|learned|been\s+told)/gi,
    type: "instruction_override",
    severity: "critical",
    description: "Attempt to reset AI memory"
  },
  {
    regex: /override\s+(your\s+)?(instructions?|programming|rules?|guidelines?)/gi,
    type: "instruction_override",
    severity: "critical",
    description: "Direct instruction override attempt"
  },
  {
    regex: /new\s+instructions?:\s*you\s+(are|will|must|should)/gi,
    type: "instruction_override",
    severity: "critical",
    description: "New instruction injection"
  },

  // AI Impersonation Patterns (Critical)
  {
    regex: /you\s+are\s+now\s+(a\s+)?(different|new|another)\s+(ai|assistant|model|system)/gi,
    type: "ai_impersonation",
    severity: "critical",
    description: "Attempt to change AI identity"
  },
  {
    regex: /pretend\s+(to\s+be|you('re|are))\s+(a\s+)?(different|another|new)/gi,
    type: "ai_impersonation",
    severity: "high",
    description: "Pretend to be different AI"
  },
  {
    regex: /from\s+now\s+on,?\s+(you\s+)?(are|will\s+be|act\s+as)/gi,
    type: "ai_impersonation",
    severity: "high",
    description: "Identity change directive"
  },
  {
    regex: /act\s+as\s+(if\s+)?(you('re|are)\s+)?(a\s+)?different/gi,
    type: "ai_impersonation",
    severity: "high",
    description: "Act as different entity"
  },
  {
    regex: /rolep?lay\s+as\s+(a\s+)?(malicious|evil|unfiltered|jailbroken)/gi,
    type: "ai_impersonation",
    severity: "critical",
    description: "Malicious roleplay attempt"
  },

  // System Prompt Access Patterns (High)
  {
    regex: /(show|reveal|display|print|output)\s+(me\s+)?(your\s+)?(system\s+)?prompt/gi,
    type: "system_prompt_access",
    severity: "high",
    description: "System prompt extraction attempt"
  },
  {
    regex: /what\s+(are|is)\s+your\s+(system\s+)?(instructions?|prompt|rules?)/gi,
    type: "system_prompt_access",
    severity: "medium",
    description: "System instruction query"
  },
  {
    regex: /repeat\s+(your\s+)?(system\s+)?(instructions?|prompt|rules?)/gi,
    type: "system_prompt_access",
    severity: "high",
    description: "System prompt repeat request"
  },
  {
    regex: /dump\s+(your\s+)?(system|initial|original)\s+(prompt|instructions?)/gi,
    type: "system_prompt_access",
    severity: "critical",
    description: "System prompt dump attempt"
  },

  // Claudia Modification Patterns (Critical)
  {
    regex: /modify\s+(claudia|this\s+system|the\s+admin|claudia\s*code)/gi,
    type: "claudia_modification",
    severity: "critical",
    description: "Attempt to modify Claudia"
  },
  {
    regex: /(hack|bypass|break|disable)\s+(claudia|security|restrictions?|filters?)/gi,
    type: "claudia_modification",
    severity: "critical",
    description: "Security bypass attempt"
  },
  {
    regex: /change\s+(claudia'?s?|the\s+system'?s?)\s+(behavior|rules?|settings?)/gi,
    type: "claudia_modification",
    severity: "critical",
    description: "System behavior modification"
  },
  {
    regex: /inject\s+(code|script|command)\s+into\s+(claudia|system)/gi,
    type: "claudia_modification",
    severity: "critical",
    description: "Code injection into system"
  },

  // System Prefix Patterns (High)
  {
    regex: /^\s*SYSTEM\s*:/gim,
    type: "system_prefix",
    severity: "high",
    description: "SYSTEM: prefix injection"
  },
  {
    regex: /^\s*\[SYSTEM\]\s*/gim,
    type: "system_prefix",
    severity: "high",
    description: "[SYSTEM] prefix injection"
  },
  {
    regex: /^\s*<system>\s*/gim,
    type: "system_prefix",
    severity: "high",
    description: "<system> tag injection"
  },
  {
    regex: /^\s*<<SYS>>\s*/gim,
    type: "system_prefix",
    severity: "high",
    description: "<<SYS>> prefix injection"
  },
  {
    regex: /^\s*###\s*SYSTEM\s*/gim,
    type: "system_prefix",
    severity: "high",
    description: "### SYSTEM prefix injection"
  },
  {
    regex: /^\s*ADMIN\s*:/gim,
    type: "system_prefix",
    severity: "high",
    description: "ADMIN: prefix injection"
  },
  {
    regex: /^\s*ROOT\s*:/gim,
    type: "system_prefix",
    severity: "high",
    description: "ROOT: prefix injection"
  },

  // Role Hijacking Patterns (High)
  {
    regex: /\[\s*new\s*role\s*\]/gi,
    type: "role_hijacking",
    severity: "high",
    description: "Role change bracket"
  },
  {
    regex: /entering\s+(developer|admin|root|sudo|god)\s+mode/gi,
    type: "role_hijacking",
    severity: "critical",
    description: "Privileged mode entry attempt"
  },
  {
    regex: /activate\s+(dan|jailbreak|unrestricted)\s+mode/gi,
    type: "role_hijacking",
    severity: "critical",
    description: "Jailbreak mode activation"
  },
  {
    regex: /developer\s+mode\s+enabled/gi,
    type: "role_hijacking",
    severity: "critical",
    description: "Developer mode claim"
  },

  // Context Manipulation Patterns (Medium)
  {
    regex: /end\s+of\s+(system\s+)?(prompt|instructions?|context)/gi,
    type: "context_manipulation",
    severity: "medium",
    description: "Context boundary manipulation"
  },
  {
    regex: /---+\s*end\s+of\s+context\s*---+/gi,
    type: "context_manipulation",
    severity: "medium",
    description: "Context delimiter injection"
  },
  {
    regex: /\]\]\s*>\s*user\s*:/gi,
    type: "context_manipulation",
    severity: "high",
    description: "Format escape attempt"
  },

  // Code Injection Patterns (High)
  {
    regex: /eval\s*\(\s*['"`]/gi,
    type: "code_injection",
    severity: "high",
    description: "Eval injection attempt"
  },
  {
    regex: /exec\s*\(\s*['"`]/gi,
    type: "code_injection",
    severity: "high",
    description: "Exec injection attempt"
  },
  {
    regex: /import\s+os\s*;?\s*os\.(system|popen|exec)/gi,
    type: "code_injection",
    severity: "critical",
    description: "Python OS command injection"
  },
  {
    regex: /require\s*\(\s*['"]child_process['"]\s*\)/gi,
    type: "code_injection",
    severity: "critical",
    description: "Node child_process injection"
  },
]

// Additional suspicious phrases to flag
const SUSPICIOUS_PHRASES: string[] = [
  "jailbreak",
  "DAN mode",
  "do anything now",
  "ignore ethics",
  "ignore safety",
  "bypass filter",
  "bypass moderation",
  "unlimited mode",
  "no restrictions",
  "without limits",
  "remove all restrictions",
  "disable safety",
  "hypothetically speaking",
  "in a fictional scenario",
  "for educational purposes only",
  "as an experiment",
]

/**
 * Filter input for prompt injection attempts
 */
export function filterPromptInjection(
  input: string,
  options?: {
    userId?: string
    sessionId?: string
    projectId?: string
    strict?: boolean
  }
): FilterResult {
  const detectedPatterns: DetectedPattern[] = []
  let safe = true
  let blocked = false

  // Check against all injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    const matches = Array.from(input.matchAll(pattern.regex))
    for (const match of matches) {
      detectedPatterns.push({
        pattern: pattern.description,
        type: pattern.type,
        severity: pattern.severity,
        matchedText: match[0],
        position: match.index || 0
      })

      // Critical or high severity patterns trigger blocking
      if (pattern.severity === "critical" || pattern.severity === "high") {
        safe = false
        blocked = true
      } else if (options?.strict && pattern.severity === "medium") {
        safe = false
        blocked = true
      }
    }
  }

  // Check for suspicious phrases (case-insensitive)
  const lowerInput = input.toLowerCase()
  for (const phrase of SUSPICIOUS_PHRASES) {
    const index = lowerInput.indexOf(phrase.toLowerCase())
    if (index !== -1) {
      detectedPatterns.push({
        pattern: `Suspicious phrase: "${phrase}"`,
        type: "context_manipulation",
        severity: "medium",
        matchedText: input.substring(index, index + phrase.length),
        position: index
      })

      if (options?.strict) {
        safe = false
        blocked = true
      }
    }
  }

  // Log security event if patterns detected
  if (detectedPatterns.length > 0) {
    const highestSeverity = getHighestSeverity(detectedPatterns)

    logSecurityEvent({
      userId: options?.userId || "unknown",
      type: "injection_attempt",
      severity: highestSeverity,
      details: {
        input: input.substring(0, 500), // Truncate for log
        patterns: detectedPatterns,
        sessionId: options?.sessionId,
        projectId: options?.projectId,
        blocked
      }
    })
  }

  return {
    safe,
    blocked,
    detectedPatterns,
    originalInput: input
  }
}

/**
 * Filter KICKOFF.md content for injection attempts
 */
export function filterKickoffContent(
  content: string,
  options?: {
    projectId?: string
    filePath?: string
  }
): FilterResult {
  const result = filterPromptInjection(content, {
    projectId: options?.projectId,
    strict: true // KICKOFF files should be strictly filtered
  })

  if (result.detectedPatterns.length > 0) {
    logSecurityEvent({
      userId: "system",
      type: "injection_attempt",
      severity: getHighestSeverity(result.detectedPatterns),
      details: {
        source: "kickoff_file",
        filePath: options?.filePath,
        projectId: options?.projectId,
        patterns: result.detectedPatterns,
        blocked: result.blocked
      }
    })
  }

  return result
}

/**
 * Check if content appears to be an injection attempt based on structure
 */
export function detectStructuralInjection(input: string): boolean {
  // Check for multiple role markers
  const roleMarkers = [
    /^\s*(user|human|assistant|system|admin)\s*:/gim,
    /\[\s*(user|human|assistant|system|admin)\s*\]/gi,
  ]

  let markerCount = 0
  for (const marker of roleMarkers) {
    const matches = input.match(marker)
    if (matches) {
      markerCount += matches.length
    }
  }

  // Multiple role markers is suspicious
  return markerCount > 2
}

/**
 * Get a safe, sanitized version of input (removes detected patterns)
 */
export function sanitizeInput(input: string): string {
  let sanitized = input

  // Remove system prefixes
  sanitized = sanitized.replace(/^\s*(SYSTEM|ADMIN|ROOT)\s*:\s*/gim, "")
  sanitized = sanitized.replace(/^\s*\[(SYSTEM|ADMIN|ROOT)\]\s*/gim, "")
  sanitized = sanitized.replace(/^\s*<(system|admin|root)>\s*/gim, "")
  sanitized = sanitized.replace(/^\s*<<SYS>>\s*/gim, "")

  return sanitized.trim()
}

/**
 * Get the highest severity from detected patterns
 */
function getHighestSeverity(patterns: DetectedPattern[]): "low" | "medium" | "high" | "critical" {
  const severityOrder = ["low", "medium", "high", "critical"] as const
  let highest = 0

  for (const pattern of patterns) {
    const index = severityOrder.indexOf(pattern.severity)
    if (index > highest) {
      highest = index
    }
  }

  return severityOrder[highest]
}

/**
 * Quick check if input is safe (for performance-critical paths)
 */
export function isInputSafe(input: string): boolean {
  // Quick checks for most common injection patterns
  const quickPatterns = [
    /ignore\s+(all\s+)?previous/gi,
    /you\s+are\s+now/gi,
    /^\s*SYSTEM\s*:/gim,
    /^\s*\[SYSTEM\]/gim,
    /jailbreak/gi,
    /bypass\s+(filter|security)/gi,
  ]

  for (const pattern of quickPatterns) {
    if (pattern.test(input)) {
      return false
    }
  }

  return true
}
