import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM, getAllServersWithStatus } from "@/lib/llm/local-llm"

/**
 * Vision content structure for regeneration
 */
interface VisionContent {
  tagline: string
  storeDescription: string
  keyFeatures: string[]
  uniqueSellingPoints: string[]
  targetAudience: string
}

/**
 * System prompt for vision regeneration
 * Takes existing content as context and enhances/regenerates it
 */
const VISION_REGENERATE_SYSTEM_PROMPT = `You are a game marketing expert and creative director. Your task is to enhance and improve an existing game/creative project vision description.

You will receive:
1. The current vision content (tagline, description, features, selling points, target audience)
2. The project type (game, VR, creative, etc.)

Your job is to:
1. PRESERVE the core intent and key ideas from the original
2. ENHANCE the writing to be more compelling and professional
3. IMPROVE clarity and readability
4. ADD any missing elements that would strengthen the vision
5. REFINE the tagline to be more catchy and memorable
6. EXPAND features and selling points if they seem incomplete

Return ONLY valid JSON with this structure:
{
  "tagline": "A short, catchy 5-10 word tagline",
  "storeDescription": "A 2-3 paragraph Steam/store style description (150-300 words)",
  "keyFeatures": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
  "uniqueSellingPoints": ["What makes this special 1", "What makes this special 2", "What makes this special 3"],
  "targetAudience": "Who will love this project"
}

Important:
- If the original content is good, enhance rather than replace
- Keep the same number of features/selling points or add more
- Make the description flow better and be more engaging
- Ensure all text is polished and professional
- Return ONLY the JSON, no markdown or extra text`

/**
 * Simplified prompt for smaller models
 */
const VISION_REGENERATE_SIMPLE_PROMPT = `Improve this game/project vision. Keep the same ideas but make it better.

Return JSON only:
{
  "tagline": "catchy tagline",
  "storeDescription": "improved description",
  "keyFeatures": ["feature 1", "feature 2", "feature 3"],
  "uniqueSellingPoints": ["unique 1", "unique 2"],
  "targetAudience": "who will love this"
}

Return ONLY JSON, no other text.`

/**
 * Generate user prompt for regeneration
 */
function generateRegeneratePrompt(content: VisionContent, projectType: string): string {
  return `Enhance and improve this ${projectType} vision:

CURRENT TAGLINE:
"${content.tagline}"

CURRENT STORE DESCRIPTION:
${content.storeDescription}

CURRENT KEY FEATURES:
${content.keyFeatures.map((f, i) => `${i + 1}. ${f}`).join("\n")}

CURRENT UNIQUE SELLING POINTS:
${content.uniqueSellingPoints.map((u, i) => `${i + 1}. ${u}`).join("\n")}

CURRENT TARGET AUDIENCE:
${content.targetAudience}

---
Enhance this vision while preserving the core ideas. Make it more compelling and professional.
Return the improved version as JSON.`
}

/**
 * Parse regeneration response from LLM
 */
function parseRegenerateResponse(response: string): VisionContent | null {
  // Try direct parse
  try {
    return JSON.parse(response.trim())
  } catch {
    // Continue
  }

  // Remove markdown code blocks
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim()

  // Try to find JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // Try fixing common issues
      try {
        cleaned = jsonMatch[0]
          .replace(/,(\s*[}\]])/g, "$1")
          .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

        return JSON.parse(cleaned)
      } catch {
        // Failed
      }
    }
  }

  return null
}

