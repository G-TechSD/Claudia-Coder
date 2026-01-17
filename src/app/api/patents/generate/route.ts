/**
 * Patent Submission Generation API
 * Generates professional patent submission content following USPTO format
 * Sections: Abstract, Background, Summary, Detailed Description, Claims
 *
 * Uses local LLM server (with gpt-oss-20b by default) for generation
 */

import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth/index"
import { getSessionWithBypass } from "@/lib/auth/api-helpers"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import { cleanLLMResponse, parseLLMJson } from "@/lib/llm"
import type {
  PatentSubmission,
  PatentSection,
  PatentClaim,
  PatentSectionType,
  PatentResearch
} from "@/lib/data/types"
import { getPatent, updatePatent } from "@/lib/data/patents"

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
  // Use the centralized LLM response cleaning
  const cleaned = cleanLLMResponse(content)

  // Try to parse as JSON first
  const parsed = parseLLMJson<ParsedSection>(cleaned)
  if (parsed && parsed.content) {
    return {
      content: parsed.content,
      wordCount: parsed.wordCount,
      suggestions: parsed.suggestions || [],
      warnings: parsed.warnings || []
    }
  }

  // If JSON parsing fails, treat the whole content as the section content
  return { content: cleaned, suggestions: [], warnings: [] }
}

