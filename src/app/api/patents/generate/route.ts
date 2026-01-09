/**
 * Patent Submission Generation API
 * Generates professional patent submission content following USPTO format
 * Sections: Abstract, Background, Summary, Detailed Description, Claims
 */

import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import type {
  PatentSubmission,
  PatentSection,
  PatentClaim,
  PatentSectionType
} from "@/lib/data/types"

const USPTO_FORMAT_SYSTEM_PROMPT = `You are an expert patent attorney and technical writer specializing in drafting USPTO patent applications.

Your task is to generate professional patent application content that:
1. Follows USPTO formatting requirements (37 CFR 1.71-1.77)
2. Uses precise, unambiguous technical language
3. Provides sufficient detail for one skilled in the art to reproduce the invention
4. Clearly defines the scope and boundaries of the claimed invention
5. Anticipates and addresses potential prior art challenges

SECTION REQUIREMENTS:

ABSTRACT (150 words max):
- Concise technical summary of the invention
- Must include: technical field, problem solved, and key solution
- Written in a single paragraph
- No legal or promotional language

BACKGROUND:
- Describe the technical field of the invention
- Explain the state of the prior art and its limitations
- Identify the technical problem to be solved
- Do NOT disparage prior art
- Set up the need for the invention

SUMMARY OF THE INVENTION:
- Brief overview of the invention
- Highlight novel aspects and advantages
- Should correspond to the broadest claims
- Written to capture the essence without excessive detail

DETAILED DESCRIPTION:
- Comprehensive technical description
- Reference figures/drawings where applicable
- Describe all embodiments mentioned in claims
- Include specific examples and implementations
- Use consistent terminology throughout
- Describe best mode of carrying out the invention

CLAIMS:
- Start with broadest independent claims
- Follow with dependent claims that narrow scope
- Use proper patent claim format ("comprising", "wherein", etc.)
- Each claim should be a single sentence
- Number claims consecutively

Return content as valid JSON only, no markdown formatting.`

interface GenerationRequest {
  inventionTitle: string
  inventionDescription: string
  technicalField: string
  problemSolved: string
  keyFeatures: string[]
  embodiments?: string[]
  figures?: Array<{ number: number; title: string; description: string }>
  priorArtNotes?: string
  sectionToGenerate?: PatentSectionType | "all" | "claims"
  existingContent?: Partial<Record<PatentSectionType, string>>
  preferredProvider?: string
}

function generateSectionPrompt(
  section: PatentSectionType | "claims",
  request: GenerationRequest
): string {
  const baseContext = `
INVENTION INFORMATION:
Title: ${request.inventionTitle}
Technical Field: ${request.technicalField}
Problem Solved: ${request.problemSolved}

Description:
${request.inventionDescription}

Key Features:
${request.keyFeatures.map((f, i) => `${i + 1}. ${f}`).join("\n")}
${request.embodiments?.length ? `\nEmbodiments:\n${request.embodiments.map((e, i) => `${i + 1}. ${e}`).join("\n")}` : ""}
${request.figures?.length ? `\nFigures:\n${request.figures.map(f => `FIG. ${f.number}: ${f.title} - ${f.description}`).join("\n")}` : ""}
${request.priorArtNotes ? `\nPrior Art Notes:\n${request.priorArtNotes}` : ""}
`

  switch (section) {
    case "abstract":
      return `${baseContext}

TASK: Generate a USPTO-compliant ABSTRACT for this invention.

Requirements:
- Maximum 150 words
- Single paragraph
- Include: technical field, problem, solution
- Concise and technical
- No promotional language

Return JSON: { "content": "...", "wordCount": N, "suggestions": [], "warnings": [] }`

    case "background":
      return `${baseContext}

TASK: Generate a USPTO-compliant BACKGROUND section.

Requirements:
- Describe the technical field
- Explain state of prior art
- Identify limitations of existing solutions
- State the technical problem
- Set up need for the invention
- Do NOT disparage prior art

Return JSON: { "content": "...", "suggestions": [], "warnings": [] }`

    case "summary":
      return `${baseContext}

TASK: Generate a USPTO-compliant SUMMARY OF THE INVENTION section.

Requirements:
- Brief overview of the invention
- Highlight novel aspects
- State advantages over prior art
- Correspond to broadest claims
- Clear and concise

Return JSON: { "content": "...", "suggestions": [], "warnings": [] }`

    case "detailedDescription":
      return `${baseContext}

TASK: Generate a USPTO-compliant DETAILED DESCRIPTION section.

Requirements:
- Comprehensive technical description
- Reference figures (FIG. 1, FIG. 2, etc.) where applicable
- Describe all embodiments
- Include specific implementation examples
- Use consistent terminology
- Enable one skilled in the art to reproduce
- Describe best mode

Return JSON: { "content": "...", "suggestions": [], "warnings": [] }`

    case "claims":
      return `${baseContext}

TASK: Generate USPTO-compliant CLAIMS for this invention.

Requirements:
- Start with independent claims (broadest scope)
- Add dependent claims that narrow scope
- Use proper claim language ("comprising", "wherein", "further comprising")
- Each claim is a single sentence
- Number consecutively
- Independent claims should be self-contained
- Dependent claims reference specific claim numbers

Generate at least:
- 1-3 independent claims (method, system, and/or apparatus)
- 5-10 dependent claims

Return JSON:
{
  "claims": [
    {
      "number": 1,
      "type": "independent",
      "content": "A method for... comprising:..."
    },
    {
      "number": 2,
      "type": "dependent",
      "dependsOn": 1,
      "content": "The method of claim 1, wherein..."
    }
  ],
  "suggestions": [],
  "warnings": []
}`

    default:
      return baseContext
  }
}