/**
 * Vision Regeneration API
 * Takes current vision content and regenerates/enhances it using LLM
 *
 * Request body:
 * - projectId: string
 * - currentContent: VisionContent
 * - projectType: string (e.g., "game", "vr", "creative")
 *
 * Response:
 * - regenerated: VisionContent (the enhanced version)
 * - server: string (which LLM server was used)
 * - model: string (which model was used)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectId,
      currentContent,
      projectType = "game"
    } = body

    if (!currentContent) {
      return NextResponse.json(
        { error: "Current content is required" },
        { status: 400 }
      )
    }

    // Validate current content structure
    const content: VisionContent = {
      tagline: currentContent.tagline || "",
      storeDescription: currentContent.storeDescription || "",
      keyFeatures: Array.isArray(currentContent.keyFeatures) ? currentContent.keyFeatures : [],
      uniqueSellingPoints: Array.isArray(currentContent.uniqueSellingPoints) ? currentContent.uniqueSellingPoints : [],
      targetAudience: currentContent.targetAudience || ""
    }

    const userPrompt = generateRegeneratePrompt(content, projectType)

    // Try local LLM first
    const localServers = await getAllServersWithStatus()
    const onlineServer = localServers.find(s => s.status === "online")

    if (onlineServer) {
      console.log(`[vision-regenerate] Using local server: ${onlineServer.name}`)

      const localResponse = await generateWithLocalLLM(
        VISION_REGENERATE_SYSTEM_PROMPT,
        userPrompt,
        {
          temperature: 0.7,
          max_tokens: 2048
        }
      )

      if (!localResponse.error) {
        const parsed = parseRegenerateResponse(localResponse.content)
        if (parsed) {
          console.log(`[vision-regenerate] Successfully regenerated with ${localResponse.server}:${localResponse.model}`)
          return NextResponse.json({
            regenerated: parsed,
            server: localResponse.server,
            model: localResponse.model,
            source: "local"
          })
        } else {
          console.log(`[vision-regenerate] Failed to parse local response, trying simplified prompt...`)

          // Try with simplified prompt
          const retryResponse = await generateWithLocalLLM(
            VISION_REGENERATE_SIMPLE_PROMPT,
            userPrompt,
            {
              temperature: 0.5,
              max_tokens: 2048
            }
          )

          if (!retryResponse.error) {
            const retryParsed = parseRegenerateResponse(retryResponse.content)
            if (retryParsed) {
              return NextResponse.json({
                regenerated: retryParsed,
                server: retryResponse.server,
                model: retryResponse.model,
                source: "local",
                usedSimplifiedPrompt: true
              })
            }
          }
        }
      }
    }

    // Try Anthropic if available
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        })

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: VISION_REGENERATE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }]
        })

        const responseContent = response.content[0].type === "text"
          ? response.content[0].text
          : ""

        const parsed = parseRegenerateResponse(responseContent)
        if (parsed) {
          return NextResponse.json({
            regenerated: parsed,
            server: "Anthropic",
            model: "claude-sonnet-4",
            source: "anthropic"
          })
        }
      } catch (error) {
        console.error("[vision-regenerate] Anthropic failed:", error)
      }
    }

    // Try OpenAI if available
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: VISION_REGENERATE_SYSTEM_PROMPT },
              { role: "user", content: userPrompt }
            ],
            max_tokens: 2048,
            temperature: 0.7
          })
        })

        if (response.ok) {
          const data = await response.json()
          const responseContent = data.choices?.[0]?.message?.content || ""
          const parsed = parseRegenerateResponse(responseContent)
          if (parsed) {
            return NextResponse.json({
              regenerated: parsed,
              server: "OpenAI",
              model: "gpt-4o-mini",
              source: "openai"
            })
          }
        }
      } catch (error) {
        console.error("[vision-regenerate] OpenAI failed:", error)
      }
    }

    // Try Google Gemini if available
    if (process.env.GOOGLE_AI_API_KEY) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `${VISION_REGENERATE_SYSTEM_PROMPT}\n\n${userPrompt}`
                }]
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048
              }
            })
          }
        )

        if (response.ok) {
          const data = await response.json()
          const responseContent = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
          const parsed = parseRegenerateResponse(responseContent)
          if (parsed) {
            return NextResponse.json({
              regenerated: parsed,
              server: "Google",
              model: "gemini-1.5-flash",
              source: "google"
            })
          }
        }
      } catch (error) {
        console.error("[vision-regenerate] Google failed:", error)
      }
    }

    // All providers failed
    return NextResponse.json(
      { error: "No AI providers available for regeneration. Please ensure at least one LLM is configured." },
      { status: 503 }
    )

  } catch (error) {
    console.error("[vision-regenerate] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate vision" },
      { status: 500 }
    )
  }
}
