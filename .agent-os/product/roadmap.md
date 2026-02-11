# Product Roadmap - CoDriver MCP

> Last Updated: 2026-02-11
> Version: 0.1.0
> **Current Status: Project Setup COMPLETE | Phase 1 MVP NEXT**

---

## Overview

```
Phase 1       Phase 2        Phase 3       Phase 4
MVP           Accessibility  Remote        Polish
(3-4 Tage)    (2-3 Tage)    (1-2 Tage)    (2-3 Tage)
├─────────────┼──────────────┼─────────────┼─────────────┤
│ Screenshot  │ UI Tree      │ WebSocket   │ OCR         │
│ Click/Type  │ Element Refs │ SSH Tunnel  │ Drag & Drop │
│ Key/Scroll  │ NL Find      │ Auth        │ App Launch  │
│ Windows     │ Ref Click    │ Compression │ Multi-Mon   │
│ stdio MCP   │              │             │ GIF Record  │
└─────────────┴──────────────┴─────────────┴─────────────┘
   ◄── NEXT
```

---

## Phase 1: MVP (3-4 Tage)
**Status: ⏳ NEXT**

### Goals
- Lauffaehiger MCP-Server mit Basis-Desktop-Steuerung
- Screenshots, Maus, Tastatur, Fenster-Verwaltung
- Lokaler stdio Transport

### Tasks

| Task | SP | Status | Beschreibung |
|------|-----|--------|--------------|
| T1.1 | 2 | [ ] | Projekt-Setup: npm install, Build-Pipeline verifizieren |
| T1.2 | 3 | [ ] | `desktop_screenshot`: Screenshot Desktop/Fenster, base64 PNG |
| T1.3 | 3 | [ ] | `desktop_click`: Links/Rechts/Doppelklick an Koordinate |
| T1.4 | 2 | [ ] | `desktop_type`: Text tippen (normal + langsam) |
| T1.5 | 2 | [ ] | `desktop_key`: Tastenkombinationen (Ctrl+C, Enter, Alt+Tab) |
| T1.6 | 1 | [ ] | `desktop_scroll`: Hoch/Runter/Links/Rechts scrollen |
| T1.7 | 3 | [ ] | `desktop_windows`: Fenster auflisten, fokussieren, verwalten |
| T1.8 | 2 | [ ] | stdio Transport + MCP Server Verbindung testen |
| T1.9 | 2 | [ ] | README mit Setup-Anleitung + Claude Code Integration |

**Total: 20 SP**

### Akzeptanzkriterien
- [ ] `npx codriver-mcp` startet und verbindet mit Claude Code
- [ ] Claude kann Screenshot machen und beschreiben
- [ ] Claude kann auf Button klicken (nach Screenshot)
- [ ] Claude kann Text in Eingabefeld tippen
- [ ] Claude kann Tastenkombination senden

---

## Phase 2: Accessibility (2-3 Tage)
**Status: ⏳ Planned**

### Tasks

| Task | SP | Status | Beschreibung |
|------|-----|--------|--------------|
| T2.1 | 5 | [ ] | `desktop_read_ui`: Windows UI Automation Tree auslesen |
| T2.2 | 3 | [ ] | Element-Referenz-System (ref_1, ref_2, ...) |
| T2.3 | 3 | [ ] | `desktop_find`: UI-Element per Natural Language finden |
| T2.4 | 2 | [ ] | Ref-basierter Klick + Input (statt nur Koordinaten) |
| T2.5 | 2 | [ ] | macOS Accessibility API Support |

**Total: 15 SP**

---

## Phase 3: Remote (1-2 Tage)
**Status: ⏳ Planned**

### Tasks

| Task | SP | Status | Beschreibung |
|------|-----|--------|--------------|
| T3.1 | 3 | [ ] | WebSocket Transport Implementation |
| T3.2 | 2 | [ ] | SSH-Tunnel Setup + Anleitung |
| T3.3 | 2 | [ ] | API-Key Authentifizierung |
| T3.4 | 3 | [ ] | Screenshot-Komprimierung (JPEG, Resize) |

**Total: 10 SP**

---

## Phase 4: Polish (2-3 Tage)
**Status: ⏳ Planned**

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
| Phase 1: MVP | 20 | ⏳ Next |
| Phase 2: Accessibility | 15 | ⏳ Planned |
| Phase 3: Remote | 10 | ⏳ Planned |
| Phase 4: Polish | 15 | ⏳ Planned |
| **Total** | **60 SP** | |

---

*Last updated: 2026-02-11 - Project Setup*
