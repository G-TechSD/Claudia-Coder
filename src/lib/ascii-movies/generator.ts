/**
 * ASCII Movies Generator
 *
 * This is an emergent module - created from within Claudia Coder itself.
 * It generates and plays ASCII art animations using text characters.
 */

// A single frame of ASCII art
export interface AsciiFrame {
  content: string[]  // Array of lines
  duration: number   // Duration in milliseconds
}

// An ASCII movie (collection of frames)
export interface AsciiMovie {
  id: string
  name: string
  description: string
  author: string
  frames: AsciiFrame[]
  width: number
  height: number
  defaultFps: number
  createdAt: string
  tags: string[]
}

// Pre-built ASCII movie gallery
export const ASCII_MOVIE_GALLERY: AsciiMovie[] = [
  {
    id: "bouncing-ball",
    name: "Bouncing Ball",
    description: "A simple bouncing ball animation",
    author: "AI-assisted",
    width: 40,
    height: 10,
    defaultFps: 8,
    createdAt: new Date().toISOString(),
    tags: ["simple", "classic", "loop"],
    frames: generateBouncingBall(),
  },
  {
    id: "spinner",
    name: "Loading Spinner",
    description: "A classic loading spinner animation",
    author: "AI-assisted",
    width: 20,
    height: 5,
    defaultFps: 10,
    createdAt: new Date().toISOString(),
    tags: ["loading", "spinner", "loop"],
    frames: generateSpinner(),
  },
  {
    id: "wave",
    name: "Ocean Wave",
    description: "Waves rolling across the screen",
    author: "AI-assisted",
    width: 50,
    height: 8,
    defaultFps: 6,
    createdAt: new Date().toISOString(),
    tags: ["nature", "wave", "relaxing"],
    frames: generateWave(),
  },
  {
    id: "matrix",
    name: "Matrix Rain",
    description: "Digital rain falling down the screen",
    author: "AI-assisted",
    width: 40,
    height: 15,
    defaultFps: 8,
    createdAt: new Date().toISOString(),
    tags: ["matrix", "rain", "digital"],
    frames: generateMatrixRain(),
  },
  {
    id: "rocket",
    name: "Rocket Launch",
    description: "A rocket launching into space",
    author: "AI-assisted",
    width: 30,
    height: 15,
    defaultFps: 6,
    createdAt: new Date().toISOString(),
    tags: ["rocket", "space", "launch"],
    frames: generateRocketLaunch(),
  },
  {
    id: "fire",
    name: "Campfire",
    description: "A cozy campfire animation",
    author: "AI-assisted",
    width: 35,
    height: 12,
    defaultFps: 8,
    createdAt: new Date().toISOString(),
    tags: ["fire", "cozy", "warm"],
    frames: generateFire(),
  },
]

// Generate bouncing ball frames
function generateBouncingBall(): AsciiFrame[] {
  const frames: AsciiFrame[] = []
  const width = 40
  const height = 10
  const positions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1]

  for (const yPos of positions) {
    const content: string[] = []
    for (let y = 0; y < height; y++) {
      if (y === yPos) {
        content.push(" ".repeat(18) + "●" + " ".repeat(width - 19))
      } else if (y === height - 1) {
        content.push("─".repeat(width))
      } else {
        content.push(" ".repeat(width))
      }
    }
    frames.push({ content, duration: 100 })
  }

  return frames
}

// Generate spinner frames
function generateSpinner(): AsciiFrame[] {
  const spinnerChars = ["◐", "◓", "◑", "◒"]
  const frames: AsciiFrame[] = []

  for (const char of spinnerChars) {
    const content = [
      "                    ",
      `         ${char}          `,
      "     Loading...     ",
      "                    ",
      "                    ",
    ]
    frames.push({ content, duration: 100 })
  }

  return frames
}

// Generate wave frames
function generateWave(): AsciiFrame[] {
  const frames: AsciiFrame[] = []
  const width = 50
  const height = 8
  const waveChars = ["~", "≈", "∼", "～"]

  for (let offset = 0; offset < 8; offset++) {
    const content: string[] = []

    for (let y = 0; y < height; y++) {
      let line = ""
      for (let x = 0; x < width; x++) {
        const waveY = Math.sin((x + offset * 3) * 0.3) * 2 + 4
        if (y === Math.floor(waveY)) {
          line += waveChars[(x + offset) % waveChars.length]
        } else if (y > waveY) {
          line += "░"
        } else {
          line += " "
        }
      }
      content.push(line)
    }

    frames.push({ content, duration: 150 })
  }

  return frames
}

// Generate matrix rain frames
function generateMatrixRain(): AsciiFrame[] {
  const frames: AsciiFrame[] = []
  const width = 40
  const height = 15
  const chars = "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ012345789:・.\"=*+-<>¦|_"

  // Initialize rain drops
  const drops: number[] = Array(width).fill(0).map(() => Math.floor(Math.random() * height))

  for (let frame = 0; frame < 12; frame++) {
    const content: string[] = []

    for (let y = 0; y < height; y++) {
      let line = ""
      for (let x = 0; x < width; x++) {
        const dropY = drops[x]
        if (y === dropY) {
          line += chars[Math.floor(Math.random() * chars.length)]
        } else if (y === dropY - 1 || y === dropY - 2) {
          line += chars[Math.floor(Math.random() * chars.length)]
        } else if (y < dropY && Math.random() > 0.7) {
          line += chars[Math.floor(Math.random() * chars.length)]
        } else {
          line += " "
        }
      }
      content.push(line)
    }

    // Move drops down
    for (let i = 0; i < width; i++) {
      drops[i] = (drops[i] + 1) % (height + 5)
      if (drops[i] === 0) drops[i] = Math.floor(Math.random() * -5)
    }

    frames.push({ content, duration: 100 })
  }

  return frames
}

