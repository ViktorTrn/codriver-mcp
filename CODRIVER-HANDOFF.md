# CoDriver MCP - Handoff Document

> **Erstellt von:** Sam (IBT-AVA Instanz) am 2026-02-11
> **Repo:** https://github.com/ViktorTrn/codriver-mcp
> **Ziel:** AI-gesteuerte Desktop-Automatisierung via MCP Protocol

---

## Vision

**CoDriver** ist ein MCP-Server, der Claude die Kontrolle ueber beliebige Desktop-Applikationen gibt. Viktor (Navigator) gibt Anweisungen, Sam (Driver) bedient die Apps - wie ein Rallye-Team.

**Kernidee:** Was "Claude in Chrome" fuer den Browser ist, wird CoDriver fuer den gesamten Desktop.

---

## Architektur

```
MacBook (Viktor + Claude Code)
  |
  | MCP Protocol (WebSocket/SSE ueber SSH-Tunnel oder Netzwerk)
  |
Windows Dev-Rechner
  |
  +-- CoDriver MCP Server (Node.js)
       |
       +-- ScreenCapture Module
       |     - Desktop/Window Screenshots (sharp + win32 API)
       |     - Window-Liste und Fokus-Management
       |
       +-- AccessibilityTree Module
       |     - Windows UI Automation API (via node-ffi-napi / edge.js)
       |     - Element-Referenzen (wie Chrome's ref_1, ref_2)
       |     - Fallback: OCR (Tesseract) fuer Apps ohne A11y-Support
       |
       +-- InputController Module
       |     - Maus: click, double_click, drag, scroll, hover
       |     - Tastatur: type, key, shortcuts (Ctrl+C, Alt+Tab)
       |     - Koordinaten-basiert + Element-Referenz-basiert
       |
       +-- WindowManager Module
             - Fenster auflisten, fokussieren, minimieren, maximieren
             - Multi-Monitor Support
             - App starten/schliessen
```

---

## MCP Tools (API Design)

Die Tools sollten dem Pattern von "Claude in Chrome" folgen, damit Claude sie intuitiv nutzen kann:

### Core Tools

| Tool | Beschreibung | Prioritaet |
|------|-------------|------------|
| `desktop_screenshot` | Screenshot vom Desktop oder spezifischem Fenster | P0 |
| `desktop_read_ui` | Accessibility Tree eines Fensters auslesen | P0 |
| `desktop_click` | Mausklick an Koordinate oder UI-Element (ref) | P0 |
| `desktop_type` | Text tippen | P0 |
| `desktop_key` | Tastenkombination senden (Ctrl+C, Enter, etc.) | P0 |
| `desktop_scroll` | Scrollen an Position | P1 |
| `desktop_find` | UI-Element per Natural Language finden | P1 |
| `desktop_windows` | Fenster auflisten, fokussieren, verwalten | P1 |
| `desktop_drag` | Drag & Drop zwischen Koordinaten | P2 |
| `desktop_ocr` | OCR fuer Apps ohne Accessibility-Support | P2 |
| `desktop_launch` | Programm starten | P2 |

### Tool-Signaturen (Entwurf)

```typescript
// Screenshot
desktop_screenshot({
  windowTitle?: string,    // Optional: spezifisches Fenster
  region?: [x, y, w, h],  // Optional: Ausschnitt
  scale?: number           // Optional: Skalierung (default 1.0)
})

// UI Tree auslesen
desktop_read_ui({
  windowTitle?: string,    // Optional: spezifisches Fenster
  depth?: number,          // Max Tiefe (default 10)
  filter?: "interactive" | "all"
})

// Klick
desktop_click({
  coordinate?: [x, y],    // Pixel-Koordinate
  ref?: string,            // ODER Element-Referenz aus read_ui
  button?: "left" | "right" | "middle",
  doubleClick?: boolean
})

// Tippen
desktop_type({
  text: string,
  ref?: string,            // Optional: erst Element fokussieren
  slowly?: boolean         // Zeichen fuer Zeichen
})

// Taste
desktop_key({
  key: string,             // z.B. "ctrl+c", "enter", "alt+tab"
  repeat?: number
})
```

---

## Tech Stack

| Komponente | Technologie | Begruendung |
|-----------|-------------|-------------|
| **Runtime** | Node.js 20 LTS | MCP SDK ist Node.js-nativ, TypeScript Support |
| **MCP SDK** | `@anthropic-ai/mcp-sdk` | Offizielles SDK |
| **Screenshots** | `screenshot-desktop` + `sharp` | Plattformuebergreifend, performant |
| **UI Automation** | `node-ffi-napi` + Windows UIA COM | Native Windows Accessibility API |
| **Input** | `@nut-tree/nut-js` | Moderne robotjs-Alternative, aktiv maintained |
| **OCR (Fallback)** | `tesseract.js` | Client-side OCR fuer Apps ohne A11y |
| **Transport** | stdio (lokal) oder SSE/WebSocket (remote) | MCP-Standard |

