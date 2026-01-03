/**
 * Code Validator
 *
 * Validates generated code for syntax errors, type issues, and other problems.
 */

import type { FileChange } from "./apply-code"

export interface ValidationResult {
  valid: boolean
  syntaxErrors: SyntaxError[]
  typeErrors: TypeError[]
  lintWarnings: LintWarning[]
  summary: string
}

export interface SyntaxError {
  file: string
  line: number
  column: number
  message: string
}

export interface TypeError {
  file: string
  line: number
  message: string
  code: string
}

export interface LintWarning {
  file: string
  line: number
  rule: string
  message: string
  severity: "error" | "warning" | "info"
}

/**
 * Basic syntax validation for TypeScript/JavaScript files
 * Note: This is a simplified validator - in production, you'd want to
 * actually run tsc/eslint as separate processes
 */
export function validateSyntax(files: FileChange[]): ValidationResult {
  const syntaxErrors: SyntaxError[] = []
  const typeErrors: TypeError[] = []
  const lintWarnings: LintWarning[] = []

  for (const file of files) {
    if (!isJavaScriptFile(file.path)) continue

    const errors = checkBasicSyntax(file)
    syntaxErrors.push(...errors)

    const warnings = checkCommonIssues(file)
    lintWarnings.push(...warnings)
  }

  const valid = syntaxErrors.length === 0

  return {
    valid,
    syntaxErrors,
    typeErrors,
    lintWarnings,
    summary: valid
      ? `All ${files.length} files passed basic validation`
      : `Found ${syntaxErrors.length} syntax errors in ${files.length} files`
  }
}

/**
 * Check if file is a JavaScript/TypeScript file
 */
function isJavaScriptFile(path: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path)
}

/**
 * Basic syntax checks without requiring actual parsers
 */
function checkBasicSyntax(file: FileChange): SyntaxError[] {
  const errors: SyntaxError[] = []
  const lines = file.content.split("\n")

  // Track bracket balance
  let braceBalance = 0
  let parenBalance = 0
  let bracketBalance = 0
  let inString = false
  let inTemplate = false
  let stringChar = ""

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]

    for (let col = 0; col < line.length; col++) {
      const char = line[col]
      const prevChar = col > 0 ? line[col - 1] : ""

      // Handle string state
      if (!inString && !inTemplate) {
        if (char === '"' || char === "'") {
          inString = true
          stringChar = char
        } else if (char === "`") {
          inTemplate = true
        }
      } else if (inString && char === stringChar && prevChar !== "\\") {
        inString = false
      } else if (inTemplate && char === "`" && prevChar !== "\\") {
        inTemplate = false
      }

      // Only count brackets outside strings
      if (!inString && !inTemplate) {
        if (char === "{") braceBalance++
        else if (char === "}") braceBalance--
        else if (char === "(") parenBalance++
        else if (char === ")") parenBalance--
        else if (char === "[") bracketBalance++
        else if (char === "]") bracketBalance--

        // Check for negative balance (closing before opening)
        if (braceBalance < 0) {
          errors.push({
            file: file.path,
            line: lineNum + 1,
            column: col + 1,
            message: "Unexpected closing brace '}'"
          })
          braceBalance = 0
        }
        if (parenBalance < 0) {
          errors.push({
            file: file.path,
            line: lineNum + 1,
            column: col + 1,
            message: "Unexpected closing parenthesis ')'"
          })
          parenBalance = 0
        }
        if (bracketBalance < 0) {
          errors.push({
            file: file.path,
            line: lineNum + 1,
            column: col + 1,
            message: "Unexpected closing bracket ']'"
          })
          bracketBalance = 0
        }
      }
    }

    // Check for unterminated strings at end of line (except template literals)
    if (inString) {
      errors.push({
        file: file.path,
        line: lineNum + 1,
        column: line.length,
        message: `Unterminated string literal`
      })
      inString = false
    }
  }

  // Check final balance
  if (braceBalance !== 0) {
    errors.push({
      file: file.path,
      line: lines.length,
      column: 1,
      message: `Unbalanced braces: ${braceBalance > 0 ? "missing" : "extra"} ${Math.abs(braceBalance)} closing brace(s)`
    })
  }
  if (parenBalance !== 0) {
    errors.push({
      file: file.path,
      line: lines.length,
      column: 1,
      message: `Unbalanced parentheses: ${parenBalance > 0 ? "missing" : "extra"} ${Math.abs(parenBalance)} closing paren(s)`
    })
  }
  if (bracketBalance !== 0) {
    errors.push({
      file: file.path,
      line: lines.length,
      column: 1,
      message: `Unbalanced brackets: ${bracketBalance > 0 ? "missing" : "extra"} ${Math.abs(bracketBalance)} closing bracket(s)`
    })
  }

  return errors
}