// Generate rocket launch frames
function generateRocketLaunch(): AsciiFrame[] {
  const frames: AsciiFrame[] = []
  const width = 30
  const height = 15

  const rocket = [
    "     /\\     ",
    "    /  \\    ",
    "   |    |   ",
    "   |    |   ",
    "   | CC |   ",
    "   |    |   ",
    "  /|    |\\  ",
    " / |    | \\ ",
    "/__|    |__\\",
  ]

  const flame1 = ["    \\||/    ", "     \\|/     ", "      V      "]
  const flame2 = ["    /|\\     ", "     |/      ", "      v      "]

  for (let frame = 0; frame < 15; frame++) {
    const content: string[] = []
    const rocketY = Math.max(0, 10 - frame)

    for (let y = 0; y < height; y++) {
      if (y >= rocketY && y < rocketY + rocket.length) {
        content.push(" ".repeat(9) + rocket[y - rocketY] + " ".repeat(9))
      } else if (y >= rocketY + rocket.length && y < rocketY + rocket.length + 3) {
        const flameIdx = y - rocketY - rocket.length
        const flames = frame % 2 === 0 ? flame1 : flame2
        content.push(" ".repeat(9) + (flames[flameIdx] || " ".repeat(12)) + " ".repeat(9))
      } else if (y === height - 1 && frame < 5) {
        content.push("═".repeat(width))
      } else {
        content.push(" ".repeat(width))
      }
    }

    frames.push({ content, duration: 150 })
  }

  return frames
}

// Generate fire frames
function generateFire(): AsciiFrame[] {
  const frames: AsciiFrame[] = []
  const width = 35
  const height = 12
  const fireChars = [".", "*", "#", "@", "&", "%", "$"]

  for (let f = 0; f < 8; f++) {
    const content: string[] = []

    for (let y = 0; y < height; y++) {
      let line = ""
      for (let x = 0; x < width; x++) {
        const cx = width / 2
        const dist = Math.abs(x - cx)
        const intensity = Math.max(0, (height - y) / height - dist / (width / 3))

        if (y === height - 1) {
          line += x > 10 && x < 25 ? "▄" : " "
        } else if (y === height - 2) {
          line += x > 8 && x < 27 ? "█" : " "
        } else if (intensity > 0 && Math.random() < intensity * 1.5) {
          const charIdx = Math.min(
            fireChars.length - 1,
            Math.floor((1 - intensity) * fireChars.length + Math.random() * 2)
          )
          line += fireChars[charIdx]
        } else {
          line += " "
        }
      }
      content.push(line)
    }

    frames.push({ content, duration: 120 })
  }

  return frames
}

/**
 * Create a simple text animation from lines of text
 */
export function createTextAnimation(lines: string[], options?: {
  typingSpeed?: number
  pauseAfter?: number
}): AsciiMovie {
  const { typingSpeed = 50, pauseAfter = 2000 } = options || {}
  const frames: AsciiFrame[] = []
  const maxWidth = Math.max(...lines.map(l => l.length))

  // Build up each line character by character
  const currentLines: string[] = []

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    currentLines.push("")
    const line = lines[lineIdx]

    for (let charIdx = 0; charIdx <= line.length; charIdx++) {
      currentLines[lineIdx] = line.slice(0, charIdx) + (charIdx < line.length ? "▌" : "")
      frames.push({
        content: [...currentLines.map(l => l.padEnd(maxWidth))],
        duration: typingSpeed,
      })
    }
  }

  // Add pause at the end
  frames.push({
    content: [...lines.map(l => l.padEnd(maxWidth))],
    duration: pauseAfter,
  })

  return {
    id: `text-${Date.now()}`,
    name: "Text Animation",
    description: "Custom text animation",
    author: "User",
    frames,
    width: maxWidth,
    height: lines.length,
    defaultFps: 1000 / typingSpeed,
    createdAt: new Date().toISOString(),
    tags: ["text", "custom"],
  }
}

/**
 * Create a custom animation from raw frames
 */
export function createCustomAnimation(
  name: string,
  frames: string[][],
  fps: number = 10
): AsciiMovie {
  const width = Math.max(...frames.flatMap(f => f.map(l => l.length)))
  const height = Math.max(...frames.map(f => f.length))

  return {
    id: `custom-${Date.now()}`,
    name,
    description: "Custom animation",
    author: "User",
    frames: frames.map(content => ({
      content: content.map(l => l.padEnd(width)),
      duration: 1000 / fps,
    })),
    width,
    height,
    defaultFps: fps,
    createdAt: new Date().toISOString(),
    tags: ["custom"],
  }
}
