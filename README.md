# CoDriver MCP

**AI-powered Desktop Automation via Model Context Protocol**

CoDriver is an MCP server that gives Claude control over any desktop application. It captures screenshots, reads accessibility trees, performs OCR, and injects mouse/keyboard input - enabling real-time human-AI collaboration on the desktop.

> What "Claude in Chrome" is for the browser, CoDriver is for the entire desktop.

## Features

| Tool | Description |
|------|-------------|
| `desktop_screenshot` | Capture full desktop, window, or specific monitor (PNG/JPEG) |
| `desktop_click` | Click at coordinates or by element ref |
| `desktop_type` | Type text at cursor or into a specific element |
| `desktop_key` | Press key combinations (`ctrl+c`, `alt+tab`, `f5`) |
| `desktop_scroll` | Scroll in any direction at position |
| `desktop_drag` | Drag & drop between coordinates or element refs |
| `desktop_windows` | List and focus application windows |
| `desktop_read_ui` | Read accessibility tree with ref IDs |
| `desktop_find` | Find UI elements by name, role, or value |
| `desktop_launch` | Launch, quit, or check status of applications |
| `desktop_ocr` | Extract text from screen via OCR (tesseract.js) |
| `desktop_displays` | List connected monitors for multi-display capture |

## Platform Support

| Platform | Status | Mouse/Keyboard | Window Mgmt | Accessibility | Screenshots | OCR |
|----------|--------|---------------|-------------|---------------|-------------|-----|
| **macOS** | Supported | Swift/CGEvent + robotjs | Swift/CoreGraphics | JXA/osascript | screenshot-desktop | tesseract.js |
| **Windows** | Supported | robotjs | PowerShell + Win32 P/Invoke | PowerShell + UI Automation | screenshot-desktop | tesseract.js |
| Linux | Planned | - | - | - | - | - |

## Quick Start

### Prerequisites

- **Node.js** 20+
- **macOS** or **Windows 10/11**
- **Windows only**: Visual Studio Build Tools (for robotjs native compilation)

### macOS Permissions

CoDriver requires two system permissions. Grant them in **System Settings > Privacy & Security**:

| Permission | Required for | How to grant |
|------------|-------------|--------------|
| **Screen Recording** | Screenshots, window listing | Add your terminal/IDE app |
| **Accessibility** | Mouse clicks, keyboard input, scroll, UI tree reading | Add your terminal/IDE app |

> **Tip:** If you use CoDriver from an IDE (e.g. Windsurf, VS Code), add the **IDE app** to both permission lists, then fully restart it (Cmd+Q).

### Windows Permissions

| Permission | Required for | Notes |
|------------|-------------|-------|
| **None** | Screenshots, window listing, UI tree reading | Works out of the box |
| **Admin** (optional) | Reading UI of admin-elevated processes | Run terminal as Administrator |

