/**
 * Business Development Export API
 * Export business dev documents in various formats
 *
 * GET: Export business dev as downloadable document (new API)
 * POST: Export with custom data (legacy API)
 *
 * Supported formats: PDF, Markdown, DOCX, HTML, JSON
 */

import { NextRequest, NextResponse } from "next/server"
import { getBusinessDev, exportBusinessDevPDF } from "@/lib/data/business-dev"
import { getProject } from "@/lib/data/projects"
import type { BusinessDev } from "@/lib/data/types"
import { verifyApiAuth, unauthorizedResponse } from "@/lib/auth/api-helpers"

export type ExportFormat = "pdf" | "markdown" | "md" | "docx" | "html" | "json"

// ============ GET Handler (New API) ============

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyApiAuth()
    if (!authResult) {
      return unauthorizedResponse()
    }
    const userId = authResult.user.id

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const format = (searchParams.get("format") || "pdf").toLowerCase() as ExportFormat

    // Optional export options
    const includeFinancials = searchParams.get("includeFinancials") !== "false"
    const includeMarketAnalysis = searchParams.get("includeMarketAnalysis") !== "false"
    const includeGoToMarket = searchParams.get("includeGoToMarket") !== "false"
    const includeRisks = searchParams.get("includeRisks") !== "false"
    const companyName = searchParams.get("companyName") || "Claudia"

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      )
    }

    const project = getProject(projectId, userId)
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    const businessDev = getBusinessDev(projectId, userId)
    if (!businessDev) {
      return NextResponse.json(
        { error: "No business dev document found for this project" },
        { status: 404 }
      )
    }

    const filename = generateFilename(project.name, format)

    switch (format) {
      case "pdf":
      case "html": {
        const result = exportBusinessDevPDF(projectId, {
          includeFinancials,
          includeMarketAnalysis,
          includeGoToMarket,
          includeRisks,
          companyName,
          userId
        })

        if (!result) {
          return NextResponse.json(
            { error: "Failed to generate export" },
            { status: 500 }
          )
        }

        if (format === "html") {
          return new NextResponse(result.html, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Content-Disposition": `attachment; filename="${filename}"`
            }
          })
        }

        // For PDF, return HTML that can be converted client-side using html2pdf or similar
        return NextResponse.json({
          html: result.html,
          filename: filename,
          format: "pdf",
          message: "Use html2pdf.js or similar library to convert HTML to PDF client-side"
        })
      }

      case "markdown":
      case "md": {
        const markdown = formatBusinessDevAsMarkdown(businessDev, project.name)
        return new NextResponse(markdown, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`
          }
        })
      }

      case "docx": {
        // Generate DOCX-compatible structured data
        const docxData = formatBusinessDevForDocx(businessDev, project.name)
        return NextResponse.json({
          ...docxData,
          filename,
          format: "docx",
          message: "Use docx library to generate DOCX from this structured data"
        })
      }

      case "json": {
        return NextResponse.json({
          projectName: project.name,
          businessDev,
          exportedAt: new Date().toISOString()
        }, {
          headers: {
            "Content-Disposition": `attachment; filename="${filename}"`
          }
        })
      }

      default:
        return NextResponse.json(
          { error: `Unsupported format: ${format}. Supported: pdf, html, markdown, md, docx, json` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("Error exporting business dev:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export business dev" },
      { status: 500 }
    )
  }
}

// ============ POST Handler (Legacy API) ============

interface LegacyBusinessDevData {
  executiveSummary: string
  valueProposition: string
  targetMarket: string
  competitiveAdvantage: string
  features: Array<{
    name: string
    description: string
    priority: string
    status: string
    estimatedValue?: string
  }>
  marketSegments: Array<{
    name: string
    percentage: number
    description?: string
  }>
  revenueStreams: Array<{
    name: string
    description: string
    estimatedRevenue: string
    timeframe: string
    confidence: string
  }>
  proForma: {
    revenue: Array<{
      category: string
      year1: number
      year2: number
      year3: number
    }>
    expenses: Array<{
      category: string
      year1: number
      year2: number
      year3: number
    }>
    summary: {
      year1Profit: number
      year2Profit: number
      year3Profit: number
      breakEvenMonth: number
    }
  }
  risks: string[]
  opportunities: string[]
  generatedAt?: string
  generatedBy?: string
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyApiAuth()
    if (!authResult) {
      return unauthorizedResponse()
    }

    const { projectName, data, format, section } = await request.json()

    if (!projectName || !data) {
      return NextResponse.json(
        { error: "Project name and data are required" },
        { status: 400 }
      )
    }

    const businessData = data as LegacyBusinessDevData

    // Generate Markdown content (full or section-specific)
    const markdownContent = section
      ? generateSectionMarkdown(projectName, businessData, section)
      : generateLegacyMarkdown(projectName, businessData)

    const sectionSuffix = section ? `-${section}` : ""

    if (format === "md" || format === "markdown") {
      return new NextResponse(markdownContent, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="${projectName.replace(/\s+/g, "-")}${sectionSuffix}-business-plan.md"`
        }
      })
    }

    if (format === "pdf" || format === "html") {
      const htmlContent = section
        ? generateSectionHtml(projectName, businessData, section)
        : generateLegacyHtmlForPdf(projectName, businessData)

      return new NextResponse(htmlContent, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `attachment; filename="${projectName.replace(/\s+/g, "-")}${sectionSuffix}-business-plan.html"`
        }
      })
    }

    return NextResponse.json(
      { error: "Invalid format. Use 'md', 'markdown', 'html', or 'pdf'" },
      { status: 400 }
    )

  } catch (error) {
    console.error("[business-dev/export] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export" },
      { status: 500 }
    )
  }
}

