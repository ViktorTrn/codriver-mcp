# CoDriver MCP

**AI-powered Desktop Automation via Model Context Protocol**

CoDriver is an MCP server that gives Claude control over any desktop application. It captures screenshots, reads accessibility trees, injects mouse/keyboard input, and manages windows - enabling real-time human-AI collaboration on the desktop.

> What "Claude in Chrome" is for the browser, CoDriver is for the entire desktop.

## Features

| Tool | Description |
|------|-------------|
| `desktop_screenshot` | Capture full desktop or window as PNG/JPEG |
| `desktop_click` | Click at coordinates or by element ref |
| `desktop_type` | Type text at cursor or into a specific element |
| `desktop_key` | Press key combinations (`ctrl+c`, `alt+tab`, `f5`) |
| `desktop_scroll` | Scroll in any direction at position |
| `desktop_windows` | List and focus application windows |
| `desktop_read_ui` | Read accessibility tree with ref IDs |
| `desktop_find` | Find UI elements by name, role, or value |

## Quick Start

### Prerequisites

- **Node.js** 20+
- **macOS** (current platform support)
- **Accessibility permissions** for your terminal (System Settings > Privacy & Security > Accessibility)

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

Start the server with HTTP transport:

```bash
node dist/index.js --http                           # localhost:3100
node dist/index.js --http --port 8080               # custom port
node dist/index.js --http --host 0.0.0.0            # all interfaces
node dist/index.js --http --api-key YOUR_SECRET      # with authentication
CODRIVER_API_KEY=secret node dist/index.js --http    # via env var
```

Configure in Claude Code for remote:

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

Once configured, Claude can control your desktop:

```
"Take a screenshot of my desktop"
-> desktop_screenshot

"Read the UI tree of the frontmost app"
-> desktop_read_ui

"Find the Save button"
-> desktop_find { query: "Save" }

"Click the Save button"
-> desktop_click { ref: "ref_3" }

"Type into the search field"
-> desktop_type { ref: "ref_5", text: "hello world" }

"Press Ctrl+S to save"
-> desktop_key { key: "ctrl+s" }

"Show me all open windows"
-> desktop_windows { action: "list" }
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
npm test             # Run tests (53 tests)
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
  +-- Tools
  |     +-- desktop_screenshot   PNG/JPEG capture
  |     +-- desktop_click        Mouse click (coords or ref)
  |     +-- desktop_type         Keyboard input
  |     +-- desktop_key          Key combinations
  |     +-- desktop_scroll       Scroll wheel
  |     +-- desktop_windows      Window management
  |     +-- desktop_read_ui      Accessibility tree
  |     +-- desktop_find         Element search
  |
  +-- Modules
        +-- ScreenCapture       screenshot-desktop + sharp
        +-- InputController     @jitsi/robotjs
        +-- WindowManager       AppleScript (macOS)
        +-- AccessibilityReader JXA (macOS Accessibility API)
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20 LTS, TypeScript 5.7+ strict |
| MCP SDK | @modelcontextprotocol/sdk v1.26 |
| Screenshots | screenshot-desktop + sharp (PNG/JPEG) |
| Input | @jitsi/robotjs |
| Accessibility | JXA / osascript (macOS) |
| Windows | AppleScript / osascript (macOS) |
| HTTP Transport | Express + StreamableHTTPServerTransport |
| Testing | vitest (53 tests) |

## Roadmap

- [x] **Phase 1: MVP** - Screenshots, mouse, keyboard, windows (macOS)
- [x] **Phase 2: Accessibility** - UI tree reading, element refs, natural language find
- [x] **Phase 3: Remote** - HTTP/SSE transport, API-key auth, JPEG compression
- [ ] **Phase 4: Polish** - OCR, drag & drop, app launch, multi-monitor, GIF recording

## Platform Support

| Platform | Status |
|----------|--------|
| macOS | Supported |
| Windows | Planned |
| Linux | Planned |

## License

MIT

## Author

Viktor Trncik - [IBT Ingenieurbüro Trncik](https://www.ibt-freiburg.de)