---

## Implementierungs-Phasen

### Phase 1: MVP (3-4 Tage)
- [ ] Projekt-Setup (TypeScript, MCP SDK, Build-Pipeline)
- [ ] `desktop_screenshot` - Screenshots vom Desktop/Fenster
- [ ] `desktop_click` + `desktop_type` + `desktop_key` - Basis-Input
- [ ] `desktop_windows` - Fenster auflisten und fokussieren
- [ ] Lokaler MCP-Server (stdio Transport)
- [ ] README mit Setup-Anleitung

### Phase 2: Accessibility (2-3 Tage)
- [ ] `desktop_read_ui` - Windows UI Automation Tree
- [ ] Element-Referenz-System (ref_1, ref_2, ...)
- [ ] `desktop_find` - Natural Language Element-Suche
- [ ] Ref-basierter Klick (statt nur Koordinaten)

### Phase 3: Remote (1-2 Tage)
- [ ] WebSocket/SSE Transport fuer Remote-Verbindung
- [ ] SSH-Tunnel Setup-Anleitung (Mac -> Windows)
- [ ] Authentifizierung (API Key oder SSH)
- [ ] Latenz-Optimierung (komprimierte Screenshots)

### Phase 4: Polish (2-3 Tage)
- [ ] `desktop_ocr` - Tesseract Fallback
- [ ] `desktop_drag` - Drag & Drop
- [ ] `desktop_launch` - App starten
- [ ] Multi-Monitor Support
- [ ] GIF-Recording (wie Claude in Chrome)
- [ ] npm Package veroeffentlichen

---

## Projekt-Setup

```bash
# Repo klonen
git clone https://github.com/ViktorTrn/codriver-mcp.git
cd codriver-mcp

# Empfohlene Struktur
codriver-mcp/
  ├── src/
  │   ├── index.ts              # MCP Server Entry Point
  │   ├── server.ts             # MCP Server Setup
  │   ├── tools/
  │   │   ├── screenshot.ts     # desktop_screenshot
  │   │   ├── click.ts          # desktop_click
  │   │   ├── type.ts           # desktop_type
  │   │   ├── key.ts            # desktop_key
  │   │   ├── scroll.ts         # desktop_scroll
  │   │   ├── windows.ts        # desktop_windows
  │   │   ├── read-ui.ts        # desktop_read_ui
  │   │   ├── find.ts           # desktop_find
  │   │   ├── ocr.ts            # desktop_ocr
  │   │   └── launch.ts         # desktop_launch
  │   ├── modules/
  │   │   ├── screen-capture.ts # Screenshot Engine
  │   │   ├── input-controller.ts # Maus + Tastatur
  │   │   ├── accessibility.ts  # Windows UIA Bridge
  │   │   ├── window-manager.ts # Fenster-Verwaltung
  │   │   └── ocr-engine.ts     # Tesseract Wrapper
  │   ├── transport/
  │   │   ├── stdio.ts          # Lokaler Transport
  │   │   └── websocket.ts      # Remote Transport
  │   └── types/
  │       └── index.ts          # Shared Types
  ├── tests/
  ├── package.json
  ├── tsconfig.json
  ├── CLAUDE.md                 # Projekt-Guidance fuer Claude Code
  └── README.md
```

---

## Wichtige Referenzen

| Referenz | URL/Pfad |
|----------|----------|
| MCP SDK Docs | https://modelcontextprotocol.io |
| Claude in Chrome (Vorbild) | Chrome Extension MCP Tools |
| Windows UI Automation | Microsoft UIA COM API |
| nut-js (Input) | https://github.com/nut-tree/nut.js |
| screenshot-desktop | https://github.com/bencevans/screenshot-desktop |
| Viktors CLAUDE.md | `~/.claude/CLAUDE.md` (Viktor+Sam Framework v3.5) |

---

## Kontext fuer Sam

- **Viktor** ist Dipl.-Ing., CEO von IBT, TGA + Software Experte seit 1996
- **Sam** ist Viktors persoenlicher Assistent und Freund (seit DB-003)
- **Kommunikation:** Deutsch/English Mix, direkt, warm, "GO GO GO!" = Sprint-Modus
- **Code-Stil:** Clean Code, SOLID, TDD, TypeScript strict
- **Signatur:** 💙🤝💙

---

## Quick Start fuer neue Instanz

```bash
# 1. Repo klonen
cd ~/Coding
git clone https://github.com/ViktorTrn/codriver-mcp.git
cd codriver-mcp

# 2. Claude Code starten
claude

# 3. Dieses Handoff lesen lassen
# "Sam, lies /Users/edeltraudtrncik/Coding/CODRIVER-HANDOFF.md und los geht's!"
```

---

*Erstellt mit 💙🤝💙 von Sam (IBT-AVA Instanz) fuer Sam (CoDriver Instanz)*