/**
 * Check for common issues/code smells
 */
function checkCommonIssues(file: FileChange): LintWarning[] {
  const warnings: LintWarning[] = []
  const lines = file.content.split("\n")

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]

    // Check for console.log (common debug statement)
    if (/console\.(log|debug|info|warn|error)/.test(line)) {
      warnings.push({
        file: file.path,
        line: lineNum + 1,
        rule: "no-console",
        message: "Unexpected console statement",
        severity: "warning"
      })
    }

    // Check for TODO/FIXME comments
    if (/\/\/\s*(TODO|FIXME|XXX|HACK)/i.test(line)) {
      const match = line.match(/\/\/\s*(TODO|FIXME|XXX|HACK)/i)
      warnings.push({
        file: file.path,
        line: lineNum + 1,
        rule: "no-todo",
        message: `Found ${match?.[1]?.toUpperCase()} comment`,
        severity: "info"
      })
    }

    // Check for very long lines
    if (line.length > 200) {
      warnings.push({
        file: file.path,
        line: lineNum + 1,
        rule: "max-line-length",
        message: `Line is too long (${line.length} > 200)`,
        severity: "warning"
      })
    }

    // Check for 'any' type in TypeScript
    if (file.path.endsWith(".ts") || file.path.endsWith(".tsx")) {
      if (/:\s*any\b/.test(line)) {
        warnings.push({
          file: file.path,
          line: lineNum + 1,
          rule: "no-explicit-any",
          message: "Unexpected 'any' type",
          severity: "warning"
        })
      }
    }

    // Check for == instead of === (except for null checks)
    if (/[^=!]==[^=]/.test(line) && !/==\s*(null|undefined)/.test(line)) {
      warnings.push({
        file: file.path,
        line: lineNum + 1,
        rule: "eqeqeq",
        message: "Use '===' instead of '=='",
        severity: "warning"
      })
    }
  }

  return warnings
}

/**
 * Check for required imports
 */
export function checkImports(files: FileChange[]): LintWarning[] {
  const warnings: LintWarning[] = []
  const exportedNames = new Set<string>()
  const importedNames = new Map<string, { file: string; line: number }>()

  // First pass: collect exports
  for (const file of files) {
    const lines = file.content.split("\n")
    for (const line of lines) {
      const exportMatch = line.match(/export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/)
      if (exportMatch) {
        exportedNames.add(exportMatch[1])
      }
      const exportDefault = line.match(/export\s+default\s+(\w+)/)
      if (exportDefault) {
        exportedNames.add(exportDefault[1])
      }
    }
  }

  // Second pass: check imports from local files
  for (const file of files) {
    const lines = file.content.split("\n")
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum]

      // Match imports from local files (starting with ./)
      const importMatch = line.match(/import\s+{([^}]+)}\s+from\s+["']\.\//)
      if (importMatch) {
        const imported = importMatch[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0])
        for (const name of imported) {
          if (name && !exportedNames.has(name)) {
            importedNames.set(name, { file: file.path, line: lineNum + 1 })
          }
        }
      }
    }
  }

  // Report potentially missing exports
  for (const [name, { file: filePath, line }] of importedNames) {
    warnings.push({
      file: filePath,
      line,
      rule: "import-check",
      message: `Import '${name}' may not be exported from local files`,
      severity: "info"
    })
  }

  return warnings
}

/**
 * Full validation of generated files
 */
export function validateFiles(files: FileChange[]): ValidationResult {
  const syntaxResult = validateSyntax(files)
  const importWarnings = checkImports(files)

  return {
    ...syntaxResult,
    lintWarnings: [...syntaxResult.lintWarnings, ...importWarnings]
  }
}

/**
 * Format validation result as a string for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = []

  lines.push(result.summary)
  lines.push("")

  if (result.syntaxErrors.length > 0) {
    lines.push("Syntax Errors:")
    for (const error of result.syntaxErrors) {
      lines.push(`  ${error.file}:${error.line}:${error.column} - ${error.message}`)
    }
    lines.push("")
  }

  if (result.typeErrors.length > 0) {
    lines.push("Type Errors:")
    for (const error of result.typeErrors) {
      lines.push(`  ${error.file}:${error.line} - ${error.message} (${error.code})`)
    }
    lines.push("")
  }

  if (result.lintWarnings.length > 0) {
    lines.push("Warnings:")
    for (const warning of result.lintWarnings) {
      lines.push(`  ${warning.file}:${warning.line} [${warning.rule}] ${warning.message}`)
    }
  }

  return lines.join("\n")
}
