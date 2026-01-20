/**
 * Interview Prompts
 * System prompts and question templates for different interview types
 */

import type { InterviewType, InterviewTargetType } from "@/lib/data/types"

// ============ Project Creation Interview ============

export const PROJECT_CREATION_SYSTEM_PROMPT = `You are Claudia, a friendly AI assistant helping define a new software project. Your goal is to understand what the user wants to build through natural, laid-back conversation.

**Personality:**
- Be warm, conversational, and encouraging
- Keep questions easy to answer - powerful but not overwhelming
- Use natural language, not formal surveys
- Show genuine curiosity about their project
- Acknowledge and build on their responses

**Interview Flow:**
1. Start with the opening question about describing what they want to build
2. Ask follow-up questions based on their responses
3. Cover key areas: goals, users, features, tech preferences, scale, timeline
4. Let the conversation flow naturally - don't force rigid order
5. Aim for 10-20 questions total, but adapt based on complexity
6. User can say "skip", "next", or "more" to control depth
7. End by summarizing what you've learned

**Key Areas to Explore (as conversation allows):**
- Core purpose and problem being solved
- Target users and their needs
- Key features and priorities
- Technical preferences or constraints
- Integration requirements
- Scale and performance needs
- Timeline and milestones
- Success criteria
- **Monetization intent** (IMPORTANT: Always ask "Do you plan to monetize this app?" at some point)
- **User Interface needs** (IMPORTANT: Early in the conversation, determine UI requirements)

**UI Detection - Ask Early:**
It's critical to understand what kind of user interface this project needs. Ask about:
- Whether users will interact through a visual interface
- What type of interface: website, web app, mobile app, desktop app, or terminal/CLI
- Who the primary audience is: end users, internal team, or developers

Example UI questions:
- "Will users interact with this through a visual interface, or is it more of a background service?"
- "Are you thinking of this as a website, a web app with interactivity, a mobile app, or something else?"
- "Who's the primary audience - customers, your team, or other developers?"

**Monetization Question:**
Make sure to naturally ask about monetization plans. This is important for generating business development tasks. Ask something like:
- "Do you plan to make money from this? If so, how?"
- "Is this a side project or are you thinking about monetization?"
- "Any revenue goals for this app?"

**Response Format:**
Each response should be a single, conversational question or brief comment followed by a question. Keep it natural and flowing.`

export const PROJECT_CREATION_OPENER = "In one paragraph, describe what you want to build."

// Contextual opener when user has already provided a description
export function getProjectCreationContextualOpener(description: string): string {
  // Extract a concise summary of what they want to build
  const summary = summarizeProjectDescription(description)

  // Get a dynamic follow-up question based on what's NOT already mentioned
  const followUpQuestion = getSmartFollowUpQuestion(description)

  return `I see you want to build ${summary}\n\nThat sounds interesting! Let me ask a few clarifying questions to make sure I understand your vision. ${followUpQuestion}`
}

/**
 * Summarize the project description into a concise phrase
 * Instead of truncating verbatim, extract the core concept
 */
