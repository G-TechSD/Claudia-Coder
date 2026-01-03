/**
 * Anthropic Claude LLM Service
 * Handles all LLM interactions for the Claudia Admin Panel
 */

// API route handler for Claude - runs server-side
export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface GenerateQuestionRequest {
  systemPrompt: string
  messages: ChatMessage[]
  context?: Record<string, unknown>
}

export interface GenerateQuestionResponse {
  question: string
  error?: string
}

export interface ExtractInsightsRequest {
  systemPrompt: string
  content: string
  type: string
}

export interface ExtractInsightsResponse {
  summary: string
  keyPoints: string[]
  suggestedActions: string[]
  extractedData: Record<string, unknown>
  error?: string
}

/**
 * Generate the next interview question using Claude
 */
export async function generateInterviewQuestion(
  request: GenerateQuestionRequest
): Promise<GenerateQuestionResponse> {
  try {
    const response = await fetch("/api/llm/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.text()
      return { question: "", error }
    }

    return response.json()
  } catch (error) {
    return {
      question: "",
      error: error instanceof Error ? error.message : "Failed to generate question"
    }
  }
}

/**
 * Extract insights from interview content using Claude
 */
export async function extractInterviewInsights(
  request: ExtractInsightsRequest
): Promise<ExtractInsightsResponse> {
  try {
    const response = await fetch("/api/llm/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.text()
      return {
        summary: "",
        keyPoints: [],
        suggestedActions: [],
        extractedData: {},
        error
      }
    }

    return response.json()
  } catch (error) {
    return {
      summary: "",
      keyPoints: [],
      suggestedActions: [],
      extractedData: {},
      error: error instanceof Error ? error.message : "Failed to extract insights"
    }
  }
}
