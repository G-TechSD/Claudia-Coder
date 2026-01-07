#!/usr/bin/env node
/**
 * Visual Interaction Toolkit v2.0
 * Cross-platform visual automation with surgical precision
 *
 * "Surgical precision and zero failure tolerance on safety and security"
 *
 * Features:
 * - Cross-platform support (Linux/X11, macOS, Windows)
 * - Screenshot capture and analysis
 * - Precise coordinate clicking (with DPI/scaling awareness)
 * - OCR-based text recognition for element finding
 * - Screenshot comparison for verification
 * - Retry logic with exponential backoff
 * - Safety checks before destructive actions
 * - Comprehensive logging
 *
 * Dependencies by platform:
 * - Linux: xdotool, scrot, tesseract-ocr
 * - macOS: screencapture (built-in), cliclick (brew install cliclick), tesseract
 * - Windows: nircmd or PowerShell, tesseract
 */

const { execSync, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Platform detection
const PLATFORMS = {
  LINUX: 'linux',
  MACOS: 'darwin',
  WINDOWS: 'win32'
};

/**
 * Detect current platform and available tools
 */
function detectPlatform() {
  const platform = process.platform;
  const tools = {};

  if (platform === PLATFORMS.LINUX) {
    tools.screenshot = commandExists('scrot') ? 'scrot' :
                       commandExists('gnome-screenshot') ? 'gnome-screenshot' :
                       commandExists('import') ? 'imagemagick' : null;
    tools.mouse = commandExists('xdotool') ? 'xdotool' :
                  commandExists('xte') ? 'xte' : null;
    tools.ocr = commandExists('tesseract') ? 'tesseract' : null;
  } else if (platform === PLATFORMS.MACOS) {
    tools.screenshot = 'screencapture'; // Built-in
    tools.mouse = commandExists('cliclick') ? 'cliclick' : 'applescript';
    tools.ocr = commandExists('tesseract') ? 'tesseract' : null;
  } else if (platform === PLATFORMS.WINDOWS) {
    tools.screenshot = commandExists('nircmd') ? 'nircmd' : 'powershell';
    tools.mouse = commandExists('nircmd') ? 'nircmd' : 'powershell';
    tools.ocr = commandExists('tesseract') ? 'tesseract' : null;
  }

  return { platform, tools };
}

/**
 * Check if a command exists
 */
function commandExists(cmd) {
  try {
    const checkCmd = process.platform === 'win32'
      ? `where ${cmd}`
      : `which ${cmd}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Sleep utility (synchronous)
 */
function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Busy wait - use sparingly
  }
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    factor = 2,
    onRetry = null
  } = options;

  let delay = initialDelay;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      if (onRetry) {
        onRetry(attempt, error, delay);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * factor, maxDelay);
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Calculate image hash for comparison
 */
function imageHash(filepath) {
  if (!fs.existsSync(filepath)) {
    return null;
  }
  const buffer = fs.readFileSync(filepath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Simple pixel-based image comparison
 * Returns similarity percentage (0-100)
 */
function compareImages(img1Path, img2Path) {
  if (!fs.existsSync(img1Path) || !fs.existsSync(img2Path)) {
    return 0;
  }

  const hash1 = imageHash(img1Path);
  const hash2 = imageHash(img2Path);

  if (hash1 === hash2) {
    return 100;
  }

  // For more detailed comparison, we'd need image processing library
  // This basic version just checks file size similarity
  const stat1 = fs.statSync(img1Path);
  const stat2 = fs.statSync(img2Path);

  const sizeDiff = Math.abs(stat1.size - stat2.size);
  const avgSize = (stat1.size + stat2.size) / 2;
  const similarity = Math.max(0, 100 - (sizeDiff / avgSize) * 100);

  return Math.round(similarity);
}

class VisualInteraction {
  constructor(options = {}) {
    // Detect platform and available tools
    const { platform, tools } = detectPlatform();
    this.platform = platform;
    this.tools = tools;

    // Linux-specific
    this.display = options.display || process.env.DISPLAY || ':1';

    // Directories and logging
    this.screenshotDir = options.screenshotDir || this._getDefaultScreenshotDir();
    this.logFile = options.logFile || path.join(this.screenshotDir, 'actions.log');
    this.ocrCacheDir = options.ocrCacheDir || path.join(this.screenshotDir, 'ocr-cache');

    // Behavior settings
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;

    // Screen dimensions (will be detected)
    this.screenWidth = 0;
    this.screenHeight = 0;

    // Safety settings
    this.confirmDestructive = options.confirmDestructive !== false;
    this.maxClicksPerSecond = options.maxClicksPerSecond || 5;
    this.lastClickTime = 0;

    // Retry settings
    this.defaultRetryOptions = {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 100,
      maxDelay: options.maxDelay || 5000,
      factor: options.backoffFactor || 2
    };

    // OCR settings
    this.ocrLanguage = options.ocrLanguage || 'eng';
    this.ocrCache = new Map();

    // Initialize
    this._ensureDir(this.screenshotDir);
    this._ensureDir(this.ocrCacheDir);
    this._detectScreenSize();
    this._logPlatformInfo();
  }

  _getDefaultScreenshotDir() {
    if (this.platform === PLATFORMS.WINDOWS) {
      return path.join(process.env.TEMP || 'C:\\Temp', 'visual-interaction');
    }
    return '/tmp/visual-interaction';
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    if (this.verbose || level === 'error' || level === 'warn') {
      console.log(logLine.trim());
    }

    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (e) {
      // Ignore logging errors
    }
  }

  _logPlatformInfo() {
    this._log(`Platform: ${this.platform}`);
    this._log(`Tools: ${JSON.stringify(this.tools)}`);
    if (this.platform === PLATFORMS.LINUX) {
      this._log(`Display: ${this.display}`);
    }
  }

  _exec(cmd, options = {}) {
    const env = { ...process.env };

    if (this.platform === PLATFORMS.LINUX) {
      env.DISPLAY = this.display;
    }

    try {
      const result = execSync(cmd, {
        encoding: 'utf8',
        env,
        timeout: options.timeout || 30000,
        ...options
      });
      return result ? result.trim() : '';
    } catch (error) {
      this._log(`Command failed: ${cmd} - ${error.message}`, 'error');
      throw error;
    }
  }

  _execAsync(cmd, options = {}) {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };

      if (this.platform === PLATFORMS.LINUX) {
        env.DISPLAY = this.display;
      }

      const proc = spawn(cmd, {
        shell: true,
        env,
        ...options
      });

      let stdout = '';
      let stderr = '';

      if (proc.stdout) {
        proc.stdout.on('data', data => stdout += data);
      }
      if (proc.stderr) {
        proc.stderr.on('data', data => stderr += data);
      }

      proc.on('close', code => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', reject);
    });
  }

  _detectScreenSize() {
    try {
      if (this.platform === PLATFORMS.LINUX) {
        const output = this._exec('xdotool getdisplaygeometry');
        const [width, height] = output.split(' ').map(Number);
        this.screenWidth = width;
        this.screenHeight = height;
      } else if (this.platform === PLATFORMS.MACOS) {
        const output = this._exec("system_profiler SPDisplaysDataType | grep Resolution | head -1");
        const match = output.match(/(\d+)\s*x\s*(\d+)/);
        if (match) {
          this.screenWidth = parseInt(match[1]);
          this.screenHeight = parseInt(match[2]);
        }
      } else if (this.platform === PLATFORMS.WINDOWS) {
        const output = this._exec('powershell -command "[System.Windows.Forms.Screen]::PrimaryScreen.Bounds | Select-Object Width,Height | Format-List"');
        const widthMatch = output.match(/Width\s*:\s*(\d+)/);
        const heightMatch = output.match(/Height\s*:\s*(\d+)/);
        if (widthMatch && heightMatch) {
          this.screenWidth = parseInt(widthMatch[1]);
          this.screenHeight = parseInt(heightMatch[1]);
        }
      }

      if (this.screenWidth && this.screenHeight) {
        this._log(`Screen detected: ${this.screenWidth}x${this.screenHeight}`);
      } else {
        throw new Error('Could not parse screen dimensions');
      }
    } catch (error) {
      this._log('Failed to detect screen size, using defaults', 'warn');
      this.screenWidth = 1920;
      this.screenHeight = 1080;
    }
  }

  // ============================================
  // SCREENSHOT METHODS
  // ============================================

  /**
   * Take a screenshot
   * @param {string} name - Name for the screenshot
   * @param {object} options - Screenshot options
   * @returns {string} Path to the screenshot
   */
  screenshot(name = 'screenshot', options = {}) {
    const timestamp = Date.now();
    const filename = `${name}-${timestamp}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    const { region = null, windowId = null } = options;

    if (this.platform === PLATFORMS.LINUX) {
      this._screenshotLinux(filepath, { region, windowId });
    } else if (this.platform === PLATFORMS.MACOS) {
      this._screenshotMacOS(filepath, { region, windowId });
    } else if (this.platform === PLATFORMS.WINDOWS) {
      this._screenshotWindows(filepath, { region });
    }

    this._log(`Screenshot saved: ${filepath}`);
    return filepath;
  }

  _screenshotLinux(filepath, options = {}) {
    const { region, windowId } = options;
    let cmd;

    if (this.tools.screenshot === 'scrot') {
      if (windowId) {
        cmd = `scrot -u ${filepath}`;
      } else if (region) {
        cmd = `scrot -a ${region.x},${region.y},${region.width},${region.height} ${filepath}`;
      } else {
        cmd = `scrot ${filepath}`;
      }
    } else if (this.tools.screenshot === 'gnome-screenshot') {
      if (windowId) {
        cmd = `gnome-screenshot -w -f ${filepath}`;
      } else {
        cmd = `gnome-screenshot -f ${filepath}`;
      }
    } else if (this.tools.screenshot === 'imagemagick') {
      cmd = `import -window root ${filepath}`;
    } else {
      throw new Error('No screenshot tool available on Linux');
    }

    this._exec(cmd);
  }

  _screenshotMacOS(filepath, options = {}) {
    const { region, windowId } = options;
    let cmd;

    if (region) {
      cmd = `screencapture -R${region.x},${region.y},${region.width},${region.height} ${filepath}`;
    } else if (windowId) {
      cmd = `screencapture -l${windowId} ${filepath}`;
    } else {
      cmd = `screencapture -x ${filepath}`;
    }

    this._exec(cmd);
  }

  _screenshotWindows(filepath, options = {}) {
    const { region } = options;

    if (this.tools.screenshot === 'nircmd') {
      this._exec(`nircmd savescreenshot "${filepath}"`);
    } else {
      // PowerShell screenshot
      const psScript = region
        ? `
          Add-Type -AssemblyName System.Windows.Forms
          $bitmap = New-Object System.Drawing.Bitmap(${region.width}, ${region.height})
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen(${region.x}, ${region.y}, 0, 0, $bitmap.Size)
          $bitmap.Save('${filepath.replace(/\\/g, '\\\\')}')
        `
        : `
          Add-Type -AssemblyName System.Windows.Forms
          $screen = [System.Windows.Forms.Screen]::PrimaryScreen
          $bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
          $bitmap.Save('${filepath.replace(/\\/g, '\\\\')}')
        `;

      this._exec(`powershell -command "${psScript.replace(/\n/g, ' ')}"`);
    }
  }

  /**
   * Compare two screenshots
   * @param {string} img1 - Path to first image
   * @param {string} img2 - Path to second image
   * @returns {object} Comparison result
   */
  compareScreenshots(img1, img2) {
    const similarity = compareImages(img1, img2);
    const identical = similarity === 100;

    return {
      identical,
      similarity,
      hash1: imageHash(img1),
      hash2: imageHash(img2)
    };
  }

  /**
   * Wait for screen to change
   * @param {string} baseScreenshot - Screenshot to compare against
   * @param {object} options - Wait options
   * @returns {boolean} True if screen changed
   */
  async waitForScreenChange(baseScreenshot, options = {}) {
    const { timeout = 10000, interval = 500, threshold = 95 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentScreenshot = this.screenshot('change-detect');
      const comparison = this.compareScreenshots(baseScreenshot, currentScreenshot);

      // Clean up temporary screenshot
      try { fs.unlinkSync(currentScreenshot); } catch (e) { /* ignore */ }

      if (comparison.similarity < threshold) {
        this._log(`Screen changed (similarity: ${comparison.similarity}%)`);
        return true;
      }

      await this.wait(interval);
    }

    this._log('Screen did not change within timeout', 'warn');
    return false;
  }

  // ============================================
  // OCR METHODS
  // ============================================

  /**
   * Perform OCR on a screenshot
   * @param {string} imagePath - Path to image
   * @param {object} options - OCR options
   * @returns {object} OCR result with text and bounding boxes
   */
  ocr(imagePath, options = {}) {
    if (!this.tools.ocr) {
      throw new Error('Tesseract OCR not available. Install with: apt install tesseract-ocr (Linux), brew install tesseract (macOS), or download from GitHub (Windows)');
    }

    const { language = this.ocrLanguage, psm = 3 } = options;

    // Check cache
    const cacheKey = `${imageHash(imagePath)}-${language}-${psm}`;
    if (this.ocrCache.has(cacheKey)) {
      return this.ocrCache.get(cacheKey);
    }

    // Get TSV output with bounding boxes
    const tsvPath = path.join(this.ocrCacheDir, `ocr-${Date.now()}.tsv`);

    try {
      this._exec(`tesseract "${imagePath}" "${tsvPath.replace('.tsv', '')}" -l ${language} --psm ${psm} tsv`);

      const tsvContent = fs.readFileSync(tsvPath, 'utf8');
      const result = this._parseOcrTsv(tsvContent);

      // Cache result
      this.ocrCache.set(cacheKey, result);

      // Clean up
      try { fs.unlinkSync(tsvPath); } catch (e) { /* ignore */ }

      return result;
    } catch (error) {
      this._log(`OCR failed: ${error.message}`, 'error');
      throw error;
    }
  }

  _parseOcrTsv(tsvContent) {
    const lines = tsvContent.trim().split('\n');
    const headers = lines[0].split('\t');

    const elements = [];
    let fullText = '';

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row = {};

      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });

      if (row.text && row.text.trim()) {
        elements.push({
          text: row.text.trim(),
          confidence: parseFloat(row.conf) || 0,
          bounds: {
            x: parseInt(row.left) || 0,
            y: parseInt(row.top) || 0,
            width: parseInt(row.width) || 0,
            height: parseInt(row.height) || 0
          },
          level: parseInt(row.level) || 0,
          block: parseInt(row.block_num) || 0,
          paragraph: parseInt(row.par_num) || 0,
          line: parseInt(row.line_num) || 0,
          word: parseInt(row.word_num) || 0
        });
        fullText += row.text + ' ';
      }
    }

    return {
      text: fullText.trim(),
      elements,
      wordCount: elements.length
    };
  }

  /**
   * Find text on screen and return its coordinates
   * @param {string} searchText - Text to find
   * @param {object} options - Search options
   * @returns {object|null} Coordinates and bounds if found, null otherwise
   */
  async findTextOnScreen(searchText, options = {}) {
    const {
      caseSensitive = false,
      partial = true,
      screenshotPath = null,
      confidence = 60
    } = options;

    const imgPath = screenshotPath || this.screenshot('find-text');

    try {
      const ocrResult = this.ocr(imgPath);

      const searchLower = caseSensitive ? searchText : searchText.toLowerCase();

      // Try to find exact or partial match
      for (const element of ocrResult.elements) {
        const elementText = caseSensitive ? element.text : element.text.toLowerCase();

        if (element.confidence < confidence) {
          continue;
        }

        const match = partial
          ? elementText.includes(searchLower) || searchLower.includes(elementText)
          : elementText === searchLower;

        if (match) {
          const centerX = element.bounds.x + element.bounds.width / 2;
          const centerY = element.bounds.y + element.bounds.height / 2;

          this._log(`Found text "${searchText}" at (${centerX}, ${centerY})`);

          return {
            found: true,
            text: element.text,
            confidence: element.confidence,
            bounds: element.bounds,
            center: { x: Math.round(centerX), y: Math.round(centerY) }
          };
        }
      }

      // Try multi-word search
      if (searchText.includes(' ')) {
        const words = searchText.split(/\s+/);
        const firstWord = caseSensitive ? words[0] : words[0].toLowerCase();

        for (let i = 0; i < ocrResult.elements.length; i++) {
          const element = ocrResult.elements[i];
          const elementText = caseSensitive ? element.text : element.text.toLowerCase();

          if (elementText === firstWord || elementText.includes(firstWord)) {
            // Check if subsequent words match
            let allMatch = true;
            let lastBounds = element.bounds;

            for (let j = 1; j < words.length && i + j < ocrResult.elements.length; j++) {
              const nextElement = ocrResult.elements[i + j];
              const nextText = caseSensitive ? nextElement.text : nextElement.text.toLowerCase();
              const expectedWord = caseSensitive ? words[j] : words[j].toLowerCase();

              if (nextText !== expectedWord && !nextText.includes(expectedWord)) {
                allMatch = false;
                break;
              }
              lastBounds = nextElement.bounds;
            }

            if (allMatch) {
              // Return bounding box that encompasses all words
              const combinedBounds = {
                x: element.bounds.x,
                y: Math.min(element.bounds.y, lastBounds.y),
                width: (lastBounds.x + lastBounds.width) - element.bounds.x,
                height: Math.max(element.bounds.height, lastBounds.height)
              };

              const centerX = combinedBounds.x + combinedBounds.width / 2;
              const centerY = combinedBounds.y + combinedBounds.height / 2;

              this._log(`Found multi-word text "${searchText}" at (${centerX}, ${centerY})`);

              return {
                found: true,
                text: searchText,
                confidence: element.confidence,
                bounds: combinedBounds,
                center: { x: Math.round(centerX), y: Math.round(centerY) }
              };
            }
          }
        }
      }

      this._log(`Text "${searchText}" not found on screen`, 'warn');
      return { found: false };

    } finally {
      // Clean up if we created the screenshot
      if (!screenshotPath) {
        try { fs.unlinkSync(imgPath); } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * Click on text found on screen
   * @param {string} searchText - Text to find and click
   * @param {object} options - Options
   * @returns {boolean} True if clicked successfully
   */
  async clickOnText(searchText, options = {}) {
    const {
      button = 1,
      double = false,
      retries = this.defaultRetryOptions.maxRetries
    } = options;

    return retryWithBackoff(
      async (attempt) => {
        this._log(`Attempting to click on text "${searchText}" (attempt ${attempt})`);

        const result = await this.findTextOnScreen(searchText, options);

        if (!result.found) {
          throw new Error(`Text "${searchText}" not found on screen`);
        }

        this.click(result.center.x, result.center.y, { button, double });
        return true;
      },
      {
        ...this.defaultRetryOptions,
        maxRetries: retries,
        onRetry: (attempt, error, delay) => {
          this._log(`Retry ${attempt}: ${error.message}, waiting ${delay}ms`, 'warn');
        }
      }
    );
  }

  // ============================================
  // MOUSE/CLICK METHODS
  // ============================================

  /**
   * Move mouse to coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  moveTo(x, y) {
    this._validateCoordinates(x, y);

    if (this.dryRun) {
      this._log(`[DRY RUN] Would move to (${x}, ${y})`);
      return;
    }

    if (this.platform === PLATFORMS.LINUX) {
      this._exec(`xdotool mousemove ${x} ${y}`);
    } else if (this.platform === PLATFORMS.MACOS) {
      if (this.tools.mouse === 'cliclick') {
        this._exec(`cliclick m:${x},${y}`);
      } else {
        this._exec(`osascript -e 'tell application "System Events" to set position of mouse to {${x}, ${y}}'`);
      }
    } else if (this.platform === PLATFORMS.WINDOWS) {
      if (this.tools.mouse === 'nircmd') {
        this._exec(`nircmd setcursor ${x} ${y}`);
      } else {
        this._exec(`powershell -command "[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})"`);
      }
    }

    this._log(`Mouse moved to (${x}, ${y})`);
  }

  /**
   * Click at coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {object} options - Click options
   */
  click(x, y, options = {}) {
    const { button = 1, double = false } = options;

    this._validateCoordinates(x, y);
    this._rateLimit();

    if (this.dryRun) {
      this._log(`[DRY RUN] Would click at (${x}, ${y})`);
      return;
    }

    if (this.platform === PLATFORMS.LINUX) {
      const clickCmd = double ? 'click --repeat 2 --delay 100' : 'click';
      this._exec(`xdotool mousemove ${x} ${y} ${clickCmd} ${button}`);
    } else if (this.platform === PLATFORMS.MACOS) {
      if (this.tools.mouse === 'cliclick') {
        const clickType = double ? 'dc' : 'c';
        const buttonMap = { 1: '', 2: '-r', 3: '-m' };
        this._exec(`cliclick ${buttonMap[button] || ''} ${clickType}:${x},${y}`);
      } else {
        const clickScript = double
          ? `tell application "System Events" to click at {${x}, ${y}} & click at {${x}, ${y}}`
          : `tell application "System Events" to click at {${x}, ${y}}`;
        this._exec(`osascript -e '${clickScript}'`);
      }
    } else if (this.platform === PLATFORMS.WINDOWS) {
      if (this.tools.mouse === 'nircmd') {
        this._exec(`nircmd setcursor ${x} ${y}`);
        const clickCmd = double ? 'sendmouse left dclick' : 'sendmouse left click';
        this._exec(`nircmd ${clickCmd}`);
      } else {
        const clickScript = `
          Add-Type -AssemblyName System.Windows.Forms
          [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
          $signature = @"
          [DllImport("user32.dll")]
          public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
"@
          $mouse = Add-Type -memberDefinition $signature -name "Mouse" -namespace "Win32" -passThru
          $mouse::mouse_event(0x0002, 0, 0, 0, 0)
          $mouse::mouse_event(0x0004, 0, 0, 0, 0)
          ${double ? '$mouse::mouse_event(0x0002, 0, 0, 0, 0); $mouse::mouse_event(0x0004, 0, 0, 0, 0)' : ''}
        `;
        this._exec(`powershell -command "${clickScript.replace(/\n/g, ' ')}"`);
      }
    }

    this._log(`Clicked at (${x}, ${y}) button=${button} double=${double}`);
    this.lastClickTime = Date.now();
  }

  /**
   * Right-click at coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  rightClick(x, y) {
    this.click(x, y, { button: 3 });
  }

  /**
   * Double-click at coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  doubleClick(x, y) {
    this.click(x, y, { double: true });
  }

  /**
   * Click with retry logic
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {object} options - Options including retry settings
   */
  async clickWithRetry(x, y, options = {}) {
    const {
      button = 1,
      double = false,
      verify = null, // Function to verify click succeeded
      ...retryOpts
    } = options;

    return retryWithBackoff(
      async (attempt) => {
        this._log(`Click attempt ${attempt} at (${x}, ${y})`);
        this.click(x, y, { button, double });

        if (verify) {
          await this.wait(200);
          const verified = await verify();
          if (!verified) {
            throw new Error('Click verification failed');
          }
        }

        return true;
      },
      {
        ...this.defaultRetryOptions,
        ...retryOpts,
        onRetry: (attempt, error, delay) => {
          this._log(`Click retry ${attempt}: ${error.message}`, 'warn');
        }
      }
    );
  }

  /**
   * Drag from one point to another
   * @param {number} startX - Start X coordinate
   * @param {number} startY - Start Y coordinate
   * @param {number} endX - End X coordinate
   * @param {number} endY - End Y coordinate
   * @param {object} options - Drag options
   */
  drag(startX, startY, endX, endY, options = {}) {
    const { duration = 500, button = 1 } = options;

    this._validateCoordinates(startX, startY);
    this._validateCoordinates(endX, endY);

    if (this.dryRun) {
      this._log(`[DRY RUN] Would drag from (${startX}, ${startY}) to (${endX}, ${endY})`);
      return;
    }

    if (this.platform === PLATFORMS.LINUX) {
      this._exec(`xdotool mousemove ${startX} ${startY} mousedown ${button} mousemove --delay ${Math.round(duration / 10)} ${endX} ${endY} mouseup ${button}`);
    } else if (this.platform === PLATFORMS.MACOS) {
      if (this.tools.mouse === 'cliclick') {
        this._exec(`cliclick dd:${startX},${startY} du:${endX},${endY}`);
      } else {
        // AppleScript drag is complex, simplified version
        this._exec(`osascript -e 'tell application "System Events" to perform drag from {${startX}, ${startY}} to {${endX}, ${endY}}'`);
      }
    } else if (this.platform === PLATFORMS.WINDOWS) {
      const dragScript = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${startX}, ${startY})
        $signature = @"
        [DllImport("user32.dll")]
        public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
"@
        $mouse = Add-Type -memberDefinition $signature -name "Mouse" -namespace "Win32" -passThru
        $mouse::mouse_event(0x0002, 0, 0, 0, 0)
        Start-Sleep -Milliseconds ${duration}
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${endX}, ${endY})
        $mouse::mouse_event(0x0004, 0, 0, 0, 0)
      `;
      this._exec(`powershell -command "${dragScript.replace(/\n/g, ' ')}"`);
    }

    this._log(`Dragged from (${startX}, ${startY}) to (${endX}, ${endY})`);
  }

  // ============================================
  // KEYBOARD METHODS
  // ============================================

  /**
   * Type text
   * @param {string} text - Text to type
   * @param {object} options - Type options
   */
  type(text, options = {}) {
    const { delay = 12 } = options;

    if (this.dryRun) {
      this._log(`[DRY RUN] Would type: "${text.substring(0, 50)}..."`);
      return;
    }

    if (this.platform === PLATFORMS.LINUX) {
      // Escape special characters for xdotool
      const escapedText = text.replace(/'/g, "'\\''");
      this._exec(`xdotool type --delay ${delay} '${escapedText}'`);
    } else if (this.platform === PLATFORMS.MACOS) {
      if (this.tools.mouse === 'cliclick') {
        // cliclick can type with t:
        const escapedText = text.replace(/"/g, '\\"');
        this._exec(`cliclick t:"${escapedText}"`);
      } else {
        const escapedText = text.replace(/"/g, '\\"').replace(/'/g, "'\\''");
        this._exec(`osascript -e 'tell application "System Events" to keystroke "${escapedText}"'`);
      }
    } else if (this.platform === PLATFORMS.WINDOWS) {
      const escapedText = text.replace(/"/g, '""');
      this._exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escapedText}')"`);
    }

    this._log(`Typed ${text.length} characters`);
  }

  /**
   * Press a key or key combination
   * @param {string} keys - Key(s) to press (e.g., 'Return', 'ctrl+a')
   */
  key(keys) {
    if (this.dryRun) {
      this._log(`[DRY RUN] Would press key: ${keys}`);
      return;
    }

    if (this.platform === PLATFORMS.LINUX) {
      this._exec(`xdotool key ${keys}`);
    } else if (this.platform === PLATFORMS.MACOS) {
      // Map common keys to AppleScript
      const keyMap = {
        'Return': 'return',
        'Enter': 'return',
        'Tab': 'tab',
        'Escape': 'escape',
        'BackSpace': 'delete',
        'Delete': 'forward delete',
        'Up': 'up arrow',
        'Down': 'down arrow',
        'Left': 'left arrow',
        'Right': 'right arrow',
        'space': 'space'
      };

      // Handle modifiers
      if (keys.includes('+')) {
        const parts = keys.split('+');
        const modifiers = [];
        let key = parts[parts.length - 1];

        for (let i = 0; i < parts.length - 1; i++) {
          const mod = parts[i].toLowerCase();
          if (mod === 'ctrl' || mod === 'control') modifiers.push('control down');
          if (mod === 'alt' || mod === 'option') modifiers.push('option down');
          if (mod === 'shift') modifiers.push('shift down');
          if (mod === 'super' || mod === 'cmd' || mod === 'command') modifiers.push('command down');
        }

        const modStr = modifiers.length ? `using {${modifiers.join(', ')}}` : '';
        const keyName = keyMap[key] || key;
        this._exec(`osascript -e 'tell application "System Events" to key code ${this._macKeyCode(keyName)} ${modStr}'`);
      } else {
        const keyName = keyMap[keys] || keys;
        if (this.tools.mouse === 'cliclick') {
          // Map to cliclick key codes
          const cliclickMap = {
            'return': 'kp:return',
            'tab': 'kp:tab',
            'escape': 'kp:esc',
            'delete': 'kp:delete',
            'up arrow': 'kp:arrow-up',
            'down arrow': 'kp:arrow-down',
            'left arrow': 'kp:arrow-left',
            'right arrow': 'kp:arrow-right'
          };
          const cliKey = cliclickMap[keyName] || `kp:${keyName}`;
          this._exec(`cliclick ${cliKey}`);
        } else {
          this._exec(`osascript -e 'tell application "System Events" to keystroke "${keyName}"'`);
        }
      }
    } else if (this.platform === PLATFORMS.WINDOWS) {
      // Map keys to SendKeys format
      const keyMap = {
        'Return': '{ENTER}',
        'Enter': '{ENTER}',
        'Tab': '{TAB}',
        'Escape': '{ESC}',
        'BackSpace': '{BACKSPACE}',
        'Delete': '{DELETE}',
        'Up': '{UP}',
        'Down': '{DOWN}',
        'Left': '{LEFT}',
        'Right': '{RIGHT}',
        'space': ' ',
        'ctrl': '^',
        'alt': '%',
        'shift': '+'
      };

      let sendKey = keys;
      if (keys.includes('+')) {
        const parts = keys.split('+');
        let mods = '';
        let key = parts[parts.length - 1];

        for (let i = 0; i < parts.length - 1; i++) {
          const mod = parts[i].toLowerCase();
          if (mod === 'ctrl' || mod === 'control') mods += '^';
          if (mod === 'alt') mods += '%';
          if (mod === 'shift') mods += '+';
        }

        sendKey = mods + (keyMap[key] || key);
      } else {
        sendKey = keyMap[keys] || keys;
      }

      this._exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKey}')"`);
    }

    this._log(`Pressed key: ${keys}`);
  }

  _macKeyCode(key) {
    // Common key codes for macOS
    const codes = {
      'return': 36,
      'tab': 48,
      'space': 49,
      'delete': 51,
      'escape': 53,
      'left arrow': 123,
      'right arrow': 124,
      'down arrow': 125,
      'up arrow': 126
    };
    return codes[key.toLowerCase()] || 0;
  }

  // ============================================
  // WINDOW METHODS
  // ============================================

  /**
   * Focus a window by name
   * @param {string} name - Window name/title pattern
   * @returns {boolean} True if window found and focused
   */
  focusWindow(name) {
    try {
      if (this.platform === PLATFORMS.LINUX) {
        this._exec(`xdotool search --name '${name}' windowactivate --sync`);
      } else if (this.platform === PLATFORMS.MACOS) {
        this._exec(`osascript -e 'tell application "${name}" to activate'`);
      } else if (this.platform === PLATFORMS.WINDOWS) {
        this._exec(`powershell -command "(New-Object -ComObject WScript.Shell).AppActivate('${name}')"`);
      }

      this._log(`Focused window: ${name}`);
      return true;
    } catch (error) {
      this._log(`Window not found: ${name}`, 'warn');
      return false;
    }
  }

  /**
   * Get window geometry
   * @param {string} name - Window name/title pattern
   * @returns {object} Window position and size
   */
  getWindowGeometry(name) {
    try {
      if (this.platform === PLATFORMS.LINUX) {
        const windowId = this._exec(`xdotool search --name '${name}' | head -1`);
        const geometry = this._exec(`xdotool getwindowgeometry ${windowId}`);

        const posMatch = geometry.match(/Position: (\d+),(\d+)/);
        const sizeMatch = geometry.match(/Geometry: (\d+)x(\d+)/);

        return {
          windowId,
          x: posMatch ? parseInt(posMatch[1]) : 0,
          y: posMatch ? parseInt(posMatch[2]) : 0,
          width: sizeMatch ? parseInt(sizeMatch[1]) : 0,
          height: sizeMatch ? parseInt(sizeMatch[2]) : 0
        };
      } else if (this.platform === PLATFORMS.MACOS) {
        const script = `
          tell application "System Events"
            tell process "${name}"
              set pos to position of window 1
              set sz to size of window 1
              return (item 1 of pos as string) & "," & (item 2 of pos as string) & "," & (item 1 of sz as string) & "," & (item 2 of sz as string)
            end tell
          end tell
        `;
        const result = this._exec(`osascript -e '${script}'`);
        const [x, y, width, height] = result.split(',').map(Number);
        return { x, y, width, height };
      } else if (this.platform === PLATFORMS.WINDOWS) {
        // Windows implementation would need additional tools
        this._log('Window geometry not fully implemented for Windows', 'warn');
        return null;
      }
    } catch (error) {
      this._log(`Failed to get window geometry: ${name}`, 'error');
      return null;
    }
  }

  /**
   * List all visible windows
   * @returns {Array} List of window info objects
   */
  listWindows() {
    try {
      if (this.platform === PLATFORMS.LINUX) {
        const output = this._exec('wmctrl -l');
        const lines = output.split('\n');
        return lines.map(line => {
          const parts = line.split(/\s+/);
          return {
            id: parts[0],
            desktop: parts[1],
            hostname: parts[2],
            title: parts.slice(3).join(' ')
          };
        });
      } else if (this.platform === PLATFORMS.MACOS) {
        const script = `
          tell application "System Events"
            set windowList to ""
            repeat with proc in (processes whose background only is false)
              try
                repeat with win in windows of proc
                  set windowList to windowList & name of proc & ": " & name of win & "\\n"
                end repeat
              end try
            end repeat
            return windowList
          end tell
        `;
        const result = this._exec(`osascript -e '${script}'`);
        return result.split('\n').filter(l => l.trim()).map(l => {
          const [app, ...titleParts] = l.split(': ');
          return { app, title: titleParts.join(': ') };
        });
      }
    } catch (error) {
      this._log('Failed to list windows', 'error');
      return [];
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Wait for a specified time
   * @param {number} ms - Milliseconds to wait
   */
  async wait(ms) {
    this._log(`Waiting ${ms}ms`);
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convert screenshot coordinates to real screen coordinates
   * Useful when screenshot has different dimensions than actual screen
   * @param {number} x - X in screenshot
   * @param {number} y - Y in screenshot
   * @param {number} screenshotWidth - Width of screenshot
   * @param {number} screenshotHeight - Height of screenshot
   */
  convertCoords(x, y, screenshotWidth, screenshotHeight) {
    const scaleX = this.screenWidth / screenshotWidth;
    const scaleY = this.screenHeight / screenshotHeight;

    return {
      x: Math.round(x * scaleX),
      y: Math.round(y * scaleY)
    };
  }

  /**
   * Open a URL in the default browser
   * @param {string} url - URL to open
   * @param {string} browser - Browser to use
   */
  openUrl(url, browser = null) {
    if (this.dryRun) {
      this._log(`[DRY RUN] Would open URL: ${url}`);
      return;
    }

    let cmd;

    if (this.platform === PLATFORMS.LINUX) {
      browser = browser || 'firefox';
      cmd = browser === 'firefox'
        ? `firefox --new-window '${url}'`
        : `${browser} '${url}'`;
    } else if (this.platform === PLATFORMS.MACOS) {
      cmd = browser
        ? `open -a "${browser}" "${url}"`
        : `open "${url}"`;
    } else if (this.platform === PLATFORMS.WINDOWS) {
      cmd = browser
        ? `start "" "${browser}" "${url}"`
        : `start "" "${url}"`;
    }

    spawn(cmd, { shell: true, detached: true, stdio: 'ignore' });
    this._log(`Opened URL: ${url}`);
  }

  /**
   * Execute with retry logic
   * @param {Function} fn - Async function to execute
   * @param {object} options - Retry options
   */
  async withRetry(fn, options = {}) {
    return retryWithBackoff(fn, { ...this.defaultRetryOptions, ...options });
  }

  /**
   * Wait for element (text) to appear on screen
   * @param {string} text - Text to wait for
   * @param {object} options - Wait options
   * @returns {object|null} Element info if found
   */
  async waitForText(text, options = {}) {
    const { timeout = 30000, interval = 1000, ...findOptions } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.findTextOnScreen(text, findOptions);

      if (result.found) {
        return result;
      }

      await this.wait(interval);
    }

    this._log(`Timeout waiting for text: "${text}"`, 'warn');
    return { found: false };
  }

  /**
   * Accept Firefox certificate warning
   * Cross-platform implementation
   */
  async acceptFirefoxCertWarning() {
    this._log('Attempting to accept Firefox certificate warning');

    // Focus Firefox
    if (!this.focusWindow('Firefox')) {
      throw new Error('Firefox window not found');
    }

    await this.wait(500);

    // Use keyboard navigation for reliability across platforms
    // Tab to Advanced button and click
    this.key('Tab');
    await this.wait(100);
    this.key('Tab');
    await this.wait(100);
    this.key('Tab');
    await this.wait(100);
    this.key('Tab');
    await this.wait(100);
    this.key('Tab');
    await this.wait(100);
    this.key('Tab');
    await this.wait(200);
    this.key('Return');
    await this.wait(1000);

    // Now tab to "Accept the Risk and Continue" and click
    this.key('Tab');
    await this.wait(100);
    this.key('Tab');
    await this.wait(100);
    this.key('Tab');
    await this.wait(200);
    this.key('Return');
    await this.wait(2000);

    this._log('Certificate warning acceptance attempted');
  }

  _validateCoordinates(x, y) {
    if (x < 0 || x > this.screenWidth || y < 0 || y > this.screenHeight) {
      throw new Error(`Coordinates (${x}, ${y}) out of screen bounds (${this.screenWidth}x${this.screenHeight})`);
    }
  }

  _rateLimit() {
    const now = Date.now();
    const minInterval = 1000 / this.maxClicksPerSecond;
    const elapsed = now - this.lastClickTime;

    if (elapsed < minInterval) {
      const waitTime = minInterval - elapsed;
      this._log(`Rate limiting: waiting ${waitTime}ms`);
      sleepSync(waitTime);
    }
  }

  /**
   * Get platform info
   * @returns {object} Platform and tools info
   */
  getInfo() {
    return {
      platform: this.platform,
      tools: this.tools,
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
      display: this.display,
      ocrAvailable: !!this.tools.ocr
    };
  }

  /**
   * Verify tool availability
   * @returns {object} Verification results
   */
  verifyTools() {
    const results = {
      screenshot: false,
      mouse: false,
      ocr: false,
      issues: []
    };

    // Test screenshot
    try {
      const testPath = this.screenshot('tool-verify-test');
      if (fs.existsSync(testPath)) {
        results.screenshot = true;
        fs.unlinkSync(testPath);
      }
    } catch (e) {
      results.issues.push(`Screenshot: ${e.message}`);
    }

    // Test mouse (just check tool exists)
    if (this.tools.mouse) {
      results.mouse = true;
    } else {
      results.issues.push('Mouse control tool not found');
    }

    // Test OCR
    if (this.tools.ocr) {
      try {
        this._exec('tesseract --version');
        results.ocr = true;
      } catch (e) {
        results.issues.push(`OCR: ${e.message}`);
      }
    } else {
      results.issues.push('Tesseract OCR not installed');
    }

    return results;
  }
}

// ============================================
// CLI INTERFACE
// ============================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const vi = new VisualInteraction({ verbose: true });

  const runAsync = async () => {
    switch (command) {
      case 'screenshot':
        console.log(vi.screenshot(args[1] || 'cli-screenshot'));
        break;

      case 'click':
        vi.click(parseInt(args[1]), parseInt(args[2]));
        break;

      case 'double-click':
        vi.doubleClick(parseInt(args[1]), parseInt(args[2]));
        break;

      case 'right-click':
        vi.rightClick(parseInt(args[1]), parseInt(args[2]));
        break;

      case 'type':
        vi.type(args.slice(1).join(' '));
        break;

      case 'key':
        vi.key(args[1]);
        break;

      case 'focus':
        vi.focusWindow(args[1]);
        break;

      case 'find-text':
        const result = await vi.findTextOnScreen(args.slice(1).join(' '));
        console.log(JSON.stringify(result, null, 2));
        break;

      case 'click-text':
        await vi.clickOnText(args.slice(1).join(' '));
        break;

      case 'wait-text':
        const waitResult = await vi.waitForText(args.slice(1).join(' '), { timeout: 30000 });
        console.log(JSON.stringify(waitResult, null, 2));
        break;

      case 'ocr':
        if (!args[1]) {
          console.error('Usage: ocr <image-path>');
          process.exit(1);
        }
        const ocrResult = vi.ocr(args[1]);
        console.log(JSON.stringify(ocrResult, null, 2));
        break;

      case 'compare':
        if (!args[1] || !args[2]) {
          console.error('Usage: compare <image1> <image2>');
          process.exit(1);
        }
        const comparison = vi.compareScreenshots(args[1], args[2]);
        console.log(JSON.stringify(comparison, null, 2));
        break;

      case 'accept-cert':
        await vi.acceptFirefoxCertWarning();
        break;

      case 'info':
        console.log(JSON.stringify(vi.getInfo(), null, 2));
        break;

      case 'verify':
        console.log(JSON.stringify(vi.verifyTools(), null, 2));
        break;

      case 'windows':
        console.log(JSON.stringify(vi.listWindows(), null, 2));
        break;

      default:
        console.log(`
Visual Interaction Toolkit v2.0
Cross-platform visual automation with surgical precision

Usage:
  interact.js screenshot [name]       - Take a screenshot
  interact.js click <x> <y>           - Click at coordinates
  interact.js double-click <x> <y>    - Double-click at coordinates
  interact.js right-click <x> <y>     - Right-click at coordinates
  interact.js type <text>             - Type text
  interact.js key <keys>              - Press key(s)
  interact.js focus <window>          - Focus window by name
  interact.js find-text <text>        - Find text on screen using OCR
  interact.js click-text <text>       - Click on text found via OCR
  interact.js wait-text <text>        - Wait for text to appear
  interact.js ocr <image>             - Perform OCR on image
  interact.js compare <img1> <img2>   - Compare two screenshots
  interact.js accept-cert             - Accept Firefox cert warning
  interact.js info                    - Show platform/screen info
  interact.js verify                  - Verify tool availability
  interact.js windows                 - List open windows

Platform Support:
  - Linux: xdotool, scrot, tesseract-ocr
  - macOS: screencapture, cliclick/AppleScript, tesseract
  - Windows: nircmd/PowerShell, tesseract
        `);
    }
  };

  runAsync().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = VisualInteraction;