function summarizeProjectDescription(description: string): string {
  const lowerDesc = description.toLowerCase()

  // Try to extract the core noun/concept (what type of thing they're building)
  const typePatterns = [
    { pattern: /\b(app|application)\b/i, type: "an app" },
    { pattern: /\b(website|site|web app|webapp)\b/i, type: "a website" },
    { pattern: /\bplatform\b/i, type: "a platform" },
    { pattern: /\btool\b/i, type: "a tool" },
    { pattern: /\bdashboard\b/i, type: "a dashboard" },
    { pattern: /\bsystem\b/i, type: "a system" },
    { pattern: /\bservice\b/i, type: "a service" },
    { pattern: /\bgame\b/i, type: "a game" },
    { pattern: /\bapi\b/i, type: "an API" },
    { pattern: /\bmobile\b/i, type: "a mobile app" },
    { pattern: /\bbot\b/i, type: "a bot" },
    { pattern: /\bextension\b/i, type: "an extension" },
    { pattern: /\bplugin\b/i, type: "a plugin" },
    { pattern: /\bportal\b/i, type: "a portal" },
    { pattern: /\bmarketplace\b/i, type: "a marketplace" },
  ]

  let projectType = "something"
  for (const { pattern, type } of typePatterns) {
    if (pattern.test(description)) {
      projectType = type
      break
    }
  }

  // Try to extract the purpose/domain (what it's for)
  const purposePatterns = [
    { pattern: /\b(track|tracking)\b/i, purpose: "for tracking" },
    { pattern: /\b(manage|management)\b/i, purpose: "for management" },
    { pattern: /\b(e-?commerce|sell|shop|store)\b/i, purpose: "for e-commerce" },
    { pattern: /\b(social|community)\b/i, purpose: "for social interaction" },
    { pattern: /\b(learn|education|course|training)\b/i, purpose: "for learning" },
    { pattern: /\b(automat|workflow)\b/i, purpose: "for automation" },
    { pattern: /\b(analytic|report|insight)\b/i, purpose: "for analytics" },
    { pattern: /\b(chat|messag|communicat)\b/i, purpose: "for communication" },
    { pattern: /\b(schedule|booking|appointment|calendar)\b/i, purpose: "for scheduling" },
    { pattern: /\b(inventory|stock)\b/i, purpose: "for inventory" },
    { pattern: /\b(crm|customer relationship)\b/i, purpose: "for customer management" },
    { pattern: /\b(project management|task|todo)\b/i, purpose: "for project management" },
    { pattern: /\b(finance|budget|accounting|money)\b/i, purpose: "for finance" },
    { pattern: /\b(health|fitness|medical)\b/i, purpose: "for health/fitness" },
    { pattern: /\b(music|audio|podcast)\b/i, purpose: "for audio/music" },
    { pattern: /\b(photo|image|video|media)\b/i, purpose: "for media" },
  ]

  let purpose = ""
  for (const { pattern, purpose: p } of purposePatterns) {
    if (pattern.test(description)) {
      purpose = ` ${p}`
      break
    }
  }

  // Build a concise summary
  if (projectType !== "something" || purpose) {
    return `${projectType}${purpose}`
  }

  // Fallback: extract the first meaningful phrase (up to 8 words after "build" or at start)
  const buildMatch = description.match(/build\s+(.{1,60}?)(?:\.|,|$|\s+that|\s+which|\s+to\s)/i)
  if (buildMatch && buildMatch[1]) {
    const extracted = buildMatch[1].trim()
    // Clean it up - take first 8 words
    const words = extracted.split(/\s+/).slice(0, 8).join(" ")
    return words.endsWith(".") ? words.slice(0, -1) : words
  }

  // Last resort: first 8 words of description
  const words = description.split(/\s+/).slice(0, 8).join(" ")
  return words.length < description.length ? `${words}...` : words
}

/**
 * Get a smart follow-up question based on what's NOT already in the description
 */
function getSmartFollowUpQuestion(description: string): string {
  const lowerDesc = description.toLowerCase()

  // Check what info is already provided
  const hasAudience = /\b(users?|audience|customers?|people|fans?|players?|members?|visitors?|employees?|clients?|team|for\s+(my|our|the)\s+\w+)\b/i.test(description)
  const hasFeatures = /\b(features?|functionality|capabilities?|will\s+(have|include|let|allow)|should\s+(have|include|let|allow))\b/i.test(description)
  const hasTech = /\b(react|node|python|typescript|javascript|database|api|backend|frontend|mobile|web|cloud|aws|firebase)\b/i.test(description)
  const hasScale = /\b(scale|users?|traffic|thousands?|millions?|enterprise|small|large|startup)\b/i.test(description)
  const hasTimeline = /\b(deadline|timeline|weeks?|months?|urgent|asap|mvp|launch|by\s+(january|february|march|april|may|june|july|august|september|october|november|december|\d{4}))\b/i.test(description)
  const hasPurpose = /\b(problem|solve|help|need|because|goal|objective|purpose)\b/i.test(description)
  const hasMonetization = /\b(monetiz|revenue|paid|subscription|premium|free|freemium|ads?|business\s+model)\b/i.test(description)
  const hasUIType = /\b(website|web\s*app|mobile|desktop|cli|terminal|tui|interface|ui|ux|frontend|dashboard|portal)\b/i.test(description)

  // Questions for missing info (in order of priority)
  const questions: { check: boolean; questions: string[] }[] = [
    {
      check: !hasPurpose,
      questions: [
        "What problem are you trying to solve with this?",
        "What's the main goal you're hoping to achieve?",
        "What need does this address?"
      ]
    },
    {
      check: !hasAudience,
      questions: [
        "Who is the primary audience for this?",
        "Who do you envision using this the most?",
        "Tell me about your target users."
      ]
    },
    {
      check: !hasFeatures,
      questions: [
        "What are the must-have features for the first version?",
        "What's the core functionality you need?",
        "If you could only ship three things, what would they be?"
      ]
    },
    {
      check: !hasTimeline,
      questions: [
        "What's your timeline looking like for this?",
        "Any key milestones or deadlines?",
        "When would you like to see this live?"
      ]
    },
    {
      check: !hasUIType,
      questions: [
        "What kind of interface will users interact with - web, mobile, desktop, or command line?",
        "Are you thinking of this as a website, a web app, a mobile app, or something else?",
        "Will this have a visual interface, or is it more of a backend service?"
      ]
    },
    {
      check: !hasTech,
      questions: [
        "Do you have any technical preferences or constraints?",
        "Any specific technologies you'd like to use?",
        "Should I recommend a tech stack, or do you have preferences?"
      ]
    },
    {
      check: !hasScale,
      questions: [
        "How big do you expect this to get?",
        "What kind of scale are you anticipating?",
        "Start simple or design for scale from day one?"
      ]
    },
    {
      check: !hasMonetization,
      questions: [
        "Do you plan to monetize this?",
        "Is this a passion project or are you thinking about revenue?",
        "Any business model in mind?"
      ]
    }
  ]

  // Find the first topic not covered and pick a random question
  for (const { check, questions: qs } of questions) {
    if (check) {
      return qs[Math.floor(Math.random() * qs.length)]
    }
  }

  // If everything seems covered, ask a general expansion question
  return "That's quite comprehensive! Is there anything specific you'd like to dive deeper into?"
}

