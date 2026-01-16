import { NextRequest, NextResponse } from "next/server"

function generateHtmlPage(code: string, state: string | null, redirectUrl: string): string {
  const escapedCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gemini Authorization Complete</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #e0e0e0;
    }
    .container {
      background: #1e1e2e;
      border-radius: 16px;
      padding: 40px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      border: 1px solid #333;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335);
      border-radius: 50%;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
    }
    h1 {
      text-align: center;
      margin-bottom: 16px;
      color: #fff;
      font-size: 24px;
    }
    .status {
      text-align: center;
      color: #888;
      margin-bottom: 32px;
      font-size: 14px;
    }
    .status.redirecting {
      color: #4ade80;
    }
    .code-section {
      background: #2a2a3e;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .code-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #888;
      margin-bottom: 12px;
    }
    .code-display {
      background: #1a1a28;
      border: 2px solid #444;
      border-radius: 8px;
      padding: 16px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 14px;
      word-break: break-all;
      color: #4ade80;
      position: relative;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .code-display:hover {
      border-color: #4ade80;
    }
    .copy-btn {
      display: block;
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, #4285f4, #5a9cf5);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .copy-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(66, 133, 244, 0.4);
    }
    .copy-btn:active {
      transform: translateY(0);
    }
    .copy-btn.copied {
      background: linear-gradient(135deg, #22c55e, #16a34a);
    }
    .instructions {
      margin-top: 24px;
      padding: 20px;
      background: #252536;
      border-radius: 8px;
      border-left: 4px solid #4285f4;
    }
    .instructions h3 {
      font-size: 14px;
      color: #fff;
      margin-bottom: 12px;
    }
    .instructions ol {
      padding-left: 20px;
      color: #aaa;
      font-size: 14px;
      line-height: 1.8;
    }
    .instructions li {
      margin-bottom: 4px;
    }
    .note {
      margin-top: 24px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✓</div>
    <h1>Authorization Successful!</h1>
    <p class="status" id="status">Attempting to redirect to Claudia...</p>

    <div class="code-section">
      <div class="code-label">Your Authorization Code</div>
      <div class="code-display" id="codeDisplay" onclick="copyCode()" title="Click to copy">${escapedCode}</div>
    </div>

    <button class="copy-btn" id="copyBtn" onclick="copyCode()">
      Copy Authorization Code
    </button>

    <div class="instructions">
      <h3>If the redirect doesn't work:</h3>
      <ol>
        <li>Copy the authorization code above</li>
        <li>Go to Claudia's Settings page</li>
        <li>Navigate to the Gemini API section</li>
        <li>Paste the code when prompted</li>
      </ol>
    </div>

    <p class="note">
      This page is shown in case you're accessing from a different device than where Claudia is running.
    </p>
  </div>

  <script>
    const code = "${escapedCode}";
    const redirectUrl = "${redirectUrl}";

    // Attempt redirect via JavaScript
    function attemptRedirect() {
      const status = document.getElementById('status');
      status.textContent = 'Redirecting to Claudia...';
      status.className = 'status redirecting';

      // Try to redirect
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1500);

      // If still on page after 3 seconds, show manual instructions
      setTimeout(() => {
        status.textContent = 'Redirect may not have worked. Please copy the code manually.';
        status.className = 'status';
      }, 4000);
    }

    function copyCode() {
      const btn = document.getElementById('copyBtn');
      const codeDisplay = document.getElementById('codeDisplay');

      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        codeDisplay.style.borderColor = '#22c55e';

        setTimeout(() => {
          btn.textContent = 'Copy Authorization Code';
          btn.classList.remove('copied');
          codeDisplay.style.borderColor = '#444';
        }, 2000);
      }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy Authorization Code';
          btn.classList.remove('copied');
        }, 2000);
      });
    }

    // Start redirect attempt when page loads
    attemptRedirect();
  </script>
</body>
</html>`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?oauth_error=${encodeURIComponent(error)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings?oauth_error=no_code", request.url)
    )
  }

  // Build the redirect URL
  const redirectUrl = new URL(`/settings?gemini_oauth_code=${encodeURIComponent(code)}&oauth_state=${state}`, request.url).toString()

  // Return an HTML page that:
  // 1. Displays the code prominently for manual copy
  // 2. Attempts to redirect via JavaScript
  // This handles the case where the user is on a different computer than Claudia
  const html = generateHtmlPage(code, state, redirectUrl)

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  })
}
