# CLAUDE.md - CoDriver MCP

## Project Overview

**CoDriver** is an MCP (Model Context Protocol) server that gives Claude control over any desktop application. It captures screenshots, reads accessibility trees, and injects mouse/keyboard input - enabling real-time human-AI collaboration on the desktop.

**Analogy:** What "Claude in Chrome" is for the browser, CoDriver is for the entire desktop.

**Current Status:** Phase 1 - MVP Complete (macOS)

## Architecture

```
Claude Code (Mac/Linux)
  |
  | MCP Protocol (stdio local / WebSocket remote)
  |
CoDriver MCP Server (Windows/Mac/Linux)
  |
  +-- ScreenCapture    - Desktop/Window screenshots (screenshot-desktop + sharp)
  +-- AccessibilityTree - UI element tree (Windows UIA / macOS AX / AT-SPI)
  +-- InputController   - Mouse + Keyboard injection (@jitsi/robotjs)
  +-- WindowManager     - Window list, focus, resize (AppleScript/osascript)
  +-- OCR Engine        - Fallback text recognition (tesseract.js)
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 LTS, TypeScript 5.7+ |
| MCP SDK | @modelcontextprotocol/sdk v1.26 |
| Screenshots | screenshot-desktop + sharp |
| Input Control | @jitsi/robotjs v0.6.21 |
| Window Mgmt | AppleScript/osascript (macOS), platform-native |
| Accessibility | Platform-native (Windows UIA, macOS AX) - Phase 2 |
| OCR Fallback | tesseract.js |
| Testing | vitest |
| Transport | stdio (local) / WebSocket (remote) |

### Directory Structure

```
src/
  index.ts                    # Entry point (stdio transport)
  server.ts                   # McpServer setup + tool registration (registerTool API)
  modules/                    # Core engine modules
    screen-capture.ts         # Screenshot engine (screenshot-desktop + sharp)
    input-controller.ts       # Mouse + keyboard (@jitsi/robotjs)
    window-manager.ts         # Window enumeration + control (AppleScript on macOS)
    accessibility.ts          # UI Automation bridge (Phase 2)
    ocr-engine.ts             # Tesseract wrapper (Phase 4)
  transport/                  # MCP transport layers
    websocket.ts              # Remote WebSocket transport (Phase 3)
  types/
    index.ts                  # Shared type definitions
    screenshot-desktop.d.ts   # Type declarations for screenshot-desktop
tests/                        # Test files (vitest)
  screen-capture.test.ts      # ScreenCapture tests
  input-controller.test.ts    # InputController tests
  window-manager.test.ts      # WindowManager tests
```

## MCP Tools Reference

### Phase 1 (MVP)
| Tool | Description |
|------|-------------|
| `desktop_screenshot` | Screenshot of desktop or specific window |
| `desktop_click` | Mouse click at coordinate |
| `desktop_type` | Type text (optionally into specific element) |
| `desktop_key` | Press key combination (Ctrl+C, Enter, etc.) |
| `desktop_scroll` | Scroll at position |
| `desktop_windows` | List, focus, manage windows |

### Phase 2 (Accessibility)
| Tool | Description |
|------|-------------|
| `desktop_read_ui` | Read accessibility tree of window |
| `desktop_find` | Find UI element by natural language |

### Phase 3 (Remote)
- WebSocket transport for cross-machine usage
- SSH tunnel setup

### Phase 4 (Polish)
| Tool | Description |
|------|-------------|
| `desktop_ocr` | OCR for apps without accessibility |
| `desktop_drag` | Drag and drop |
| `desktop_launch` | Launch application |

## Development Guidelines

### Code Style
- TypeScript strict mode (all flags enabled)
- ES Modules (type: "module")
- Clean Code, SOLID principles
- German + English comments where helpful

### Testing
- vitest for unit tests
- Test each tool + module independently
- Mock robotjs/screenshot-desktop in tests

### MCP SDK Patterns
- Use `server.registerTool()` with Zod schemas
- Return `CallToolResult` with `content: [{ type: 'text' | 'image', ... }]`
- Screenshots returned as base64 PNG in `{ type: 'image', data: base64, mimeType: 'image/png' }`

### Build & Run
```bash
npm run build        # Compile TypeScript
npm run dev          # Watch mode (tsx)
npm start            # Run compiled server
npm test             # Run tests
npm run typecheck    # Type-check without emit
```

## Agent-OS Workflow

This project uses Agent-OS for spec-driven development:

| Command | Purpose |
|---------|---------|
| `/plan-product` | Define product mission and roadmap |
| `/shape-spec` | Refine requirements |
| `/write-spec` | Create detailed specification |
| `/create-tasks` | Generate task list from spec |
| `/implement-tasks` | Execute implementation |

Outputs stored in `.agent-os/product/` and `.agent-os/specs/`.

## Important Files

| File | Purpose |
|------|---------|
| `.agent-os/product/roadmap.md` | Current progress and milestones |
| `.agent-os/product/mission.md` | Product vision |
| `.agent-os/product/tech-stack.md` | Technology decisions |
| `CODRIVER-HANDOFF.md` | Original handoff from IBT-AVA instance |