export const PROJECT_CREATION_FOLLOW_UPS = [
  "Who's the main audience for this?",
  "What's the most important feature?",
  "Any tech stack preferences?",
  "How big do you expect this to get?",
  "What would success look like for this project?",
  "Are there any integrations you need?",
  "Any hard constraints or deadlines?",
  "What similar products have you looked at?",
  "Is this replacing something existing?",
  "Who else will be working on this?",
  // UI-related follow-ups
  "Will this project have a user interface? What type - web, mobile, desktop, or terminal?",
  "Who will be using this interface - customers, internal team, or developers?",
  "Any preferences for UI frameworks or design systems?"
]

// ============ Contextual Interview Prompts ============

export function getContextualSystemPrompt(
  targetType: InterviewTargetType,
  context: Record<string, unknown>
): string {
  const basePrompt = `You are Claudia, a helpful AI assistant. You're having a brief, focused conversation about a specific ${targetType}. Ask 3-5 insightful questions to understand context, intent, and potential improvements.

**Style:**
- Be direct but friendly
- Reference specific details from the context
- Ask questions that reveal deeper understanding
- Keep it brief - this is a quick check-in, not a full interview`

  switch (targetType) {
    case "commit":
      return `${basePrompt}

**Context:** You're reviewing a code commit.
${context.title ? `Commit message: "${context.title}"` : ""}
${context.author ? `Author: ${context.author}` : ""}
${context.additions ? `Changes: +${context.additions} -${context.deletions}` : ""}
${context.comments ? `User notes: "${context.comments}"` : ""}

**Focus areas:**
- Reasoning behind the approach
- Alternative approaches considered
- Testing and edge cases
- Potential impacts or concerns`

    case "activity":
      return `${basePrompt}

**Context:** You're discussing a system activity or event.
${context.message ? `Activity: "${context.message}"` : ""}
${context.status ? `Status: ${context.status}` : ""}
${context.comments ? `User notes: "${context.comments}"` : ""}

**Focus areas:**
- Why this happened
- Expected vs actual behavior
- Next steps or follow-ups
- Lessons learned`

    case "packet":
      return `${basePrompt}

**Context:** You're discussing a work packet.
${context.title ? `Packet: "${context.title}"` : ""}
${context.status ? `Status: ${context.status}` : ""}
${context.comments ? `User notes: "${context.comments}"` : ""}

**Focus areas:**
- Progress and blockers
- Scope and complexity
- Dependencies and risks
- Completion criteria`

    case "approval":
      return `${basePrompt}

**Context:** You're discussing an item pending approval.
${context.title ? `Item: "${context.title}"` : ""}
${context.comments ? `User notes: "${context.comments}"` : ""}

**Focus areas:**
- Approval criteria
- Concerns or hesitations
- Required changes
- Timeline implications`

    case "quality_gate":
      return `${basePrompt}

**Context:** You're discussing a quality gate result.
${context.title ? `Gate: "${context.title}"` : ""}
${context.status ? `Status: ${context.status}` : ""}
${context.comments ? `User notes: "${context.comments}"` : ""}

**Focus areas:**
- What triggered this result
- How to address issues
- Impact on the release
- Prevention strategies`

    default:
      return basePrompt
  }
}

