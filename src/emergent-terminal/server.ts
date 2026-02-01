/**
 * Emergent Terminal Server
 *
 * A standalone terminal server that runs independently of the main Claudia Coder app.
 * Used for developing/fixing Claudia Coder itself, emergent modules, and general coding.
 *
 * Features:
 * - Runs on separate port (default 3100)
 * - Survives main app crashes/restarts
 * - Password protected when accessed directly
 * - Session persistence
 * - Pop-out capability
 */

import express from "express"
import { createServer as createHttpServer } from "http"
import { createServer as createHttpsServer } from "https"
import { WebSocketServer, WebSocket } from "ws"
import * as pty from "node-pty"
import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"
import * as os from "os"

// Configuration
const PORT = parseInt(process.env.EMERGENT_PORT || "3100", 10)
const STORAGE_DIR = path.join(process.cwd(), ".local-storage")
const TOKEN_FILE = path.join(STORAGE_DIR, "emergent-token.json")
const SESSIONS_FILE = path.join(STORAGE_DIR, "emergent-sessions.json")
const TMUX_SESSION_NAME = process.env.EMERGENT_TMUX_SESSION || "emergent"
// Disable tmux by default - it breaks mouse selection in browser
const USE_TMUX = process.env.EMERGENT_USE_TMUX === "true" // Default to false

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
}

// Token management
interface TokenData {
  token: string
  createdAt: string
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

function loadOrCreateToken(): string {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8")) as TokenData
      return data.token
    }
  } catch (_err) {
    console.error("[Emergent] Error loading token, generating new one")
  }

  // Generate new token
  const token = generateToken()
  const data: TokenData = {
    token,
    createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2))
  return token
}

function regenerateToken(): string {
  const token = generateToken()
  const data: TokenData = {
    token,
    createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2))
  console.log("[Emergent] Token regenerated")
  return token
}

// Session management
interface TerminalSession {
  id: string
  pid: number
  createdAt: string
  lastActiveAt: string
  workingDirectory: string
  command: string
}

interface SessionStore {
  sessions: TerminalSession[]
}

function loadSessions(): SessionStore {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf-8"))
    }
  } catch (_err) {
    console.error("[Emergent] Error loading sessions")
  }
  return { sessions: [] }
}

function saveSessions(store: SessionStore): void {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(store, null, 2))
}

// Active terminal processes
const activeTerminals = new Map<string, pty.IPty>()
const terminalClients = new Map<string, Set<WebSocket>>()

// ============== TMUX-LITE: Shared session for multi-device real-time sync ==============
interface SharedSession {
  pty: pty.IPty | null
  clients: Set<WebSocket>
  outputBuffer: string[]  // Rolling buffer of recent output
  maxBufferLines: number
  sessionId: string
  createdAt: Date
}

const SHARED_SESSION: SharedSession = {
  pty: null,
  clients: new Set(),
  outputBuffer: [],
  maxBufferLines: 5000,  // Keep last 5000 chunks for replay
  sessionId: crypto.randomBytes(8).toString("hex"),
  createdAt: new Date()
}

function broadcastToClients(message: string) {
  const payload = JSON.stringify({ type: "output", data: message })
  SHARED_SESSION.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  })
}

function addToBuffer(data: string) {
  SHARED_SESSION.outputBuffer.push(data)
  // Trim buffer if too large
  if (SHARED_SESSION.outputBuffer.length > SHARED_SESSION.maxBufferLines) {
    SHARED_SESSION.outputBuffer = SHARED_SESSION.outputBuffer.slice(-SHARED_SESSION.maxBufferLines)
  }
}

function replayBufferToClient(ws: WebSocket) {
  // Send all buffered output to new client
  if (SHARED_SESSION.outputBuffer.length > 0) {
    const fullOutput = SHARED_SESSION.outputBuffer.join("")
    ws.send(JSON.stringify({ type: "output", data: fullOutput }))
  }
}

function createSharedPty(cols: number, rows: number): pty.IPty {
  const shell = process.env.SHELL || (os.platform() === "win32" ? "powershell.exe" : "bash")

  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: cols || 80,
    rows: rows || 24,
    cwd: process.cwd(),
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    },
  })

  ptyProcess.onData((output) => {
    addToBuffer(output)
    broadcastToClients(output)
  })

  ptyProcess.onExit(({ exitCode }) => {
    const exitMsg = JSON.stringify({ type: "exit", code: exitCode })
    SHARED_SESSION.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(exitMsg)
      }
    })
    SHARED_SESSION.pty = null
  })

  return ptyProcess
}
// ============== END TMUX-LITE ==============

