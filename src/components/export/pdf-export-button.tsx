"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileText, FileJson, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface PDFExportButtonProps {
  /** HTML content to export (for PDF) */
  htmlContent?: string
  /** Markdown content to export */
  markdownContent?: string
  /** URL to fetch content from */
  fetchUrl?: string
  /** Filename without extension */
  filename: string
  /** Available export formats */
  formats?: ("pdf" | "markdown" | "json")[]
  /** Button variant */
  variant?: "default" | "outline" | "ghost" | "secondary"
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon"
  /** Additional class names */
  className?: string
  /** Callback after export */
  onExport?: (format: string) => void
  /** Custom render for children */
  children?: React.ReactNode
}

/**
 * PDF Export Button Component
 *
 * Provides export functionality for documents in multiple formats:
 * - PDF (using html2pdf.js, dynamically imported)
 * - Markdown (direct download)
 * - JSON (direct download)
 */
export function PDFExportButton({
  htmlContent,
  markdownContent,
  fetchUrl,
  filename,
  formats = ["pdf", "markdown"],
  variant = "outline",
  size = "sm",
  className,
  onExport,
  children,
}: PDFExportButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false)
  const [exportFormat, setExportFormat] = React.useState<string | null>(null)

  const handleExport = async (format: "pdf" | "markdown" | "json") => {
    setIsExporting(true)
    setExportFormat(format)

    try {
      let content = htmlContent || markdownContent || ""

      // Fetch content if URL provided
      if (fetchUrl && !content) {
        const response = await fetch(fetchUrl)
        if (!response.ok) throw new Error("Failed to fetch content")
        content = await response.text()
      }

      switch (format) {
        case "pdf":
          await exportAsPDF(content, filename)
          break
        case "markdown":
          exportAsMarkdown(markdownContent || content, filename)
          break
        case "json":
          exportAsJSON(content, filename)
          break
      }

      onExport?.(format)
    } catch (error) {
      console.error(`Export failed:`, error)
    } finally {
      setIsExporting(false)
      setExportFormat(null)
    }
  }

  // Single format - render simple button
  if (formats.length === 1) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => handleExport(formats[0])}
        disabled={isExporting}
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Exporting...
          </>
        ) : (
          children || (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export {formats[0].toUpperCase()}
            </>
          )
        )}
      </Button>
    )
  }

  // Multiple formats - render dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting {exportFormat?.toUpperCase()}...
            </>
          ) : (
            children || (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.includes("pdf") && (
          <DropdownMenuItem onClick={() => handleExport("pdf")}>
            <FileText className="h-4 w-4 mr-2" />
            Export as PDF
          </DropdownMenuItem>
        )}
        {formats.includes("markdown") && (
          <DropdownMenuItem onClick={() => handleExport("markdown")}>
            <FileText className="h-4 w-4 mr-2" />
            Export as Markdown
          </DropdownMenuItem>
        )}
        {formats.includes("json") && (
          <DropdownMenuItem onClick={() => handleExport("json")}>
            <FileJson className="h-4 w-4 mr-2" />
            Export as JSON
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Export content as PDF using html2pdf.js
 */
async function exportAsPDF(htmlContent: string, filename: string): Promise<void> {
  // Dynamic import to avoid SSR issues and reduce bundle size
  const html2pdfModule = await import("html2pdf.js")
  const html2pdf = html2pdfModule.default

  // Create a temporary container for the HTML content
  const container = document.createElement("div")
  container.innerHTML = htmlContent
  container.style.padding = "20px"
  container.style.fontFamily = "system-ui, -apple-system, sans-serif"
  container.style.fontSize = "12px"
  container.style.lineHeight = "1.5"
  container.style.color = "#333"
  container.style.backgroundColor = "#fff"

  // Style code blocks
  const codeBlocks = container.querySelectorAll("pre, code")
  codeBlocks.forEach((block) => {
    (block as HTMLElement).style.backgroundColor = "#f5f5f5"
    ;(block as HTMLElement).style.padding = "8px"
    ;(block as HTMLElement).style.borderRadius = "4px"
    ;(block as HTMLElement).style.fontSize = "10px"
    ;(block as HTMLElement).style.whiteSpace = "pre-wrap"
  })

  // Style headings
  const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6")
  headings.forEach((heading) => {
    (heading as HTMLElement).style.color = "#111"
    ;(heading as HTMLElement).style.marginTop = "16px"
    ;(heading as HTMLElement).style.marginBottom = "8px"
  })

  // Configure html2pdf options
  const options = {
    margin: [10, 10, 10, 10],
    filename: `${filename}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
  }

  // Generate and download PDF
  await html2pdf().set(options).from(container).save()
}

/**
 * Export content as Markdown file
 */
function exportAsMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown" })
  downloadBlob(blob, `${filename}.md`)
}

/**
 * Export content as JSON file
 */
function exportAsJSON(content: string, filename: string): void {
  let jsonContent: string
  try {
    // Try to parse as JSON and pretty print
    const parsed = JSON.parse(content)
    jsonContent = JSON.stringify(parsed, null, 2)
  } catch {
    // If not valid JSON, wrap in a content object
    jsonContent = JSON.stringify({ content }, null, 2)
  }

  const blob = new Blob([jsonContent], { type: "application/json" })
  downloadBlob(blob, `${filename}.json`)
}

/**
 * Helper to download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Markdown to HTML converter (basic)
 */
export function markdownToHTML(markdown: string): string {
  // Basic markdown to HTML conversion
  return markdown
    // Headers
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.slice(3, -3).replace(/^\w+\n/, "") // Remove language identifier
      return `<pre><code>${escapeHtml(code)}</code></pre>`
    })
    // Inline code
    .replace(/`(.+?)`/g, "<code>$1</code>")
    // Lists
    .replace(/^\- (.*)$/gim, "<li>$1</li>")
    .replace(/^\d+\. (.*)$/gim, "<li>$1</li>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Paragraphs
    .replace(/\n\n/g, "</p><p>")
    // Line breaks
    .replace(/\n/g, "<br>")
    // Wrap in paragraph
    .replace(/^(.+)$/gim, (match) => {
      if (match.startsWith("<")) return match
      return `<p>${match}</p>`
    })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Export button specifically for run history
 */
export function RunHistoryExportButton({
  runId,
  projectName,
}: {
  runId: string
  projectName?: string
}) {
  const filename = projectName
    ? `${projectName.toLowerCase().replace(/\s+/g, "-")}-run-${runId.slice(-8)}`
    : `run-${runId}`

  return (
    <PDFExportButton
      fetchUrl={`/api/run-history/${runId}/export?format=markdown`}
      filename={filename}
      formats={["markdown", "json"]}
      variant="ghost"
      size="sm"
    />
  )
}

/**
 * Export button specifically for documents
 */
export function DocExportButton({
  docContent,
  docTitle,
  projectName,
}: {
  docContent: string
  docTitle: string
  projectName: string
}) {
  const filename = `${projectName.toLowerCase().replace(/\s+/g, "-")}-${docTitle.toLowerCase().replace(/\s+/g, "-")}`
  const htmlContent = markdownToHTML(docContent)

  return (
    <PDFExportButton
      htmlContent={htmlContent}
      markdownContent={docContent}
      filename={filename}
      formats={["pdf", "markdown"]}
      variant="outline"
      size="sm"
    >
      <Download className="h-4 w-4 mr-2" />
      Export
    </PDFExportButton>
  )
}