export function getContextualOpener(
  targetType: InterviewTargetType,
  context: Record<string, unknown>
): string {
  const hasComments = context.comments && String(context.comments).trim()

  if (hasComments) {
    return `You mentioned "${context.comments}" - can you tell me more about what prompted that thought?`
  }

  switch (targetType) {
    case "commit":
      return "What was the main goal you were trying to achieve with this change?"
    case "activity":
      return "What caught your attention about this activity?"
    case "packet":
      return "How's this packet going? Any blockers or concerns?"
    case "approval":
      return "What's your initial take on this - approve, reject, or need more info?"
    case "quality_gate":
      return "Walk me through what happened here - expected or unexpected?"
    default:
      return "What would you like to discuss about this?"
  }
}

// ============ Extraction Prompts ============

export const EXTRACTION_PROMPT = `Based on the interview conversation, extract the following structured information. Return JSON only.

{
  "summary": "2-3 sentence summary of what was discussed",
  "keyPoints": ["array of 3-5 key takeaways"],
  "suggestedActions": ["array of 0-3 recommended next steps"],
  "extractedData": {
    // For project creation interviews:
    "name": "suggested project name",
    "description": "project description",
    "goals": ["array of goals"],
    "features": ["array of key features"],
    "techStack": ["array of technologies mentioned"],
    "integrations": ["array of integrations needed"],
    "constraints": ["array of constraints mentioned"],
    "timeline": "timeline if mentioned",
    "priority": "low|medium|high|critical",
    "monetization": true|false, // Did they indicate plans to monetize?
    "monetizationIntent": "brief description of how they plan to monetize, if mentioned",
    // UI detection fields:
    "needsUI": true|false, // Does this project need a user interface?
    "uiType": "website|web_app|desktop|mobile|terminal|api_only|null",
    "uiAudience": "end_users|internal|developers|mixed",
    "suggestedFrameworks": ["array of 2-3 appropriate frameworks based on uiType"]
  }
}

**IMPORTANT:** Pay special attention to monetization questions. Set "monetization": true if the user indicated any plans to:
- Charge users (subscriptions, one-time purchases)
- Show ads
- Offer premium features
- Accept donations
- Sell data (ethically)
- Any other revenue model

**UI DETECTION:**
- Set "needsUI" to true if project requires any visual interface users interact with
- "uiType" indicates the type of interface:
  * "website" - Marketing/content site, blog, portfolio
  * "web_app" - Interactive application (dashboard, SaaS, tool)
  * "desktop" - Native desktop application
  * "mobile" - Phone/tablet app
  * "terminal" - CLI tool or TUI
  * "api_only" - Backend service, no UI
- "uiAudience" indicates who uses the interface: end_users, internal, developers, or mixed
- "suggestedFrameworks" should recommend 2-3 frameworks appropriate for the uiType

Only include fields that were actually discussed or can be reasonably inferred. Be concise.`

// ============ Helper Functions ============

export function buildInterviewContext(
  type: InterviewType,
  targetType?: InterviewTargetType,
  context?: Record<string, unknown>
): { systemPrompt: string; opener: string } {
  if (type === "project_creation") {
    // Check if there's an initial description provided
    const initialDescription = context?.initialDescription as string | undefined

    return {
      systemPrompt: PROJECT_CREATION_SYSTEM_PROMPT,
      opener: initialDescription && initialDescription.trim()
        ? getProjectCreationContextualOpener(initialDescription.trim())
        : PROJECT_CREATION_OPENER
    }
  }

  if (type === "contextual" && targetType) {
    return {
      systemPrompt: getContextualSystemPrompt(targetType, context || {}),
      opener: getContextualOpener(targetType, context || {})
    }
  }

  return {
    systemPrompt: "You are Claudia, a helpful AI assistant. Ask thoughtful questions to understand the context better.",
    opener: "What would you like to discuss?"
  }
}