// Check if tmux is available
function isTmuxAvailable(): boolean {
  try {
    const { execSync } = require("child_process")
    execSync("which tmux", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

// Check if a tmux session exists
function tmuxSessionExists(sessionName: string): boolean {
  try {
    const { execSync } = require("child_process")
    execSync(`tmux has-session -t ${sessionName} 2>/dev/null`, { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

// Get tmux command to create or attach to session
function getTmuxCommand(sessionName: string): string[] {
  // -A: attach if session exists, create if not
  // -s: session name
  return ["tmux", "new-session", "-A", "-s", sessionName]
}

const TMUX_AVAILABLE = USE_TMUX && isTmuxAvailable()
if (USE_TMUX && !TMUX_AVAILABLE) {
  console.log("[Emergent] tmux not found, falling back to regular shell")
} else if (TMUX_AVAILABLE) {
  console.log("[Emergent] tmux enabled for session persistence")
}

// Check for --regenerate-token flag
if (process.argv.includes("--regenerate-token")) {
  regenerateToken()
  console.log("[Emergent] Token regenerated. Exiting.")
  process.exit(0)
}

// Load access token
const ACCESS_TOKEN = loadOrCreateToken()

// Express app
const app = express()

// CORS middleware for cross-origin requests from main app
app.use((req, res, next) => {
  // Allow requests from localhost on any port (for main Claudia app)
  const origin = req.headers.origin
  if (origin && (origin.includes("localhost") || origin.includes("127.0.0.1"))) {
    res.header("Access-Control-Allow-Origin", origin)
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.header("Access-Control-Allow-Headers", "Content-Type, X-Emergent-Token")
    res.header("Access-Control-Allow-Credentials", "true")
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(200)
    return
  }
  next()
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Session cookies (simple in-memory for now)
const authenticatedSessions = new Set<string>()

function generateSessionId(): string {
  return crypto.randomBytes(16).toString("hex")
}

// Parse cookies
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies

  cookieHeader.split(";").forEach((cookie) => {
    const [name, value] = cookie.trim().split("=")
    if (name && value) {
      cookies[name] = value
    }
  })
  return cookies
}

// Check if request is authenticated
function isAuthenticated(req: express.Request): boolean {
  const cookies = parseCookies(req.headers.cookie)
  const sessionId = cookies["emergent_session"]

  if (sessionId && authenticatedSessions.has(sessionId)) {
    return true
  }

  // Check for token in header (for iframe access from main app)
  const authHeader = req.headers["x-emergent-token"]
  if (authHeader === ACCESS_TOKEN) {
    return true
  }

  // Check query param (for initial iframe load)
  if (req.query.token === ACCESS_TOKEN) {
    return true
  }

  return false
}

// Auth middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (isAuthenticated(req)) {
    next()
  } else {
    res.redirect("/login")
  }
}

// Serve static files from public directory
const publicDir = path.join(__dirname, "public")

// Login page
app.get("/login", (req, res) => {
  // If already authenticated, redirect to terminal
  if (isAuthenticated(req)) {
    res.redirect("/")
    return
  }

  const error = req.query.error ? "Invalid token. Please try again." : ""

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Emergent Terminal - Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e4e4e7;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-container {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 32px;
      width: 100%;
      max-width: 400px;
    }
    .logo {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo h1 {
      font-size: 24px;
      font-weight: 600;
      color: #22c55e;
    }
    .logo p {
      color: #71717a;
      font-size: 14px;
      margin-top: 4px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      color: #a1a1aa;
    }
    input[type="password"] {
      width: 100%;
      padding: 12px;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 8px;
      color: #e4e4e7;
      font-size: 14px;
      font-family: monospace;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #22c55e;
    }
    button {
      width: 100%;
      padding: 12px;
      background: #22c55e;
      border: none;
      border-radius: 8px;
      color: #000;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #16a34a;
    }
    .error {
      background: #7f1d1d;
      border: 1px solid #991b1b;
      color: #fecaca;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .info {
      margin-top: 24px;
      padding: 16px;
      background: #1c1917;
      border: 1px solid #292524;
      border-radius: 8px;
      font-size: 13px;
      color: #a8a29e;
    }
    .info code {
      background: #292524;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="logo">
      <h1>Emergent Terminal</h1>
      <p>Claudia Coder Development Environment</p>
    </div>
    ${error ? `<div class="error">${error}</div>` : ""}
    <form method="POST" action="/login">
      <div class="form-group">
        <label for="token">Access Token</label>
        <input type="password" id="token" name="token" placeholder="Enter your access token" required autofocus>
      </div>
      <button type="submit">Authenticate</button>
    </form>
    <div class="info">
      <p>The access token is displayed in the console when the Emergent Terminal server starts.</p>
      <p style="margin-top: 8px;">Location: <code>.local-storage/emergent-token.json</code></p>
    </div>
  </div>
</body>
</html>`)
})

// Login POST handler
app.post("/login", (req, res) => {
  const { token } = req.body

  if (token === ACCESS_TOKEN) {
    const sessionId = generateSessionId()
    authenticatedSessions.add(sessionId)

    res.cookie("emergent_session", sessionId, {
      httpOnly: true,
      secure: false, // Allow HTTP for localhost
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    })
    res.redirect("/")
  } else {
    res.redirect("/login?error=1")
  }
})

// Logout
app.get("/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie)
  const sessionId = cookies["emergent_session"]
  if (sessionId) {
    authenticatedSessions.delete(sessionId)
  }
  res.clearCookie("emergent_session")
  res.redirect("/login")
})

// Main terminal page (protected)
app.get("/", requireAuth, (req, res) => {
  const isPopout = req.query.popout === "true"

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Emergent Terminal</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e4e4e7;
    }
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: #18181b;
      border-bottom: 1px solid #27272a;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #22c55e;
    }
    .logo svg {
      width: 20px;
      height: 20px;
    }
    .session-info {
      font-size: 12px;
      color: #71717a;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      padding: 6px 12px;
      background: #27272a;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      color: #e4e4e7;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #3f3f46;
    }
    .btn-primary {
      background: #22c55e;
      border-color: #22c55e;
      color: #000;
    }
    .btn-primary:hover {
      background: #16a34a;
    }
    .btn svg {
      width: 14px;
      height: 14px;
    }
    .terminal-container {
      flex: 1;
      padding: 8px;
      overflow: hidden;
    }
    #terminal {
      height: 100%;
    }
    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 16px;
      background: #18181b;
      border-top: 1px solid #27272a;
      font-size: 11px;
      color: #71717a;
    }
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
    }
    .status-dot.connected {
      background: #22c55e;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-left">
        <div class="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 17l6-6-6-6M12 19h8"/>
          </svg>
          Emergent Terminal
        </div>
        <span class="session-info" id="sessionInfo">Connecting...</span>
      </div>
      <div class="header-right">
        <button class="btn" id="clearBtn" title="Clear terminal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>
          </svg>
          Clear
        </button>
        ${!isPopout ? `
        <button class="btn" id="popoutBtn" title="Open in new window">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
          </svg>
          Pop Out
        </button>
        ` : ""}
        <button class="btn" id="newSessionBtn" title="Start new session">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Session
        </button>
        <a href="/logout" class="btn">Logout</a>
      </div>
    </header>
    <div class="terminal-container">
      <div id="terminal"></div>
    </div>
    <div class="status-bar">
      <div class="status-indicator">
        <div class="status-dot" id="statusDot"></div>
        <span id="statusText">Disconnected</span>
      </div>
      <div id="workingDir">~</div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js"></script>
  <script>
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, monospace',
      scrollback: 10000,
      smoothScrollDuration: 0,  // Instant scroll, no animation lag
      theme: {
        background: '#0a0a0a',
        foreground: '#e4e4e7',
        cursor: '#22c55e',
        cursorAccent: '#0a0a0a',
        selection: 'rgba(34, 197, 94, 0.3)',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e4e4e7',
        brightBlack: '#71717a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#fafafa'
      }
    });

    const fitAddon = new FitAddon.FitAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(document.getElementById('terminal'));
    fitAddon.fit();

    let ws = null;
    let sessionId = null;
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const sessionInfo = document.getElementById('sessionInfo');

    function updateStatus(connected) {
      statusDot.className = 'status-dot' + (connected ? ' connected' : '');
      statusText.textContent = connected ? 'Connected' : 'Disconnected';
    }

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Pass token from URL to WebSocket for authentication
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token') || '';
      const wsUrl = protocol + '//' + window.location.host + '/ws' + (token ? '?token=' + token : '');
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        updateStatus(true);
        terminal.writeln('\\x1b[32mConnected to Emergent Terminal\\x1b[0m');
        terminal.writeln('\\x1b[90mWorking directory: ' + '${process.cwd()}' + '\\x1b[0m');
        terminal.writeln('\\x1b[90mtmux: ${TMUX_AVAILABLE ? "enabled (session: " + TMUX_SESSION_NAME + ")" : "disabled"}\\x1b[0m');
        terminal.writeln('');

        // Request new session or resume (will reattach to tmux if available)
        ws.send(JSON.stringify({ type: 'start', cols: terminal.cols, rows: terminal.rows }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'output') {
          terminal.write(data.data);
        } else if (data.type === 'session') {
          sessionId = data.sessionId;
          if (data.shared) {
            sessionInfo.textContent = 'Shared (' + data.clients + ' client' + (data.clients > 1 ? 's' : '') + ')';
            sessionInfo.style.color = '#22c55e';
            if (data.isNew) {
              terminal.clear();
              terminal.writeln('\\x1b[32mNew shared session created\\x1b[0m');
            }
          } else {
            sessionInfo.textContent = 'Session: ' + sessionId.substring(0, 8);
          }
        } else if (data.type === 'exit') {
          terminal.writeln('\\n\\x1b[33mProcess exited with code ' + data.code + '\\x1b[0m');
          sessionInfo.textContent = 'Session ended';
        }
      };

      ws.onclose = () => {
        updateStatus(false);
        terminal.writeln('\\n\\x1b[31mDisconnected. Reconnecting...\\x1b[0m');
        setTimeout(connect, 2000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    }

    terminal.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    terminal.onResize(({ cols, rows }) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    window.addEventListener('resize', () => {
      fitAddon.fit();
    });

    // Button handlers
    document.getElementById('clearBtn').onclick = () => {
      terminal.clear();
    };

    const popoutBtn = document.getElementById('popoutBtn');
    if (popoutBtn) {
      popoutBtn.onclick = () => {
        window.open(window.location.origin + '?popout=true', 'EmergentTerminal',
          'width=1000,height=700,menubar=no,toolbar=no,location=no,status=no');
      };
    }

    document.getElementById('newSessionBtn').onclick = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'new' }));
        terminal.clear();
      }
    };

    // Intercept mouse wheel events to scroll xterm.js locally
    const terminalEl = document.getElementById('terminal');
    terminalEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Faster scroll: minimum 5 lines, scales with wheel speed
      const lines = e.deltaY > 0
        ? Math.max(5, Math.ceil(e.deltaY / 15))
        : Math.min(-5, Math.floor(e.deltaY / 15));
      terminal.scrollLines(lines);
    }, { passive: false });

    // Auto-copy selection to clipboard
    terminal.onSelectionChange(() => {
      const selection = terminal.getSelection();
      if (selection && selection.length > 0) {
        navigator.clipboard.writeText(selection).catch(() => {});
      }
    });

    // Ctrl+Shift+C to copy, Ctrl+Shift+V to paste
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
        }
      } else if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        navigator.clipboard.readText().then(text => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data: text }));
          }
        });
      }
    });

    // Right-click to copy selection
    terminalEl.addEventListener('contextmenu', (e) => {
      const selection = terminal.getSelection();
      if (selection && selection.length > 0) {
        e.preventDefault();
        navigator.clipboard.writeText(selection).then(() => {
          // Brief visual feedback
          const orig = terminalEl.style.outline;
          terminalEl.style.outline = '2px solid #22c55e';
          setTimeout(() => { terminalEl.style.outline = orig; }, 200);
        });
      }
    });

    // Start connection
    connect();
  </script>
</body>
</html>`)
})

// API endpoint for health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() })
})

// API endpoint to get token (for main app integration)
app.get("/api/token", (req, res) => {
  // Only allow from localhost
  const host = req.headers.host || ""
  if (!host.includes("localhost") && !host.includes("127.0.0.1")) {
    res.status(403).json({ error: "Forbidden" })
    return
  }

  res.json({ token: ACCESS_TOKEN })
})

// SSL certificates for HTTPS (same as main app)
const SSL_KEY = path.join(process.cwd(), "localhost.key")
const SSL_CERT = path.join(process.cwd(), "localhost.crt")

// Create HTTPS server if certs available, otherwise HTTP
let server: ReturnType<typeof createHttpsServer> | ReturnType<typeof createHttpServer>
let useHttps = false

if (fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)) {
  try {
    const sslOptions = {
      key: fs.readFileSync(SSL_KEY),
      cert: fs.readFileSync(SSL_CERT),
    }
    server = createHttpsServer(sslOptions, app)
    useHttps = true
    console.log("[Emergent] Using HTTPS with local certificates")
  } catch (err) {
    console.error("[Emergent] Failed to load SSL certs, falling back to HTTP:", err)
    server = createHttpServer(app)
  }
} else {
  console.log("[Emergent] No SSL certs found, using HTTP")
  server = createHttpServer(app)
}

// WebSocket server for terminal
const wss = new WebSocketServer({ server, path: "/ws" })

wss.on("connection", (ws, req) => {
  // Check authentication via cookie or token
  const cookies = parseCookies(req.headers.cookie)
  const sessionId = cookies["emergent_session"]
  const urlParams = new URLSearchParams(req.url?.split("?")[1] || "")
  const tokenParam = urlParams.get("token")

  if (!authenticatedSessions.has(sessionId || "") && tokenParam !== ACCESS_TOKEN) {
    ws.close(4001, "Unauthorized")
    return
  }

  // Add this client to the shared session
  SHARED_SESSION.clients.add(ws)
  console.log(`[Emergent] Client connected (${SHARED_SESSION.clients.size} total)`)

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString())

      switch (data.type) {
        case "start":
          // Join existing session or create new one
          if (SHARED_SESSION.pty) {
            // Replay buffer to this client so they see existing content
            console.log(`[Emergent] Client joining existing session (buffer: ${SHARED_SESSION.outputBuffer.length} chunks)`)
            replayBufferToClient(ws)
          } else {
            // Create new shared PTY
            console.log("[Emergent] Creating new shared session")
            SHARED_SESSION.pty = createSharedPty(data.cols || 80, data.rows || 24)
            SHARED_SESSION.sessionId = crypto.randomBytes(8).toString("hex")
            SHARED_SESSION.outputBuffer = []
          }

          ws.send(JSON.stringify({
            type: "session",
            sessionId: SHARED_SESSION.sessionId,
            shared: true,
            clients: SHARED_SESSION.clients.size
          }))
          break

        case "new":
          // Kill existing session and start fresh
          if (SHARED_SESSION.pty) {
            SHARED_SESSION.pty.kill()
            SHARED_SESSION.pty = null
          }
          SHARED_SESSION.outputBuffer = []
          SHARED_SESSION.sessionId = crypto.randomBytes(8).toString("hex")
          SHARED_SESSION.pty = createSharedPty(data.cols || 80, data.rows || 24)

          // Notify all clients of new session
          const newSessionMsg = JSON.stringify({
            type: "session",
            sessionId: SHARED_SESSION.sessionId,
            shared: true,
            clients: SHARED_SESSION.clients.size,
            isNew: true
          })
          SHARED_SESSION.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(newSessionMsg)
            }
          })
          console.log("[Emergent] New shared session created")
          break

        case "input":
          if (SHARED_SESSION.pty) {
            SHARED_SESSION.pty.write(data.data)
          }
          break

        case "resize":
          if (SHARED_SESSION.pty) {
            SHARED_SESSION.pty.resize(data.cols, data.rows)
          }
          break
      }
    } catch (err) {
      console.error("[Emergent] WebSocket message error:", err)
    }
  })

  ws.on("close", () => {
    SHARED_SESSION.clients.delete(ws)
    console.log(`[Emergent] Client disconnected (${SHARED_SESSION.clients.size} remaining)`)
    // Don't kill the PTY - other clients may still be connected
  })
})

