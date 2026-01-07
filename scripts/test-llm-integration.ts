#!/usr/bin/env npx ts-node
/**
 * Test LLM Integration
 *
 * Tests the actual connection to local LLM servers and generates a simple response.
 * Run with: npx ts-node scripts/test-llm-integration.ts
 */

const BEAST_URL = "http://192.168.245.155:1234"
const BEDROOM_URL = "http://192.168.27.182:1234"

interface Message {
  role: "system" | "user" | "assistant"
  content: string
}

interface ChatResponse {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    message: Message
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

async function testLLMServer(name: string, baseUrl: string): Promise<boolean> {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`Testing ${name} at ${baseUrl}`)
  console.log("=".repeat(60))

  try {
    // Test models endpoint
    console.log("\n1. Checking /v1/models...")
    const modelsRes = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(5000)
    })

    if (!modelsRes.ok) {
      console.log(`   ❌ Failed: ${modelsRes.status} ${modelsRes.statusText}`)
      return false
    }

    const modelsData = await modelsRes.json()
    const models = modelsData.data || []
    console.log(`   ✅ Found ${models.length} models`)

    if (models.length > 0) {
      console.log(`   Models: ${models.slice(0, 3).map((m: { id: string }) => m.id).join(", ")}${models.length > 3 ? "..." : ""}`)
    }

    // Pick a model to test
    const testModel = models[0]?.id
    if (!testModel) {
      console.log("   ⚠️ No models available to test")
      return true // Server works, just no models
    }

    // Test chat completion
    console.log(`\n2. Testing chat completion with ${testModel}...`)

    const chatRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: testModel,
        messages: [
          { role: "system", content: "You are a helpful coding assistant. Be concise." },
          { role: "user", content: "Write a one-line TypeScript function that adds two numbers." }
        ],
        max_tokens: 100,
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!chatRes.ok) {
      const errorText = await chatRes.text()
      console.log(`   ❌ Chat failed: ${chatRes.status} - ${errorText.slice(0, 100)}`)
      return false
    }

    const chatData: ChatResponse = await chatRes.json()
    const response = chatData.choices?.[0]?.message?.content || ""

    console.log(`   ✅ Got response (${chatData.usage?.completion_tokens || "?"} tokens)`)
    console.log(`   Response: ${response.slice(0, 150)}${response.length > 150 ? "..." : ""}`)

    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`   ❌ Error: ${message}`)
    return false
  }
}

async function testCodeGeneration(baseUrl: string, model: string): Promise<void> {
  console.log(`\n${"=".repeat(60)}`)
  console.log("Testing Code Generation (Packet Simulation)")
  console.log("=".repeat(60))

  const prompt = `You are generating code for a Next.js project.

Generate a simple React component that displays a greeting card with:
- A title prop
- A message prop
- Styled with Tailwind CSS

Output ONLY the TypeScript code, no explanations.`

  console.log("\nPrompt:", prompt.slice(0, 100) + "...")

  try {
    const startTime = Date.now()

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are an expert TypeScript/React developer. Output clean, production-ready code." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.2
      }),
      signal: AbortSignal.timeout(60000)
    })

    const duration = Date.now() - startTime

    if (!res.ok) {
      console.log(`❌ Failed: ${res.status}`)
      return
    }

    const data: ChatResponse = await res.json()
    const code = data.choices?.[0]?.message?.content || ""

    console.log(`\n✅ Generated in ${(duration / 1000).toFixed(1)}s`)
    console.log(`Tokens: ${data.usage?.prompt_tokens} prompt, ${data.usage?.completion_tokens} completion`)
    console.log(`\n--- Generated Code ---`)
    console.log(code)
    console.log("--- End Code ---")

    // Simple validation
    const hasExport = code.includes("export")
    const hasFunction = code.includes("function") || code.includes("=>")
    const hasProps = code.includes("props") || code.includes("title") || code.includes("message")

    console.log(`\nValidation:`)
    console.log(`  Has export: ${hasExport ? "✅" : "❌"}`)
    console.log(`  Has function: ${hasFunction ? "✅" : "❌"}`)
    console.log(`  Has props: ${hasProps ? "✅" : "❌"}`)

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`❌ Error: ${message}`)
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗")
  console.log("║           CLAUDIA LLM INTEGRATION TEST                     ║")
  console.log("║                                                            ║")
  console.log("║  Testing real connections to local LLM servers             ║")
  console.log("╚════════════════════════════════════════════════════════════╝")

  const results: { name: string; success: boolean }[] = []

  // Test BEAST
  const beastOk = await testLLMServer("BEAST", BEAST_URL)
  results.push({ name: "BEAST", success: beastOk })

  // Test BEDROOM
  const bedroomOk = await testLLMServer("BEDROOM", BEDROOM_URL)
  results.push({ name: "BEDROOM", success: bedroomOk })

  // If BEAST works, test code generation
  if (beastOk) {
    await testCodeGeneration(BEAST_URL, "openai/gpt-oss-20b")
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`)
  console.log("SUMMARY")
  console.log("=".repeat(60))

  for (const result of results) {
    console.log(`${result.success ? "✅" : "❌"} ${result.name}`)
  }

  const allPass = results.every(r => r.success)
  console.log(`\n${allPass ? "✅ All LLM servers operational!" : "⚠️ Some servers failed"}`)
}

main().catch(console.error)
