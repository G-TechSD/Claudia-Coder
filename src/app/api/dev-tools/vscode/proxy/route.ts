/**
 * VS Code Proxy - Forwards requests to code-server and removes CSP headers
 * This allows embedding code-server in an iframe from a different origin
 */

import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Get the port from query params or default
function getCodeServerUrl(request: NextRequest): string {
  const { searchParams } = new URL(request.url)
  const port = searchParams.get("port") || "8100"
  const path = searchParams.get("path") || "/"
  return `http://127.0.0.1:${port}${path}`
}

export async function GET(request: NextRequest) {
  try {
    const targetUrl = getCodeServerUrl(request)

    // Forward headers but remove ones that cause issues
    const headers = new Headers()
    request.headers.forEach((value, key) => {
      if (!["host", "connection"].includes(key.toLowerCase())) {
        headers.set(key, value)
      }
    })

    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
      redirect: "follow",
    })

    // Copy response but modify headers to allow iframe embedding
    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
      // Skip CSP and X-Frame-Options which prevent iframe embedding
      if (!["content-security-policy", "x-frame-options"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    })

    // Allow iframe embedding
    responseHeaders.set("X-Frame-Options", "ALLOWALL")

    const body = await response.arrayBuffer()

    return new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error("[vscode-proxy] Error:", error)
    return NextResponse.json(
      { error: "Failed to proxy request to code-server" },
      { status: 502 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const targetUrl = getCodeServerUrl(request)
    const body = await request.arrayBuffer()

    const headers = new Headers()
    request.headers.forEach((value, key) => {
      if (!["host", "connection"].includes(key.toLowerCase())) {
        headers.set(key, value)
      }
    })

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body,
      redirect: "follow",
    })

    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
      if (!["content-security-policy", "x-frame-options"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    })

    const responseBody = await response.arrayBuffer()

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error("[vscode-proxy] Error:", error)
    return NextResponse.json(
      { error: "Failed to proxy request to code-server" },
      { status: 502 }
    )
  }
}
