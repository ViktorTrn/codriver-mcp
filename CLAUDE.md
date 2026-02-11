# CLAUDE.md - CoDriver MCP

## Project Overview

**CoDriver** is an MCP (Model Context Protocol) server that gives Claude control over any desktop application. It captures screenshots, reads accessibility trees, and injects mouse/keyboard input - enabling real-time human-AI collaboration on the desktop.

**Analogy:** What "Claude in Chrome" is for the browser, CoDriver is for the entire desktop.

**Current Status:** Phase 1 - MVP Development

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
  +-- InputController   - Mouse + Keyboard injection (nut-js)
  +-- WindowManager     - Window list, focus, resize (nut-js)
  +-- OCR Engine        - Fallback text recognition (tesseract.js)
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 LTS, TypeScript 5.7+ |
| MCP SDK | @modelcontextprotocol/server v2 |
| Screenshots | screenshot-desktop + sharp |
| Input Control | @nut-tree/nut-js v4 |
| Accessibility | Platform-native (Windows UIA, macOS AX) |
| OCR Fallback | tesseract.js |
| Testing | vitest |
| Transport | stdio (local) / WebSocket (remote) |

### Directory Structure

```
src/
  index.ts              # Entry point (stdio transport)
  server.ts             # McpServer setup + tool registration
  tools/                # MCP Tool implementations
    screenshot.ts       # desktop_screenshot
    click.ts            # desktop_click
    type.ts             # desktop_type
    key.ts              # desktop_key
    scroll.ts           # desktop_scroll
    windows.ts          # desktop_windows
    read-ui.ts          # desktop_read_ui (Phase 2)
    find.ts             # desktop_find (Phase 2)
    ocr.ts              # desktop_ocr (Phase 4)
    launch.ts           # desktop_launch (Phase 4)
  modules/              # Core engine modules
    screen-capture.ts   # Screenshot engine
    input-controller.ts # Mouse + keyboard abstraction
    window-manager.ts   # Window enumeration + control
    accessibility.ts    # UI Automation bridge (Phase 2)
    ocr-engine.ts       # Tesseract wrapper (Phase 4)
  transport/            # MCP transport layers
    stdio.ts            # Local stdio transport
    websocket.ts        # Remote WebSocket transport (Phase 3)
  types/
    index.ts            # Shared type definitions
tests/                  # Test files (vitest)
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
- Mock nut-js/screenshot-desktop in tests

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
