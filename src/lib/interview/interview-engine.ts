/**
 * Interview Engine
 * Manages interview sessions, generates questions, and extracts insights
 * Now with real LLM integration via Claude API
 */

import type {
  InterviewSession,
  InterviewMessage,
  InterviewType,
  InterviewTargetType
} from "@/lib/data/types"
import { buildInterviewContext, PROJECT_CREATION_SYSTEM_PROMPT } from "./prompts"
import { generateInterviewQuestion, extractInterviewInsights } from "@/lib/llm/anthropic"

// UUID generator that works in all contexts (HTTP, HTTPS, localhost)
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ============ Session Management ============

export function createInterviewSession(
  type: InterviewType,
  targetType?: InterviewTargetType,
  targetId?: string,
  targetTitle?: string,
  targetContext?: Record<string, unknown>
): InterviewSession {
  const { systemPrompt, opener } = buildInterviewContext(type, targetType, targetContext)

  return {
    id: generateUUID(),
    type,
    status: "in_progress",
    targetType,
    targetId,
    targetTitle,
    targetContext,
    messages: [
      {
        id: generateUUID(),
        role: "assistant",
        content: opener,
        timestamp: new Date().toISOString()
      }
    ],
    createdAt: new Date().toISOString()
  }
}

export function addUserMessage(
  session: InterviewSession,
  content: string,
  transcribedFrom: "voice" | "text" = "text"
): InterviewSession {
  const message: InterviewMessage = {
    id: generateUUID(),
    role: "user",
    content,
    timestamp: new Date().toISOString(),
    transcribedFrom
  }

  return {
    ...session,
    messages: [...session.messages, message]
  }
}

export function addAssistantMessage(
  session: InterviewSession,
  content: string
): InterviewSession {
  const message: InterviewMessage = {
    id: generateUUID(),
    role: "assistant",
    content,
    timestamp: new Date().toISOString()
  }

  return {
    ...session,
    messages: [...session.messages, message]
  }
}

export function markSkipped(session: InterviewSession): InterviewSession {
  const messages = [...session.messages]
  if (messages.length > 0) {
    const last = messages[messages.length - 1]
    if (last.role === "assistant") {
      messages[messages.length - 1] = { ...last, skipped: true }
    }
  }
  return { ...session, messages }
}

export function completeInterview(
  session: InterviewSession,
  summary?: string,
  keyPoints?: string[],
  suggestedActions?: string[],
  extractedData?: Record<string, unknown>
): InterviewSession {
  return {
    ...session,
    status: "completed",
    summary,
    keyPoints,
    suggestedActions,
    extractedData,
    completedAt: new Date().toISOString()
  }
}

export function cancelInterview(session: InterviewSession): InterviewSession {
  return {
    ...session,
    status: "cancelled",
    completedAt: new Date().toISOString()
  }
}

// ============ Question Generation ============

/**
 * Generate the next question using Claude LLM
 */
export async function generateNextQuestion(
  session: InterviewSession,
  userResponse: string
): Promise<string> {
  // Check for voice commands first
  const lowerResponse = userResponse.toLowerCase().trim()
  if (lowerResponse === "skip" || lowerResponse === "next") {
    return generateSkipResponse(session)
  }
  if (lowerResponse === "done" || lowerResponse === "finish" || lowerResponse === "end") {
    return "Perfect, I think we have a good picture now. Is there anything else you'd like to add before I put together a summary?"
  }

  // Build system prompt based on interview type
  const { systemPrompt } = buildInterviewContext(
    session.type,
    session.targetType,
    session.targetContext
  )

  // Convert messages for the LLM
  const messages = session.messages.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content
  }))

  // Try LLM first
  try {
    const response = await generateInterviewQuestion({
      systemPrompt,
      messages,
      context: session.targetContext
    })

    if (response.question && !response.error) {
      return response.question
    }

    // Fall back to local generation on error
    console.warn("LLM error, using fallback:", response.error)
    return generateFallbackQuestion(session, userResponse)
  } catch (error) {
    console.error("LLM call failed:", error)
    return generateFallbackQuestion(session, userResponse)
  }
}

function generateSkipResponse(session: InterviewSession): string {
  const questionCount = session.messages.filter(m => m.role === "assistant").length

  if (questionCount < 5) {
    return "No problem! Let's talk about what features are most important to you."
  }
  if (questionCount < 10) {
    return "Okay, moving on. Is there anything specific about the technical approach you'd like to discuss?"
  }
  return "Got it. We're getting close to wrapping up - anything else on your mind?"
}