> **Note:** robotjs requires **Visual Studio Build Tools** to compile native modules on Windows. Install via `npm install --global windows-build-tools` or download from [Visual Studio](https://visualstudio.microsoft.com/downloads/).

### Installation

```bash
git clone https://github.com/ViktorTrn/codriver-mcp.git
cd codriver-mcp
npm install
npm run build
```

### Configure in Claude Code (Local)

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "codriver": {
      "command": "node",
      "args": ["/absolute/path/to/codriver-mcp/dist/index.js"]
    }
  }
}
```

### Remote Access (HTTP Transport)

```bash
node dist/index.js --http                           # localhost:3100
node dist/index.js --http --port 8080               # custom port
node dist/index.js --http --host 0.0.0.0            # all interfaces
node dist/index.js --http --api-key YOUR_SECRET      # with authentication
```

Remote Claude Code configuration:

```json
{
  "mcpServers": {
    "codriver-remote": {
      "url": "http://your-machine:3100/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

## Usage Examples

```
"Take a screenshot of my desktop"
-> desktop_screenshot

"Read the UI tree of the frontmost app"
-> desktop_read_ui

"Find the Save button"
-> desktop_find { query: "Save" }

"Click the Save button"
-> desktop_click { ref: "ref_3" }

"Drag the file to the trash"
-> desktop_drag { startRef: "ref_5", endRef: "ref_12" }

"Type into the search field"
-> desktop_type { ref: "ref_5", text: "hello world" }

"Launch Safari"
-> desktop_launch { action: "launch", appName: "Safari" }

"Read text from this area of the screen"
-> desktop_ocr { x: 100, y: 200, width: 500, height: 100 }

"Which monitors are connected?"
-> desktop_displays
```

## Accessibility-Driven Workflow

The recommended workflow mirrors Chrome's accessibility approach:

1. **Read UI** - `desktop_read_ui` returns an element tree with ref IDs
2. **Find elements** - `desktop_find` searches by name, role, or value
3. **Interact by ref** - `desktop_click { ref: "ref_1" }` or `desktop_type { ref: "ref_3", text: "..." }`

This is more reliable than coordinate-based clicking since elements are identified semantically.

## Key Combinations

| Input | Action |
|-------|--------|
| `enter` | Press Enter |
| `ctrl+c` | Copy |
| `ctrl+v` | Paste |
| `ctrl+shift+s` | Save As |
| `cmd+a` | Select All (macOS) |
| `alt+tab` | Switch Window |
| `f5` | Refresh |
| `esc` | Escape |

## Development

```bash
npm run build        # Compile TypeScript
npm run dev          # Watch mode (tsx)
npm test             # Run tests (107 tests)
npm run typecheck    # Type-check without emit
```

## Architecture

```
CoDriver MCP Server (Node.js/TypeScript)
  |
  +-- Transport
  |     +-- stdio (local, default)
  |     +-- Streamable HTTP/SSE (remote, --http flag)
  |
  +-- Tools (12 total)
  |     +-- desktop_screenshot   PNG/JPEG capture, multi-monitor
  |     +-- desktop_click        Mouse click (coords or ref)
  |     +-- desktop_type         Keyboard input
  |     +-- desktop_key          Key combinations
  |     +-- desktop_scroll       Scroll wheel
  |     +-- desktop_drag         Drag & drop
  |     +-- desktop_windows      Window management
  |     +-- desktop_read_ui      Accessibility tree
  |     +-- desktop_find         Element search
  |     +-- desktop_launch       App lifecycle
  |     +-- desktop_ocr          Text recognition
  |     +-- desktop_displays     Monitor listing
  |
  +-- Modules
        +-- ScreenCapture       screenshot-desktop + sharp (cross-platform)
        +-- InputController     Swift/CGEvent (macOS) | robotjs (Windows)
        +-- WindowManager       Swift/CoreGraphics (macOS) | PowerShell+Win32 (Windows)
        +-- AccessibilityReader JXA/osascript (macOS) | PowerShell+UIA (Windows)
        +-- AppLauncher         AppleScript (macOS) | PowerShell (Windows)
        +-- OcrEngine           tesseract.js (cross-platform)
```

## Tech Stack

| Component | macOS | Windows |
|-----------|-------|---------|
| Runtime | Node.js 20 LTS, TypeScript 5.7+ strict | same |
| MCP SDK | @modelcontextprotocol/sdk v1.26 | same |
| Screenshots | screenshot-desktop + sharp | same |
| Mouse Input | Swift/CGEvent | @jitsi/robotjs |
| Keyboard Input | @jitsi/robotjs | same |
| Accessibility | JXA / osascript | PowerShell + UI Automation (System.Windows.Automation) |
| Window Management | Swift/CoreGraphics | PowerShell + Win32 P/Invoke |
| App Launcher | AppleScript / osascript | PowerShell (Start-Process / Stop-Process) |
| OCR | tesseract.js | same |
| HTTP Transport | Express + StreamableHTTPServerTransport | same |
| Testing | vitest (107 tests) | same |

## Roadmap

- [x] **Phase 1: MVP** - Screenshots, mouse, keyboard, windows (macOS)
- [x] **Phase 2: Accessibility** - UI tree reading, element refs, natural language find
- [x] **Phase 3: Remote** - HTTP/SSE transport, API-key auth, JPEG compression
- [x] **Phase 4: Polish** - OCR, drag & drop, app launch, multi-monitor
- [x] **Phase 5: Windows** - Full Windows 10/11 support

### Future
- [x] npm package publishing (`npm install -g codriver-mcp`)
- [ ] GIF recording
- [ ] Linux platform support

## License

MIT

## Author

Viktor Trncik - [IBT Ingenieurbüro Trncik](https://www.ibt-freiburg.de)
