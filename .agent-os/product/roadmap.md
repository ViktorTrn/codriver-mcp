# Product Roadmap - CoDriver MCP

> Last Updated: 2026-02-11
> Version: 0.3.0
> **Current Status: Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅ | Phase 4 NEXT**

---

## Overview

```
Phase 1       Phase 2        Phase 3       Phase 4
MVP           Accessibility  Remote        Polish
├─────────────┼──────────────┼─────────────┼─────────────┤
│ Screenshot  │ UI Tree      │ HTTP/SSE    │ OCR         │
│ Click/Type  │ Element Refs │ API-Key Auth│ Drag & Drop │
│ Key/Scroll  │ NL Find      │ JPEG Comp.  │ App Launch  │
│ Windows     │ Ref Click    │ CLI Flags   │ Multi-Mon   │
│ stdio MCP   │              │             │ GIF Record  │
└─────────────┴──────────────┴─────────────┴─────────────┘
   DONE ✅       DONE ✅       DONE ✅       ◄── NEXT
```

---

## Phase 1: MVP
**Status: ✅ COMPLETE**

### Changes from Original Plan
- `@nut-tree/nut-js` removed from npm → replaced with `@jitsi/robotjs`
- `@modelcontextprotocol/server` → `@modelcontextprotocol/sdk` v1.26
- WindowManager uses native AppleScript (macOS) instead of nut-js
- `server.tool()` deprecated → `server.registerTool()` API

### Tasks

| Task | SP | Status | Beschreibung |
|------|-----|--------|--------------|
| T1.1 | 2 | [x] | Projekt-Setup: npm install, Build-Pipeline verifizieren |
| T1.2 | 3 | [x] | `desktop_screenshot`: Screenshot Desktop/Fenster, base64 PNG |
| T1.3 | 3 | [x] | `desktop_click`: Links/Rechts/Doppelklick an Koordinate |
| T1.4 | 2 | [x] | `desktop_type`: Text tippen (normal + langsam) |
| T1.5 | 2 | [x] | `desktop_key`: Tastenkombinationen (Ctrl+C, Enter, Alt+Tab) |
| T1.6 | 1 | [x] | `desktop_scroll`: Hoch/Runter/Links/Rechts scrollen |
| T1.7 | 3 | [x] | `desktop_windows`: Fenster auflisten, fokussieren (macOS) |
| T1.8 | 2 | [x] | stdio Transport + MCP Server Verbindung testen |
| T1.9 | 2 | [x] | README mit Setup-Anleitung + Claude Code Integration |

**Total: 20 SP - COMPLETE**

---

## Phase 2: Accessibility
**Status: ✅ COMPLETE**

### Tasks

| Task | SP | Status | Beschreibung |
|------|-----|--------|--------------|
| T2.1 | 5 | [x] | `desktop_read_ui`: macOS Accessibility API Tree via JXA |
| T2.2 | 3 | [x] | Element-Referenz-System (ref_1, ref_2, ...) mit Cache |
| T2.3 | 3 | [x] | `desktop_find`: UI-Element per Natural Language finden |
| T2.4 | 2 | [x] | Ref-basierter Klick + Input (statt nur Koordinaten) |

**Total: 13 SP - COMPLETE**

---

## Phase 3: Remote
**Status: ✅ COMPLETE**

### Changes from Original Plan
- WebSocket → StreamableHTTPServerTransport (official MCP SDK)
- SSH Tunnel replaced with API-Key auth (simpler, equally secure with HTTPS)
- Express app from MCP SDK with DNS rebinding protection built-in

### Tasks

| Task | SP | Status | Beschreibung |
|------|-----|--------|--------------|
| T3.1 | 3 | [x] | StreamableHTTP Transport via MCP SDK Express |
| T3.2 | 2 | [x] | API-Key Authentifizierung (Bearer token) |
| T3.3 | 3 | [x] | Screenshot-Komprimierung (JPEG format + quality) |
| T3.4 | 2 | [x] | CLI Flags: --http, --port, --host, --api-key |

**Total: 10 SP - COMPLETE**

---

## Phase 4: Polish
**Status: ⏳ NEXT**

### Tasks

| Task | SP | Status | Beschreibung |
|------|-----|--------|--------------|
| T4.1 | 3 | [ ] | `desktop_ocr`: Tesseract-basierte Texterkennung |
| T4.2 | 2 | [ ] | `desktop_drag`: Drag & Drop |
| T4.3 | 2 | [ ] | `desktop_launch`: App starten/schliessen |
| T4.4 | 2 | [ ] | Multi-Monitor Support |
| T4.5 | 3 | [ ] | GIF-Recording (wie Claude in Chrome) |
| T4.6 | 3 | [ ] | npm Package veroeffentlichen |

**Total: 15 SP**

---

## Summary

| Phase | SP | Status |
|-------|----|--------|
| Phase 1: MVP | 20 | ✅ Complete |
| Phase 2: Accessibility | 13 | ✅ Complete |
| Phase 3: Remote | 10 | ✅ Complete |
| Phase 4: Polish | 15 | ⏳ Next |
| **Total** | **58 SP** | |

---

*Last updated: 2026-02-11 - Phase 3 Remote Complete*