function generateFallbackQuestion(session: InterviewSession, userResponse: string): string {
  const questionCount = session.messages.filter(m => m.role === "assistant").length
  const userMessages = session.messages.filter(m => m.role === "user")
  const allContent = userMessages.map(m => m.content.toLowerCase()).join(" ")

  // Smart fallbacks based on what hasn't been discussed
  const discussed = {
    users: /users?|audience|customers?|people|who/i.test(allContent),
    features: /features?|functionality|capability|do|does/i.test(allContent),
    tech: /tech|stack|framework|language|react|node|python/i.test(allContent),
    scale: /scale|size|traffic|performance|big|large|users?.*many/i.test(allContent),
    timeline: /time|deadline|when|schedule|weeks?|months?|urgent/i.test(allContent),
    integration: /integrat|api|connect|sync|service/i.test(allContent)
  }

  // Don't repeat topics
  if (!discussed.users && questionCount >= 1) {
    return "Who's going to be using this? Paint me a picture of your typical user."
  }
  if (!discussed.features && questionCount >= 2) {
    return "If you could only ship three features, what would they be?"
  }
  if (!discussed.tech && questionCount >= 3) {
    return "Any thoughts on the tech stack, or should I make recommendations based on what you've described?"
  }
  if (!discussed.scale && questionCount >= 4) {
    return "Let's talk scale - are we building for a handful of users or preparing for thousands?"
  }
  if (!discussed.integration && questionCount >= 5) {
    return "Will this need to talk to any existing systems or external services?"
  }
  if (!discussed.timeline && questionCount >= 6) {
    return "What's the timeline looking like? Any key milestones or deadlines?"
  }

  // Wrap-up questions
  if (questionCount >= 10) {
    return "We've covered a lot of ground. What's the one thing that absolutely has to be right for this to succeed?"
  }
  if (questionCount >= 12) {
    return "Anything else important that we haven't touched on?"
  }
  if (questionCount >= 15) {
    return "I think we have a solid foundation. Ready to wrap up?"
  }

  return "Tell me more about that - what's most important to you there?"
}

// ============ Insight Extraction ============

/**
 * Extract structured insights from the interview using Claude
 */
export async function extractInsights(session: InterviewSession): Promise<{
  summary: string
  keyPoints: string[]
  suggestedActions: string[]
  extractedData: Record<string, unknown>
}> {
  // Build content from messages
  const content = session.messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n")

  // Try LLM extraction
  try {
    const response = await extractInterviewInsights({
      systemPrompt: PROJECT_CREATION_SYSTEM_PROMPT,
      content,
      type: session.type
    })

    if (!response.error) {
      return {
        summary: response.summary || generateFallbackSummary(session),
        keyPoints: response.keyPoints.length > 0 ? response.keyPoints : extractFallbackKeyPoints(session),
        suggestedActions: response.suggestedActions.length > 0 ? response.suggestedActions : generateFallbackActions(session),
        extractedData: response.extractedData || {}
      }
    }

    console.warn("LLM extraction error, using fallback:", response.error)
  } catch (error) {
    console.error("LLM extraction failed:", error)
  }

  // Fallback extraction
  return {
    summary: generateFallbackSummary(session),
    keyPoints: extractFallbackKeyPoints(session),
    suggestedActions: generateFallbackActions(session),
    extractedData: extractFallbackProjectData(session)
  }
}

function generateFallbackSummary(session: InterviewSession): string {
  const userMessages = session.messages.filter(m => m.role === "user")
  const wordCount = userMessages.map(m => m.content).join(" ").split(/\s+/).length

  return `Interview completed with ${userMessages.length} responses covering project goals, features, and requirements. Total input: approximately ${wordCount} words.`
}

function extractFallbackKeyPoints(session: InterviewSession): string[] {
  const points: string[] = []
  const content = session.messages.filter(m => m.role === "user").map(m => m.content).join(" ")

  if (/need|must|require|essential/i.test(content)) {
    points.push("Core requirements identified")
  }
  if (/user|customer|audience/i.test(content)) {
    points.push("Target users discussed")
  }
  if (/feature|functionality/i.test(content)) {
    points.push("Key features outlined")
  }
  if (/tech|stack|framework/i.test(content)) {
    points.push("Technical preferences noted")
  }

  return points.length > 0 ? points : ["Project details captured from interview"]
}

function generateFallbackActions(session: InterviewSession): string[] {
  if (session.type === "project_creation") {
    return [
      "Review project details and create the project",
      "Set up the repository",
      "Create initial development packets"
    ]
  }
  return ["Review notes and follow up as needed"]
}

function extractFallbackProjectData(session: InterviewSession): Record<string, unknown> {
  const content = session.messages.filter(m => m.role === "user").map(m => m.content).join(" ")
  const data: Record<string, unknown> = {}

  // Extract tech stack mentions
  const techPatterns = [
    { pattern: /react/i, name: "React" },
    { pattern: /next\.?js/i, name: "Next.js" },
    { pattern: /node/i, name: "Node.js" },
    { pattern: /python/i, name: "Python" },
    { pattern: /typescript/i, name: "TypeScript" },
    { pattern: /postgresql|postgres/i, name: "PostgreSQL" },
    { pattern: /mongodb/i, name: "MongoDB" },
    { pattern: /redis/i, name: "Redis" }
  ]

  const tech = techPatterns.filter(t => t.pattern.test(content)).map(t => t.name)
  if (tech.length > 0) {
    data.techStack = tech
  }

  // Extract priority
  if (/urgent|asap|critical|priority|immediately/i.test(content)) {
    data.priority = "high"
  } else if (/eventually|someday|low priority|no rush/i.test(content)) {
    data.priority = "low"
  } else {
    data.priority = "medium"
  }

  return data
}