// ============ Helper Functions ============

function generateFilename(projectName: string, format: ExportFormat): string {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-")
  const date = new Date().toISOString().split("T")[0]

  const extensions: Record<ExportFormat, string> = {
    pdf: "pdf",
    html: "html",
    markdown: "md",
    md: "md",
    docx: "docx",
    json: "json"
  }

  return `${slug}-business-plan-${date}.${extensions[format]}`
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

// ============ New BusinessDev Format Functions ============

function formatBusinessDevAsMarkdown(businessDev: BusinessDev, projectName: string): string {
  const lines: string[] = []

  lines.push(`# ${projectName} - Business Development Plan`)
  lines.push("")
  lines.push(`**Generated:** ${new Date(businessDev.createdAt).toLocaleDateString()}`)
  lines.push(`**Last Updated:** ${new Date(businessDev.updatedAt).toLocaleDateString()}`)
  lines.push(`**Status:** ${businessDev.status}`)
  lines.push("")

  // Table of Contents
  lines.push("## Table of Contents")
  lines.push("")
  lines.push("1. [Executive Summary](#executive-summary)")
  lines.push("2. [Features](#features)")
  lines.push("3. [Market Analysis](#market-analysis)")
  lines.push("4. [Monetization Strategy](#monetization-strategy)")
  lines.push("5. [Financial Projections](#financial-projections-pro-forma)")
  if (businessDev.goToMarket) {
    lines.push("6. [Go-to-Market Strategy](#go-to-market-strategy)")
  }
  if (businessDev.risks && businessDev.risks.risks.length > 0) {
    lines.push(`${businessDev.goToMarket ? "7" : "6"}. [Risk Analysis](#risk-analysis)`)
  }
  lines.push("")
  lines.push("---")
  lines.push("")

  // Executive Summary
  lines.push("## Executive Summary")
  lines.push("")
  lines.push("### Overview")
  lines.push(businessDev.executiveSummary.overview)
  lines.push("")
  lines.push("### Problem Statement")
  lines.push(businessDev.executiveSummary.problem)
  lines.push("")
  lines.push("### Our Solution")
  lines.push(businessDev.executiveSummary.solution)
  lines.push("")
  lines.push("### Target Market")
  lines.push(businessDev.executiveSummary.targetMarket)
  lines.push("")
  lines.push("### Unique Value Proposition")
  lines.push(businessDev.executiveSummary.uniqueValue)
  lines.push("")

  // Features
  lines.push("## Features")
  lines.push("")
  for (const feature of businessDev.features) {
    lines.push(`### ${feature.name}`)
    lines.push("")
    lines.push(`**Priority:** ${formatPriority(feature.priority)}`)
    lines.push("")
    lines.push(feature.description)
    lines.push("")
    lines.push(`> **User Benefit:** ${feature.userBenefit}`)
    lines.push("")
  }

  // Market Analysis
  lines.push("## Market Analysis")
  lines.push("")
  lines.push("### Market Size")
  lines.push(businessDev.marketAnalysis.marketSize)
  lines.push("")
  lines.push("### Target Audience")
  lines.push(businessDev.marketAnalysis.targetAudience)
  lines.push("")

  if (businessDev.marketAnalysis.marketTrends.length > 0) {
    lines.push("### Market Trends")
    lines.push("")
    for (const trend of businessDev.marketAnalysis.marketTrends) {
      lines.push(`- ${trend}`)
    }
    lines.push("")
  }

  lines.push("### Competitive Landscape")
  lines.push("")
  for (const competitor of businessDev.marketAnalysis.competitors) {
    lines.push(`#### ${competitor.name}`)
    lines.push("")
    if (competitor.description) {
      lines.push(competitor.description)
      lines.push("")
    }
    if (competitor.strengths.length > 0) {
      lines.push("**Strengths:**")
      for (const strength of competitor.strengths) {
        lines.push(`- ${strength}`)
      }
      lines.push("")
    }
    if (competitor.weaknesses.length > 0) {
      lines.push("**Weaknesses:**")
      for (const weakness of competitor.weaknesses) {
        lines.push(`- ${weakness}`)
      }
      lines.push("")
    }
  }

  lines.push("### Key Differentiators")
  lines.push("")
  for (const diff of businessDev.marketAnalysis.differentiators) {
    lines.push(`- ${diff}`)
  }
  lines.push("")

  // Monetization
  lines.push("## Monetization Strategy")
  lines.push("")
  lines.push(`**Business Model:** ${businessDev.monetization.model.toUpperCase()}`)
  lines.push("")
  lines.push("### Pricing Strategy")
  lines.push(businessDev.monetization.pricing)
  lines.push("")

  if (businessDev.monetization.pricingTiers && businessDev.monetization.pricingTiers.length > 0) {
    lines.push("### Pricing Tiers")
    lines.push("")
    lines.push("| Tier | Price | Features |")
    lines.push("|------|-------|----------|")
    for (const tier of businessDev.monetization.pricingTiers) {
      lines.push(`| **${tier.name}** | ${tier.price} | ${tier.features.join(", ")} |`)
    }
    lines.push("")
  }

  lines.push("### Revenue Streams")
  lines.push("")
  for (const stream of businessDev.monetization.revenueStreams) {
    lines.push(`- ${stream}`)
  }
  lines.push("")

  // Pro Forma
  lines.push("## Financial Projections (Pro Forma)")
  lines.push("")
  lines.push("### Revenue Forecast")
  lines.push("")
  lines.push("| Year | Projected Revenue |")
  lines.push("|------|-------------------|")
  lines.push(`| Year 1 | ${businessDev.proForma.yearOneRevenue} |`)
  lines.push(`| Year 2 | ${businessDev.proForma.yearTwoRevenue} |`)
  lines.push(`| Year 3 | ${businessDev.proForma.yearThreeRevenue} |`)
  lines.push("")

  lines.push("### Operating Expenses")
  lines.push("")
  lines.push("| Category | Amount | Frequency |")
  lines.push("|----------|--------|-----------|")
  for (const expense of businessDev.proForma.expenses) {
    lines.push(`| ${expense.category} | ${expense.amount} | ${expense.frequency} |`)
  }
  lines.push("")

  lines.push("### Key Metrics")
  lines.push("")
  lines.push(`- **Expected Profit Margin:** ${businessDev.proForma.profitMargin}`)
  lines.push(`- **Break-Even Point:** ${businessDev.proForma.breakEvenPoint}`)
  lines.push("")

  lines.push("### Key Assumptions")
  lines.push("")
  for (const assumption of businessDev.proForma.assumptions) {
    lines.push(`- ${assumption}`)
  }
  lines.push("")

  // Go-to-Market
  if (businessDev.goToMarket) {
    lines.push("## Go-to-Market Strategy")
    lines.push("")
    lines.push("### Launch Strategy")
    lines.push(businessDev.goToMarket.launchStrategy)
    lines.push("")

    lines.push("### Marketing Channels")
    lines.push("")
    for (const channel of businessDev.goToMarket.marketingChannels) {
      lines.push(`- ${channel}`)
    }
    lines.push("")

    lines.push("### Strategic Partnerships")
    lines.push("")
    for (const partnership of businessDev.goToMarket.partnerships) {
      lines.push(`- ${partnership}`)
    }
    lines.push("")

    lines.push("### Key Milestones")
    lines.push("")
    lines.push("| Milestone | Target Date | Description |")
    lines.push("|-----------|-------------|-------------|")
    for (const milestone of businessDev.goToMarket.milestones) {
      lines.push(`| ${milestone.name} | ${milestone.date} | ${milestone.description} |`)
    }
    lines.push("")
  }

  // Risk Analysis
  if (businessDev.risks && businessDev.risks.risks.length > 0) {
    lines.push("## Risk Analysis")
    lines.push("")
    lines.push("| Category | Risk | Likelihood | Impact | Mitigation Strategy |")
    lines.push("|----------|------|------------|--------|---------------------|")
    for (const risk of businessDev.risks.risks) {
      lines.push(`| ${capitalizeFirst(risk.category)} | ${risk.description} | ${capitalizeFirst(risk.likelihood)} | ${capitalizeFirst(risk.impact)} | ${risk.mitigation} |`)
    }
    lines.push("")
  }

  // Footer
  lines.push("---")
  lines.push("")
  lines.push(`*Generated by Claudia Coder | ${businessDev.generatedBy.server}:${businessDev.generatedBy.model}*`)
  lines.push("")
  lines.push(`*Export Date: ${new Date().toLocaleDateString()}*`)

  return lines.join("\n")
}

function formatBusinessDevForDocx(businessDev: BusinessDev, projectName: string): {
  title: string
  sections: Array<{
    heading: string
    level: 1 | 2 | 3
    content?: string
    list?: string[]
    table?: { headers: string[]; rows: string[][] }
  }>
} {
  const sections: Array<{
    heading: string
    level: 1 | 2 | 3
    content?: string
    list?: string[]
    table?: { headers: string[]; rows: string[][] }
  }> = []

  // Title
  sections.push({
    heading: `${projectName} - Business Development Plan`,
    level: 1
  })

  // Executive Summary
  sections.push({ heading: "Executive Summary", level: 2 })
  sections.push({ heading: "Overview", level: 3, content: businessDev.executiveSummary.overview })
  sections.push({ heading: "Problem", level: 3, content: businessDev.executiveSummary.problem })
  sections.push({ heading: "Solution", level: 3, content: businessDev.executiveSummary.solution })
  sections.push({ heading: "Target Market", level: 3, content: businessDev.executiveSummary.targetMarket })
  sections.push({ heading: "Unique Value", level: 3, content: businessDev.executiveSummary.uniqueValue })

  // Features
  sections.push({ heading: "Features", level: 2 })
  for (const feature of businessDev.features) {
    sections.push({
      heading: feature.name,
      level: 3,
      content: `${feature.description}\n\nPriority: ${feature.priority}\nUser Benefit: ${feature.userBenefit}`
    })
  }

  // Market Analysis
  sections.push({ heading: "Market Analysis", level: 2 })
  sections.push({ heading: "Market Size", level: 3, content: businessDev.marketAnalysis.marketSize })
  sections.push({ heading: "Target Audience", level: 3, content: businessDev.marketAnalysis.targetAudience })
  sections.push({ heading: "Differentiators", level: 3, list: businessDev.marketAnalysis.differentiators })
  sections.push({ heading: "Market Trends", level: 3, list: businessDev.marketAnalysis.marketTrends })

  // Monetization
  sections.push({ heading: "Monetization Strategy", level: 2 })
  sections.push({ heading: "Business Model", level: 3, content: businessDev.monetization.model })
  sections.push({ heading: "Pricing", level: 3, content: businessDev.monetization.pricing })
  sections.push({ heading: "Revenue Streams", level: 3, list: businessDev.monetization.revenueStreams })

  // Pro Forma
  sections.push({ heading: "Financial Projections", level: 2 })
  sections.push({
    heading: "Revenue Forecast",
    level: 3,
    table: {
      headers: ["Year", "Revenue"],
      rows: [
        ["Year 1", businessDev.proForma.yearOneRevenue],
        ["Year 2", businessDev.proForma.yearTwoRevenue],
        ["Year 3", businessDev.proForma.yearThreeRevenue]
      ]
    }
  })
  sections.push({
    heading: "Expenses",
    level: 3,
    table: {
      headers: ["Category", "Amount", "Frequency"],
      rows: businessDev.proForma.expenses.map(e => [e.category, e.amount, e.frequency])
    }
  })
  sections.push({
    heading: "Key Metrics",
    level: 3,
    content: `Profit Margin: ${businessDev.proForma.profitMargin}\nBreak-Even: ${businessDev.proForma.breakEvenPoint}`
  })

  // Go-to-Market
  if (businessDev.goToMarket) {
    sections.push({ heading: "Go-to-Market Strategy", level: 2 })
    sections.push({ heading: "Launch Strategy", level: 3, content: businessDev.goToMarket.launchStrategy })
    sections.push({ heading: "Marketing Channels", level: 3, list: businessDev.goToMarket.marketingChannels })
    sections.push({ heading: "Partnerships", level: 3, list: businessDev.goToMarket.partnerships })
  }

  // Risks
  if (businessDev.risks && businessDev.risks.risks.length > 0) {
    sections.push({ heading: "Risk Analysis", level: 2 })
    sections.push({
      heading: "Risk Assessment",
      level: 3,
      table: {
        headers: ["Category", "Risk", "Likelihood", "Impact", "Mitigation"],
        rows: businessDev.risks.risks.map(r => [r.category, r.description, r.likelihood, r.impact, r.mitigation])
      }
    })
  }

  return { title: `${projectName} - Business Development Plan`, sections }
}

function formatPriority(priority: string): string {
  const badges: Record<string, string> = {
    "must-have": "Must Have",
    "should-have": "Should Have",
    "nice-to-have": "Nice to Have"
  }
  return badges[priority] || priority
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// ============ Section-Specific Export Functions ============

type ExportSection = "executive" | "market" | "monetization" | "proforma" | "risks" | "features"

function generateSectionMarkdown(projectName: string, data: LegacyBusinessDevData, section: string): string {
  const generatedDate = data.generatedAt ? new Date(data.generatedAt).toLocaleDateString() : new Date().toLocaleDateString()

  const header = `# ${projectName} - ${getSectionTitle(section)}

*Generated: ${generatedDate}*
${data.generatedBy ? `*Model: ${data.generatedBy}*` : ""}

---

`

  switch (section as ExportSection) {
    case "executive":
      return header + `## Executive Summary

${data.executiveSummary}

## Value Proposition

${data.valueProposition}

## Target Market

${data.targetMarket}

## Competitive Advantage

${data.competitiveAdvantage}
`

    case "features":
      return header + `## Key Features

| Feature | Description | Priority | Status | Est. Value |
|---------|-------------|----------|--------|------------|
${data.features.map(f => `| ${f.name} | ${f.description} | ${f.priority} | ${f.status} | ${f.estimatedValue || "-"} |`).join("\n")}
`

    case "market":
      return header + `## Market Analysis

### Market Segments

| Segment | Share | Description |
|---------|-------|-------------|
${data.marketSegments.map(s => `| ${s.name} | ${s.percentage}% | ${s.description || "-"} |`).join("\n")}
`

    case "monetization":
      return header + `## Monetization Strategy

### Revenue Streams

| Stream | Description | Est. Revenue | Timeframe | Confidence |
|--------|-------------|--------------|-----------|------------|
${data.revenueStreams.map(r => `| ${r.name} | ${r.description} | ${r.estimatedRevenue} | ${r.timeframe} | ${r.confidence} |`).join("\n")}
`

    case "proforma":
      return header + `## Financial Projections (Pro Forma)

### Revenue

| Category | Year 1 | Year 2 | Year 3 |
|----------|--------|--------|--------|
${data.proForma.revenue.map(r => `| ${r.category} | ${formatCurrency(r.year1)} | ${formatCurrency(r.year2)} | ${formatCurrency(r.year3)} |`).join("\n")}
| **Total** | **${formatCurrency(data.proForma.revenue.reduce((s, r) => s + r.year1, 0))}** | **${formatCurrency(data.proForma.revenue.reduce((s, r) => s + r.year2, 0))}** | **${formatCurrency(data.proForma.revenue.reduce((s, r) => s + r.year3, 0))}** |

### Expenses

| Category | Year 1 | Year 2 | Year 3 |
|----------|--------|--------|--------|
${data.proForma.expenses.map(e => `| ${e.category} | ${formatCurrency(e.year1)} | ${formatCurrency(e.year2)} | ${formatCurrency(e.year3)} |`).join("\n")}
| **Total** | **${formatCurrency(data.proForma.expenses.reduce((s, e) => s + e.year1, 0))}** | **${formatCurrency(data.proForma.expenses.reduce((s, e) => s + e.year2, 0))}** | **${formatCurrency(data.proForma.expenses.reduce((s, e) => s + e.year3, 0))}** |

### Summary

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Net Profit | ${formatCurrency(data.proForma.summary.year1Profit)} | ${formatCurrency(data.proForma.summary.year2Profit)} | ${formatCurrency(data.proForma.summary.year3Profit)} |

**Break-Even Point:** Month ${data.proForma.summary.breakEvenMonth}
`

    case "risks":
      return header + `## Risk Assessment

${data.risks.map(r => `- ${r}`).join("\n")}

---

## Growth Opportunities

${data.opportunities.map(o => `- ${o}`).join("\n")}
`

    default:
      return header + "Section not found"
  }
}

function getSectionTitle(section: string): string {
  const titles: Record<string, string> = {
    executive: "Executive Summary",
    features: "Key Features",
    market: "Market Analysis",
    monetization: "Monetization Strategy",
    proforma: "Financial Projections",
    risks: "Risk & Opportunities Analysis"
  }
  return titles[section] || section
}

function generateSectionHtml(projectName: string, data: LegacyBusinessDevData, section: string): string {
  const generatedDate = data.generatedAt ? new Date(data.generatedAt).toLocaleDateString() : new Date().toLocaleDateString()

  const baseStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; padding: 40px; max-width: 900px; margin: 0 auto; background: #fff; }
    h1 { font-size: 28px; color: #111; margin-bottom: 8px; border-bottom: 3px solid #8B5CF6; padding-bottom: 12px; }
    h2 { font-size: 20px; color: #333; margin-top: 32px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
    h3 { font-size: 16px; color: #444; margin-top: 20px; margin-bottom: 12px; }
    p { margin-bottom: 12px; color: #444; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    th, td { padding: 10px 12px; text-align: left; border: 1px solid #e5e5e5; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .summary-card { background: #f8f8f8; padding: 16px; border-radius: 8px; text-align: center; }
    .summary-card .label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .summary-card .value { font-size: 18px; font-weight: 600; color: #333; }
    .summary-card .value.positive { color: #10B981; }
    .summary-card .value.negative { color: #EF4444; }
    ul { margin: 12px 0; padding-left: 24px; }
    li { margin-bottom: 8px; color: #444; }
    .risk { color: #EF4444; }
    .opportunity { color: #10B981; }
    .section { margin-bottom: 32px; }
    .highlight-box { background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%); color: white; padding: 24px; border-radius: 12px; margin: 24px 0; }
    .highlight-box h3 { color: white; margin-top: 0; }
    .highlight-box p { color: rgba(255,255,255,0.9); margin-bottom: 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center; }
    @media print { body { padding: 0; } .section { page-break-inside: avoid; } }
  `

  let content = ""

  switch (section as ExportSection) {
    case "executive":
      content = `
        <div class="section"><h2>Executive Summary</h2><p>${data.executiveSummary.replace(/\n/g, "</p><p>")}</p></div>
        <div class="highlight-box"><h3>Value Proposition</h3><p>${data.valueProposition}</p></div>
        <div class="section"><h2>Target Market</h2><p>${data.targetMarket}</p></div>
        <div class="section"><h2>Competitive Advantage</h2><p>${data.competitiveAdvantage}</p></div>
      `
      break

    case "features":
      content = `
        <div class="section">
          <h2>Key Features</h2>
          <table>
            <thead><tr><th>Feature</th><th>Description</th><th>Priority</th><th>Status</th><th>Est. Value</th></tr></thead>
            <tbody>${data.features.map(f => `<tr><td><strong>${f.name}</strong></td><td>${f.description}</td><td>${f.priority}</td><td>${f.status}</td><td>${f.estimatedValue || "-"}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `
      break

    case "market":
      content = `
        <div class="section">
          <h2>Market Analysis</h2>
          <table>
            <thead><tr><th>Segment</th><th>Share</th><th>Description</th></tr></thead>
            <tbody>${data.marketSegments.map(s => `<tr><td><strong>${s.name}</strong></td><td>${s.percentage}%</td><td>${s.description || "-"}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `
      break

    case "monetization":
      content = `
        <div class="section">
          <h2>Monetization Strategy</h2>
          <table>
            <thead><tr><th>Stream</th><th>Description</th><th>Est. Revenue</th><th>Timeframe</th><th>Confidence</th></tr></thead>
            <tbody>${data.revenueStreams.map(r => `<tr><td><strong>${r.name}</strong></td><td>${r.description}</td><td>${r.estimatedRevenue}</td><td>${r.timeframe}</td><td>${r.confidence}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `
      break

    case "proforma":
      content = `
        <div class="section">
          <h2>Financial Projections</h2>
          <div class="summary-cards">
            <div class="summary-card"><div class="label">Year 1</div><div class="value ${data.proForma.summary.year1Profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.proForma.summary.year1Profit)}</div></div>
            <div class="summary-card"><div class="label">Year 2</div><div class="value ${data.proForma.summary.year2Profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.proForma.summary.year2Profit)}</div></div>
            <div class="summary-card"><div class="label">Year 3</div><div class="value ${data.proForma.summary.year3Profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.proForma.summary.year3Profit)}</div></div>
            <div class="summary-card"><div class="label">Break Even</div><div class="value">Month ${data.proForma.summary.breakEvenMonth}</div></div>
          </div>
          <h3>Revenue</h3>
          <table>
            <thead><tr><th>Category</th><th>Year 1</th><th>Year 2</th><th>Year 3</th></tr></thead>
            <tbody>${data.proForma.revenue.map(r => `<tr><td>${r.category}</td><td>${formatCurrency(r.year1)}</td><td>${formatCurrency(r.year2)}</td><td>${formatCurrency(r.year3)}</td></tr>`).join("")}</tbody>
          </table>
          <h3>Expenses</h3>
          <table>
            <thead><tr><th>Category</th><th>Year 1</th><th>Year 2</th><th>Year 3</th></tr></thead>
            <tbody>${data.proForma.expenses.map(e => `<tr><td>${e.category}</td><td>${formatCurrency(e.year1)}</td><td>${formatCurrency(e.year2)}</td><td>${formatCurrency(e.year3)}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `
      break

    case "risks":
      content = `
        <div class="section"><h2>Risk Assessment</h2><ul>${data.risks.map(r => `<li class="risk">${r}</li>`).join("")}</ul></div>
        <div class="section"><h2>Growth Opportunities</h2><ul>${data.opportunities.map(o => `<li class="opportunity">${o}</li>`).join("")}</ul></div>
      `
      break

    default:
      content = "<p>Section not found</p>"
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - ${getSectionTitle(section)}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <h1>${projectName}</h1>
  <p class="meta">${getSectionTitle(section)} - Generated: ${generatedDate}</p>
  ${content}
  <div class="footer"><p>Generated by Claudia Coder Business Development Analysis</p></div>
</body>
</html>`
}

// ============ Legacy Format Functions ============

function generateLegacyMarkdown(projectName: string, data: LegacyBusinessDevData): string {
  const generatedDate = data.generatedAt ? new Date(data.generatedAt).toLocaleDateString() : new Date().toLocaleDateString()

  return `# ${projectName} - Business Development Plan

*Generated: ${generatedDate}*
${data.generatedBy ? `*Model: ${data.generatedBy}*` : ""}

---

## Executive Summary

${data.executiveSummary}

## Value Proposition

${data.valueProposition}

## Target Market

${data.targetMarket}

## Competitive Advantage

${data.competitiveAdvantage}

---

## Key Features

| Feature | Description | Priority | Status | Est. Value |
|---------|-------------|----------|--------|------------|
${data.features.map(f => `| ${f.name} | ${f.description} | ${f.priority} | ${f.status} | ${f.estimatedValue || "-"} |`).join("\n")}

---

## Market Analysis

### Market Segments

| Segment | Share | Description |
|---------|-------|-------------|
${data.marketSegments.map(s => `| ${s.name} | ${s.percentage}% | ${s.description || "-"} |`).join("\n")}

---

## Monetization Strategy

### Revenue Streams

| Stream | Description | Est. Revenue | Timeframe | Confidence |
|--------|-------------|--------------|-----------|------------|
${data.revenueStreams.map(r => `| ${r.name} | ${r.description} | ${r.estimatedRevenue} | ${r.timeframe} | ${r.confidence} |`).join("\n")}

---

## Financial Projections (Pro Forma)

### Revenue

| Category | Year 1 | Year 2 | Year 3 |
|----------|--------|--------|--------|
${data.proForma.revenue.map(r => `| ${r.category} | ${formatCurrency(r.year1)} | ${formatCurrency(r.year2)} | ${formatCurrency(r.year3)} |`).join("\n")}
| **Total** | **${formatCurrency(data.proForma.revenue.reduce((s, r) => s + r.year1, 0))}** | **${formatCurrency(data.proForma.revenue.reduce((s, r) => s + r.year2, 0))}** | **${formatCurrency(data.proForma.revenue.reduce((s, r) => s + r.year3, 0))}** |

### Expenses

| Category | Year 1 | Year 2 | Year 3 |
|----------|--------|--------|--------|
${data.proForma.expenses.map(e => `| ${e.category} | ${formatCurrency(e.year1)} | ${formatCurrency(e.year2)} | ${formatCurrency(e.year3)} |`).join("\n")}
| **Total** | **${formatCurrency(data.proForma.expenses.reduce((s, e) => s + e.year1, 0))}** | **${formatCurrency(data.proForma.expenses.reduce((s, e) => s + e.year2, 0))}** | **${formatCurrency(data.proForma.expenses.reduce((s, e) => s + e.year3, 0))}** |

### Summary

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Net Profit | ${formatCurrency(data.proForma.summary.year1Profit)} | ${formatCurrency(data.proForma.summary.year2Profit)} | ${formatCurrency(data.proForma.summary.year3Profit)} |

**Break-Even Point:** Month ${data.proForma.summary.breakEvenMonth}

---

## Risk Assessment

${data.risks.map(r => `- ${r}`).join("\n")}

---

## Growth Opportunities

${data.opportunities.map(o => `- ${o}`).join("\n")}

---

*This document was generated by Claudia Coder Business Development Analysis*
`
}

function generateLegacyHtmlForPdf(projectName: string, data: LegacyBusinessDevData): string {
  const generatedDate = data.generatedAt ? new Date(data.generatedAt).toLocaleDateString() : new Date().toLocaleDateString()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - Business Development Plan</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; padding: 40px; max-width: 900px; margin: 0 auto; background: #fff; }
    h1 { font-size: 28px; color: #111; margin-bottom: 8px; border-bottom: 3px solid #8B5CF6; padding-bottom: 12px; }
    h2 { font-size: 20px; color: #333; margin-top: 32px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
    h3 { font-size: 16px; color: #444; margin-top: 20px; margin-bottom: 12px; }
    p { margin-bottom: 12px; color: #444; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    th, td { padding: 10px 12px; text-align: left; border: 1px solid #e5e5e5; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .summary-card { background: #f8f8f8; padding: 16px; border-radius: 8px; text-align: center; }
    .summary-card .label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .summary-card .value { font-size: 18px; font-weight: 600; color: #333; }
    .summary-card .value.positive { color: #10B981; }
    .summary-card .value.negative { color: #EF4444; }
    ul { margin: 12px 0; padding-left: 24px; }
    li { margin-bottom: 8px; color: #444; }
    .risk { color: #EF4444; }
    .opportunity { color: #10B981; }
    .section { margin-bottom: 32px; }
    .highlight-box { background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%); color: white; padding: 24px; border-radius: 12px; margin: 24px 0; }
    .highlight-box h3 { color: white; margin-top: 0; }
    .highlight-box p { color: rgba(255,255,255,0.9); margin-bottom: 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center; }
    @media print { body { padding: 0; } .section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>${projectName}</h1>
  <p class="meta">Business Development Plan - Generated: ${generatedDate}</p>
  <div class="section"><h2>Executive Summary</h2><p>${data.executiveSummary.replace(/\n/g, "</p><p>")}</p></div>
  <div class="highlight-box"><h3>Value Proposition</h3><p>${data.valueProposition}</p></div>
  <div class="section"><h2>Target Market</h2><p>${data.targetMarket}</p></div>
  <div class="section"><h2>Competitive Advantage</h2><p>${data.competitiveAdvantage}</p></div>
  <div class="section">
    <h2>Key Features</h2>
    <table>
      <thead><tr><th>Feature</th><th>Description</th><th>Priority</th><th>Status</th><th>Est. Value</th></tr></thead>
      <tbody>${data.features.map(f => `<tr><td><strong>${f.name}</strong></td><td>${f.description}</td><td>${f.priority}</td><td>${f.status}</td><td>${f.estimatedValue || "-"}</td></tr>`).join("")}</tbody>
    </table>
  </div>
  <div class="section">
    <h2>Financial Projections</h2>
    <div class="summary-cards">
      <div class="summary-card"><div class="label">Year 1</div><div class="value ${data.proForma.summary.year1Profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.proForma.summary.year1Profit)}</div></div>
      <div class="summary-card"><div class="label">Year 2</div><div class="value ${data.proForma.summary.year2Profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.proForma.summary.year2Profit)}</div></div>
      <div class="summary-card"><div class="label">Year 3</div><div class="value ${data.proForma.summary.year3Profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.proForma.summary.year3Profit)}</div></div>
      <div class="summary-card"><div class="label">Break Even</div><div class="value">Month ${data.proForma.summary.breakEvenMonth}</div></div>
    </div>
  </div>
  <div class="section"><h2>Risk Assessment</h2><ul>${data.risks.map(r => `<li class="risk">${r}</li>`).join("")}</ul></div>
  <div class="section"><h2>Growth Opportunities</h2><ul>${data.opportunities.map(o => `<li class="opportunity">${o}</li>`).join("")}</ul></div>
  <div class="footer"><p>Generated by Claudia Coder Business Development Analysis</p>${data.generatedBy ? `<p>Model: ${data.generatedBy}</p>` : ""}</div>
</body>
</html>`
}