// Start server
server.listen(PORT, () => {
  const protocol = useHttps ? "https" : "http"
  console.log("")
  console.log("╔══════════════════════════════════════════════════════════════╗")
  console.log("║                    EMERGENT TERMINAL                         ║")
  console.log("╠══════════════════════════════════════════════════════════════╣")
  console.log(`║  Server running on: ${protocol}://localhost:${PORT}                   ║`)
  console.log("║                                                              ║")
  console.log("║  Access Token:                                               ║")
  console.log(`║  ${ACCESS_TOKEN.substring(0, 60)}  ║`)
  console.log(`║  ${ACCESS_TOKEN.substring(60)}                                  ║`)
  console.log("║                                                              ║")
  console.log("║  Token saved to: .local-storage/emergent-token.json          ║")
  console.log("║  Regenerate with: npm run emergent -- --regenerate-token     ║")
  console.log("╚══════════════════════════════════════════════════════════════╝")
  console.log("")
})

// Handle shutdown gracefully
process.on("SIGINT", () => {
  console.log("\n[Emergent] Shutting down...")

  // Kill shared PTY
  if (SHARED_SESSION.pty) {
    console.log("[Emergent] Killing shared session")
    SHARED_SESSION.pty.kill()
  }

  // Close all client connections
  SHARED_SESSION.clients.forEach(client => {
    client.close()
  })

  server.close(() => {
    console.log("[Emergent] Server closed")
    process.exit(0)
  })
})

process.on("SIGTERM", () => {
  process.emit("SIGINT", "SIGINT")
})