function parseClaims(content: string): ParsedClaims {
  // Use the centralized LLM response cleaning
  const cleaned = cleanLLMResponse(content)

  // Try to parse as JSON
  const parsed = parseLLMJson<ParsedClaims>(cleaned)
  if (parsed && Array.isArray(parsed.claims)) {
    return {
      claims: parsed.claims,
      suggestions: parsed.suggestions || [],
      warnings: parsed.warnings || []
    }
  }

  return { claims: [], suggestions: [], warnings: ["Failed to parse claims from LLM response"] }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify authentication
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

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

    // Track generation metadata
    let generationServer = "local"
    let generationModel = "unknown"

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

      // Use local-llm-server with gpt-oss-20b by default for best quality
      // Falls back to other servers if preferred is unavailable
      const llmResponse = await generateWithLocalLLM(
        USPTO_FORMAT_SYSTEM_PROMPT,
        prompt,
        {
          temperature: 0.4,
          max_tokens: 8192,
          preferredServer: preferredProvider || "local-llm-server",
          preferredModel: "gpt-oss-20b"
        }
      )

      if (llmResponse.error) {
        console.error(`[Patent Generation] Failed to generate ${section}:`, llmResponse.error)
        return NextResponse.json({
          error: `Failed to generate ${section}: ${llmResponse.error}`,
          partialResult: { sections, claims },
          server: generationServer,
          model: generationModel
        }, { status: 503 })
      }

      // Capture generation metadata from the first successful response
      if (llmResponse.server) generationServer = llmResponse.server
      if (llmResponse.model) generationModel = llmResponse.model

      console.log(`[Patent Generation] Generated ${section} using ${generationServer}/${generationModel}`)

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
        server: generationServer,
        model: generationModel
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

/**
 * PATCH endpoint - Generate content for a specific patent section and save to database
 * Accepts patentId and section to generate, uses invention description from the patent record
 */
export async function PATCH(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify authentication
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      patentId,
      section,
      preferredServer,
      preferredModel
    } = body as {
      patentId: string
      section: PatentSectionType | "claims" | "all"
      preferredServer?: string
      preferredModel?: string
    }

    // Validate required fields
    if (!patentId) {
      return NextResponse.json({
        error: "patentId is required"
      }, { status: 400 })
    }

    if (!section) {
      return NextResponse.json({
        error: "section is required (abstract, background, summary, detailedDescription, claims, or all)"
      }, { status: 400 })
    }

    // Get the patent from storage (scoped to user)
    const patent = getPatent(patentId, session.user.id)
    if (!patent) {
      return NextResponse.json({
        error: `Patent with ID ${patentId} not found`
      }, { status: 404 })
    }

    // Build generation request from patent data
    const generationRequest: GenerationRequest = {
      inventionTitle: patent.title,
      inventionDescription: patent.inventionDescription.summary || "",
      technicalField: patent.inventionDescription.technicalField || "General Technology",
      problemSolved: patent.inventionDescription.problemSolved || "",
      keyFeatures: patent.inventionDescription.advantages || [],
      embodiments: patent.inventionDescription.embodiments,
      priorArtNotes: patent.priorArtSearchNotes,
      sectionToGenerate: section,
      preferredProvider: preferredServer
    }

    // Validate we have enough data to generate
    if (!generationRequest.inventionDescription) {
      return NextResponse.json({
        error: "Patent invention description is required for generation"
      }, { status: 400 })
    }

    if (!generationRequest.keyFeatures?.length) {
      // Fall back to using embodiments or a generic description
      generationRequest.keyFeatures = generationRequest.embodiments || ["Novel technical solution"]
    }

    if (!generationRequest.problemSolved) {
      generationRequest.problemSolved = "Addresses technical limitations in the field"
    }

    // Track generation metadata
    let generationServer = preferredServer || "local-llm-server"
    let generationModel = preferredModel || "gpt-oss-20b"

    // Determine which sections to generate
    const sectionsToGenerate: (PatentSectionType | "claims")[] =
      section === "all"
        ? ["abstract", "background", "summary", "detailedDescription", "claims"]
        : [section]

    const generatedSections: Record<string, string> = {}
    const generatedClaims: Array<{
      number: number
      type: "independent" | "dependent"
      dependsOn?: number
      text: string
    }> = []
    const allSuggestions: string[] = []
    const allWarnings: string[] = []

    // Generate each section
    for (const sectionType of sectionsToGenerate) {
      const prompt = generateSectionPrompt(sectionType, generationRequest)

      console.log(`[Patent Generation] Generating ${sectionType} for patent ${patentId}...`)

      const llmResponse = await generateWithLocalLLM(
        USPTO_FORMAT_SYSTEM_PROMPT,
        prompt,
        {
          temperature: 0.4,
          max_tokens: 8192,
          preferredServer: generationServer,
          preferredModel: generationModel
        }
      )

      if (llmResponse.error) {
        console.error(`[Patent Generation] Failed to generate ${sectionType}:`, llmResponse.error)
        return NextResponse.json({
          error: `Failed to generate ${sectionType}: ${llmResponse.error}`,
          generatedSections,
          generatedClaims
        }, { status: 503 })
      }

      // Capture generation metadata
      if (llmResponse.server) generationServer = llmResponse.server
      if (llmResponse.model) generationModel = llmResponse.model

      console.log(`[Patent Generation] Generated ${sectionType} using ${generationServer}/${generationModel}`)

      if (sectionType === "claims") {
        const parsed = parseClaims(llmResponse.content)
        for (const claim of parsed.claims) {
          generatedClaims.push({
            number: claim.number,
            type: claim.type,
            dependsOn: claim.dependsOn,
            text: claim.content
          })
        }
        if (parsed.suggestions) allSuggestions.push(...parsed.suggestions)
        if (parsed.warnings) allWarnings.push(...parsed.warnings)
      } else {
        const parsed = parseSection(llmResponse.content)
        generatedSections[sectionType] = parsed.content
        if (parsed.suggestions) allSuggestions.push(...parsed.suggestions)
        if (parsed.warnings) allWarnings.push(...parsed.warnings)
      }
    }

    // Prepare updates to the patent
    const updates: Partial<PatentResearch> = {}

    // Update invention description with generated content
    if (Object.keys(generatedSections).length > 0) {
      updates.inventionDescription = {
        ...patent.inventionDescription
      }

      // Map generated sections to patent fields
      if (generatedSections.abstract) {
        updates.inventionDescription.summary = generatedSections.abstract
      }
      if (generatedSections.background) {
        updates.inventionDescription.background = generatedSections.background
      }
      if (generatedSections.detailedDescription) {
        updates.inventionDescription.solutionDescription = generatedSections.detailedDescription
      }
    }

    // Update claims if generated
    if (generatedClaims.length > 0) {
      const now = new Date().toISOString()
      updates.claims = generatedClaims.map((claim, index) => ({
        id: `claim-${Date.now()}-${index}`,
        number: claim.number,
        type: claim.type,
        dependsOn: claim.dependsOn,
        text: claim.text,
        status: "draft" as const,
        createdAt: now,
        updatedAt: now
      }))
    }

    // Save updates to the patent (scoped to user)
    const updatedPatent = updatePatent(patentId, updates, session.user.id)

    if (!updatedPatent) {
      return NextResponse.json({
        error: "Failed to save generated content to patent"
      }, { status: 500 })
    }

    console.log(`[Patent Generation] Successfully updated patent ${patentId}`)

    return NextResponse.json({
      success: true,
      patentId,
      generatedSections: Object.keys(generatedSections),
      claimsCount: generatedClaims.length,
      suggestions: allSuggestions,
      warnings: allWarnings,
      generatedBy: {
        server: generationServer,
        model: generationModel
      },
      generationDuration: (Date.now() - startTime) / 1000,
      updatedPatent
    })

  } catch (error) {
    console.error("[Patent Generation] PATCH error:", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Patent generation failed"
    }, { status: 500 })
  }
}