function generateId(): string {
  return `patent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function generateClaimId(): string {
  return `claim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

interface ParsedSection {
  content: string
  wordCount?: number
  suggestions?: string[]
  warnings?: string[]
}

interface ParsedClaims {
  claims: Array<{
    number: number
    type: "independent" | "dependent"
    dependsOn?: number
    content: string
  }>
  suggestions?: string[]
  warnings?: string[]
}

function parseSection(content: string): ParsedSection {
  let jsonStr = content.trim()

  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  try {
    return JSON.parse(jsonStr)
  } catch {
    // If JSON parsing fails, treat the whole content as the section content
    return { content: jsonStr, suggestions: [], warnings: [] }
  }
}

function parseClaims(content: string): ParsedClaims {
  let jsonStr = content.trim()

  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  try {
    return JSON.parse(jsonStr)
  } catch {
    return { claims: [], suggestions: [], warnings: ["Failed to parse claims"] }
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body: GenerationRequest = await request.json()
    const {
      inventionTitle,
      inventionDescription,
      technicalField,
      problemSolved,
      keyFeatures,
      sectionToGenerate = "all",
      preferredProvider
    } = body

    // Validate required fields
    if (!inventionTitle || !inventionDescription || !problemSolved || !keyFeatures?.length) {
      return NextResponse.json({
        error: "Missing required fields: inventionTitle, inventionDescription, problemSolved, and keyFeatures are required"
      }, { status: 400 })
    }

    const sections: PatentSubmission["sections"] = {}
    const claims: PatentClaim[] = []
    const allSuggestions: string[] = []
    const allWarnings: string[] = []

    // Determine which sections to generate
    const sectionsToGenerate: (PatentSectionType | "claims")[] =
      sectionToGenerate === "all"
        ? ["abstract", "background", "summary", "detailedDescription", "claims"]
        : sectionToGenerate === "claims"
        ? ["claims"]
        : [sectionToGenerate]

    // Generate each section
    for (const section of sectionsToGenerate) {
      const prompt = generateSectionPrompt(section, body)

      const llmResponse = await generateWithLocalLLM(
        USPTO_FORMAT_SYSTEM_PROMPT,
        prompt,
        {
          temperature: 0.4,
          max_tokens: 8192,
          preferredServer: preferredProvider
        }
      )

      if (llmResponse.error) {
        return NextResponse.json({
          error: `Failed to generate ${section}: ${llmResponse.error}`,
          partialResult: { sections, claims }
        }, { status: 503 })
      }

      if (section === "claims") {
        const parsed = parseClaims(llmResponse.content)
        for (const claim of parsed.claims) {
          claims.push({
            id: generateClaimId(),
            number: claim.number,
            type: claim.type,
            dependsOn: claim.dependsOn,
            content: claim.content,
            isEdited: false
          })
        }
        if (parsed.suggestions) allSuggestions.push(...parsed.suggestions)
        if (parsed.warnings) allWarnings.push(...parsed.warnings)
      } else {
        const parsed = parseSection(llmResponse.content)
        const sectionObj: PatentSection = {
          type: section,
          title: getSectionTitle(section),
          content: parsed.content,
          isEdited: false,
          suggestions: parsed.suggestions,
          warnings: parsed.warnings
        }
        sections[section] = sectionObj
        if (parsed.suggestions) allSuggestions.push(...parsed.suggestions)
        if (parsed.warnings) allWarnings.push(...parsed.warnings)
      }
    }

    // Build submission object
    const submission: Partial<PatentSubmission> = {
      id: generateId(),
      status: "draft",
      inventionTitle,
      inventionDescription,
      technicalField: technicalField || "General Technology",
      inventors: [],
      sections,
      claims,
      figures: body.figures,
      reviewChecklist: {
        abstractComplete: !!sections.abstract,
        backgroundComplete: !!sections.background,
        summaryComplete: !!sections.summary,
        detailedDescriptionComplete: !!sections.detailedDescription,
        claimsComplete: claims.length > 0,
        figuresDescribed: (body.figures?.length || 0) > 0,
        priorArtCited: !!body.priorArtNotes,
        inventorInfoComplete: false
      },
      generatedBy: {
        server: "local",
        model: "unknown"
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      submission,
      suggestions: allSuggestions,
      warnings: allWarnings,
      generationDuration: (Date.now() - startTime) / 1000
    })

  } catch (error) {
    console.error("Patent generation error:", error)

    return NextResponse.json({
      error: error instanceof Error ? error.message : "Patent generation failed"
    }, { status: 500 })
  }
}

function getSectionTitle(type: PatentSectionType): string {
  switch (type) {
    case "abstract":
      return "ABSTRACT"
    case "background":
      return "BACKGROUND OF THE INVENTION"
    case "summary":
      return "SUMMARY OF THE INVENTION"
    case "detailedDescription":
      return "DETAILED DESCRIPTION OF THE PREFERRED EMBODIMENTS"
    case "claims":
      return "CLAIMS"
    default:
      return (type as string).toUpperCase()
  }
}

// GET endpoint to export patent as formatted document
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") || "text"

  // This would retrieve a stored patent and format it
  // For now, return format options
  return NextResponse.json({
    availableFormats: ["text", "markdown", "docx", "pdf"],
    note: "Export functionality requires a stored patent ID"
  })
}
