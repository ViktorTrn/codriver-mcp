# CoDriver MCP

**AI-powered Desktop Automation via Model Context Protocol**

CoDriver is an MCP server that gives Claude control over any desktop application. It captures screenshots, injects mouse/keyboard input, and manages windows - enabling real-time human-AI collaboration on the desktop.

> What "Claude in Chrome" is for the browser, CoDriver is for the entire desktop.

## Features

| Tool | Description |
|------|-------------|
| `desktop_screenshot` | Capture full desktop or region as PNG |
| `desktop_click` | Click at screen coordinates (left/right/double) |
| `desktop_type` | Type text at cursor position |
| `desktop_key` | Press key combinations (`ctrl+c`, `alt+tab`, `f5`) |
| `desktop_scroll` | Scroll in any direction at position |
| `desktop_windows` | List and focus application windows |

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

### Configure in Claude Code

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

Or run directly:

```bash
node dist/index.js          # Start MCP server (stdio)
node dist/index.js --help   # Show help
```

## Usage Examples

Once configured, Claude can control your desktop:

```
"Take a screenshot of my desktop"
→ desktop_screenshot

"Click on the search bar at coordinates 500, 300"
→ desktop_click { x: 500, y: 300 }

"Type 'Hello World' into the text field"
→ desktop_type { text: "Hello World" }

"Press Ctrl+S to save"
→ desktop_key { key: "ctrl+s" }

"Show me all open windows"
→ desktop_windows { action: "list" }

"Focus the Safari window"
→ desktop_windows { action: "focus", title: "Safari" }
```

## Key Combinations

The `desktop_key` tool supports intuitive key combination syntax:

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
npm test             # Run tests (25 tests)
npm run typecheck    # Type-check without emit
```

## Architecture

```
CoDriver MCP Server (Node.js/TypeScript)
  │
  ├── ScreenCapture    screenshot-desktop + sharp
  ├── InputController  @jitsi/robotjs
  └── WindowManager    AppleScript (macOS)
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20 LTS, TypeScript 5.7+ strict |
| MCP SDK | @modelcontextprotocol/sdk v1.26 |
| Screenshots | screenshot-desktop + sharp |
| Input | @jitsi/robotjs |
| Windows | AppleScript/osascript (macOS) |
| Testing | vitest |

## Roadmap

- [x] **Phase 1: MVP** - Screenshots, mouse, keyboard, windows (macOS)
- [ ] **Phase 2: Accessibility** - UI tree reading, element references, natural language find
- [ ] **Phase 3: Remote** - WebSocket transport, SSH tunnel, authentication
- [ ] **Phase 4: Polish** - OCR, drag & drop, app launch, multi-monitor, GIF recording

## Platform Support

| Platform | Status |
|----------|--------|
| macOS | Supported |
| Windows | Planned (Phase 2+) |
| Linux | Planned (Phase 2+) |

## License

MIT

## Author

Viktor Trncik - [IBT Ingenieurbüro Trncik](https://www.ibt-freiburg.de)