// GET endpoint to export patent as formatted document
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const patentId = searchParams.get("patentId")
    const format = searchParams.get("format") || "text"

    if (!patentId) {
      return NextResponse.json({
        availableFormats: ["text", "markdown", "docx", "pdf"],
        note: "Provide patentId query parameter to export a specific patent"
      })
    }

    const patent = getPatent(patentId, session.user.id)
    if (!patent) {
      return NextResponse.json({
        error: `Patent with ID ${patentId} not found`
      }, { status: 404 })
    }

    // For now, return patent data in the requested format
    if (format === "markdown") {
      const markdown = formatPatentAsMarkdown(patent)
      return new NextResponse(markdown, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="${patent.title.replace(/[^a-z0-9]/gi, '_')}.md"`
        }
      })
    }

    return NextResponse.json({
      patent,
      availableFormats: ["text", "markdown", "docx", "pdf"],
      selectedFormat: format
    })
  } catch (error) {
    console.error("[Patent Generate API] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export patent" },
      { status: 500 }
    )
  }
}

/**
 * Format patent as Markdown for export
 */
function formatPatentAsMarkdown(patent: PatentResearch): string {
  const lines: string[] = []

  lines.push(`# ${patent.title}`)
  lines.push("")
  lines.push(`**Status:** ${patent.status}`)
  lines.push(`**Technical Field:** ${patent.inventionDescription.technicalField || "N/A"}`)
  lines.push("")

  if (patent.inventionDescription.summary) {
    lines.push("## Abstract")
    lines.push("")
    lines.push(patent.inventionDescription.summary)
    lines.push("")
  }

  if (patent.inventionDescription.background) {
    lines.push("## Background of the Invention")
    lines.push("")
    lines.push(patent.inventionDescription.background)
    lines.push("")
  }

  if (patent.inventionDescription.problemSolved) {
    lines.push("## Problem Solved")
    lines.push("")
    lines.push(patent.inventionDescription.problemSolved)
    lines.push("")
  }

  if (patent.inventionDescription.solutionDescription) {
    lines.push("## Detailed Description")
    lines.push("")
    lines.push(patent.inventionDescription.solutionDescription)
    lines.push("")
  }

  if (patent.inventionDescription.advantages?.length) {
    lines.push("## Advantages")
    lines.push("")
    for (const advantage of patent.inventionDescription.advantages) {
      lines.push(`- ${advantage}`)
    }
    lines.push("")
  }

  if (patent.inventionDescription.embodiments?.length) {
    lines.push("## Embodiments")
    lines.push("")
    for (const embodiment of patent.inventionDescription.embodiments) {
      lines.push(`- ${embodiment}`)
    }
    lines.push("")
  }

  if (patent.claims.length > 0) {
    lines.push("## Claims")
    lines.push("")
    for (const claim of patent.claims) {
      const claimPrefix = claim.type === "dependent"
        ? `${claim.number}. (Depends on claim ${claim.dependsOn})`
        : `${claim.number}.`
      lines.push(`${claimPrefix} ${claim.text}`)
      lines.push("")
    }
  }

  if (patent.priorArt.length > 0) {
    lines.push("## Prior Art References")
    lines.push("")
    for (const art of patent.priorArt) {
      lines.push(`- **${art.title}**${art.patentNumber ? ` (${art.patentNumber})` : ""}`)
      if (art.abstract) {
        lines.push(`  ${art.abstract.substring(0, 200)}${art.abstract.length > 200 ? "..." : ""}`)
      }
    }
    lines.push("")
  }

  lines.push("---")
  lines.push(`*Generated by Claudia Patent System on ${new Date().toISOString()}*`)

  return lines.join("\n")
}
