/**
 * Accessibility Module
 * macOS: JXA (JavaScript for Automation) via osascript
 * Windows: UI Automation via PowerShell + inline C# (System.Windows.Automation)
 * Provides UI element enumeration with ref IDs for programmatic interaction.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { UIElement, ReadUIOptions, RawUIElement, Region } from '../types/index.js';

const execFileAsync = promisify(execFile);

/** PowerShell flags for safe, non-interactive execution */
const PS_FLAGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command'];

/** Escape a string for use inside PowerShell single-quoted strings */
function escapePowerShell(str: string): string {
  return str.replace(/'/g, "''");
}

/** Interactive roles that are typically actionable (macOS AX + Windows UIA) */
const INTERACTIVE_ROLES = new Set([
  // macOS AX roles
  'AXButton', 'AXCheckBox', 'AXRadioButton', 'AXTextField', 'AXTextArea',
  'AXComboBox', 'AXPopUpButton', 'AXMenuButton', 'AXSlider', 'AXIncrementor',
  'AXLink', 'AXTab', 'AXTabGroup', 'AXMenuItem', 'AXMenu', 'AXToolbar',
  'AXList', 'AXTable', 'AXOutline', 'AXDisclosureTriangle', 'AXSwitch',
  'AXColorWell', 'AXDateField', 'AXSearchField', 'AXSecureTextField',
  // Windows UIA ControlType names
  'Button', 'CheckBox', 'RadioButton', 'Edit', 'ComboBox', 'Slider',
  'Hyperlink', 'Tab', 'TabItem', 'MenuItem', 'Menu', 'MenuBar',
  'ToolBar', 'List', 'ListItem', 'Table', 'Tree', 'TreeItem',
  'DataGrid', 'DataItem', 'ScrollBar', 'Spinner',
]);

export class AccessibilityReader {
  /** Cache of last-read elements by ref ID for click/type interactions */
  private _elementCache = new Map<string, UIElement>();
  private _refCounter = 0;

  /**
   * Read the accessibility tree of a window or the frontmost app.
   */
  async readUI(options: ReadUIOptions = {}): Promise<UIElement[]> {
    const { windowTitle, depth = 10, filter = 'all' } = options;

    let rawTree: RawUIElement[];
    if (process.platform === 'darwin') {
      rawTree = await this.readTreeJXA(windowTitle, depth);
    } else if (process.platform === 'win32') {
      rawTree = await this.readTreeUIA(windowTitle, depth);
    } else {
      throw new Error(`Accessibility reading not implemented for ${process.platform}.`);
    }

    // Reset ref counter and cache for each read
    this._refCounter = 0;
    this._elementCache.clear();

    const elements = this.assignRefs(rawTree, filter);
    return elements;
  }

  /**
   * Look up a cached element by its ref ID.
   */
  getElementByRef(ref: string): UIElement | undefined {
    return this._elementCache.get(ref);
  }

  /**
   * Get the center coordinate of an element by ref.
   */
  getElementCenter(ref: string): [number, number] | undefined {
    const el = this._elementCache.get(ref);
    if (!el) return undefined;
    const [x, y, w, h] = el.bounds;
    return [Math.round(x + w / 2), Math.round(y + h / 2)];
  }

  // --- macOS JXA Implementation ---

  private async readTreeJXA(windowTitle: string | undefined, maxDepth: number): Promise<RawUIElement[]> {
    const safeTitle = windowTitle?.replace(/'/g, "\\'") ?? '';

    const script = `
      ObjC.import('stdlib');

      const systemEvents = Application('System Events');
      var targetProcess = null;
      ${windowTitle ? `
      // First try matching by process name
      var byName = systemEvents.processes.whose({ name: { _contains: '${safeTitle}' } });
      if (byName.length > 0) {
        targetProcess = byName[0];
      } else {
        // Fallback: search window titles across all processes
        var allProcs = systemEvents.processes();
        for (var pi = 0; pi < allProcs.length; pi++) {
          try {
            var wins = allProcs[pi].windows();
            for (var wi = 0; wi < wins.length; wi++) {
              try {
                var wTitle = wins[wi].name();
                if (wTitle && wTitle.indexOf('${safeTitle}') !== -1) {
                  targetProcess = allProcs[pi];
                  break;
                }
              } catch(e) {}
            }
            if (targetProcess) break;
          } catch(e) {}
        }
      }
      ` : `
      targetProcess = systemEvents.processes.whose({ frontmost: true })[0];
      `}

      function readElement(elem, depth, maxDepth) {
        if (depth > maxDepth) return null;
        try {
          var role = null, title = null, desc = null, val = null, enabled = null;
          var pos = null, sz = null;

          try { role = elem.role(); } catch(e) {}
          try { title = elem.title(); } catch(e) {}
          try { desc = elem.description(); } catch(e) {}
          try { val = elem.value(); if (typeof val === 'object') val = String(val); } catch(e) {}
          try { enabled = elem.enabled(); } catch(e) {}
          try { pos = elem.position(); } catch(e) {}
          try { sz = elem.size(); } catch(e) {}

          var children = [];
          if (depth < maxDepth) {
            try {
              var uiElems = elem.uiElements();
              for (var i = 0; i < uiElems.length; i++) {
                var child = readElement(uiElems[i], depth + 1, maxDepth);
                if (child) children.push(child);
              }
            } catch(e) {}
          }

          return {
            role: role,
            title: title,
            description: desc,
            value: val,
            enabled: enabled,
            position: pos ? [pos[0], pos[1]] : null,
            size: sz ? [sz[0], sz[1]] : null,
            children: children
          };
        } catch(e) {
          return null;
        }
      }

      var results = [];
      if (targetProcess) {
        try {
          var windows = targetProcess.windows();
          for (var w = 0; w < windows.length; w++) {
            var winElem = readElement(windows[w], 0, ${maxDepth});
            if (winElem) results.push(winElem);
          }
        } catch(e) {
          // If window access fails, try UI elements directly
          try {
            var uiElems = targetProcess.uiElements();
            for (var u = 0; u < uiElems.length; u++) {
              var elem = readElement(uiElems[u], 0, ${maxDepth});
              if (elem) results.push(elem);
            }
          } catch(e2) {}
        }
      }

      JSON.stringify(results);
    `;

    try {
      const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script], {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000,
      });

      const trimmed = stdout.trim();
      if (!trimmed) return [];
      return JSON.parse(trimmed) as RawUIElement[];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not allowed assistive access') || msg.includes('accessibility')) {
        throw new Error(
          'Accessibility permissions not granted. ' +
          'Go to System Settings > Privacy & Security > Accessibility and enable your terminal app.'
        );
      }
      throw new Error(`Failed to read accessibility tree: ${msg}`);
    }
  }

  // --- Windows UIA Implementation ---

  private async readTreeUIA(windowTitle: string | undefined, maxDepth: number): Promise<RawUIElement[]> {
    const safeTitle = windowTitle ? escapePowerShell(windowTitle) : '';

    // PowerShell + inline C# using System.Windows.Automation
    const script = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;
using System.Collections.Generic;
using System.Windows.Automation;
using System.Runtime.InteropServices;

public class UIAReader {
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    public static string ReadTree(string windowTitle, int maxDepth) {
        AutomationElement root;

        if (string.IsNullOrEmpty(windowTitle)) {
            // Get foreground window
            IntPtr hwnd = GetForegroundWindow();
            root = AutomationElement.FromHandle(hwnd);
        } else {
            // Find window by title substring
            var desktop = AutomationElement.RootElement;
            root = null;

            var windows = desktop.FindAll(TreeScope.Children, Condition.TrueCondition);
            foreach (AutomationElement win in windows) {
                try {
                    string name = win.Current.Name ?? "";
                    if (name.IndexOf(windowTitle, StringComparison.OrdinalIgnoreCase) >= 0) {
                        root = win;
                        break;
                    }
                } catch {}
            }

            if (root == null) return "[]";
        }

        var results = new List<string>();
        string json = ReadElement(root, 0, maxDepth);
        if (json != null) results.Add(json);
        return "[" + string.Join(",", results) + "]";
    }

    static string ReadElement(AutomationElement elem, int depth, int maxDepth) {
        if (elem == null || depth > maxDepth) return null;

        try {
            var current = elem.Current;
            string role = "Unknown";
            if (current.ControlType != null && current.ControlType.ProgrammaticName != null)
                role = current.ControlType.ProgrammaticName.Replace("ControlType.", "");
            string title = (current.Name != null ? current.Name : "").Replace("\\\\", "\\\\\\\\").Replace("\\"", "\\\\\\"");
            string desc = "";
            try { string ht = current.HelpText; if (ht != null) desc = ht.Replace("\\\\", "\\\\\\\\").Replace("\\"", "\\\\\\""); } catch {}
            bool enabled = current.IsEnabled;

            string val = null;
            try {
                object pattern;
                if (elem.TryGetCurrentPattern(ValuePattern.Pattern, out pattern)) {
                    val = ((ValuePattern)pattern).Current.Value;
                }
            } catch {}
            string valJson = val != null
                ? "\\"" + val.Replace("\\\\", "\\\\\\\\").Replace("\\"", "\\\\\\"") + "\\""
                : "null";

            var rect = current.BoundingRectangle;
            string posJson = !rect.IsEmpty
                ? string.Format("[{0},{1}]", (int)rect.X, (int)rect.Y)
                : "null";
            string sizeJson = !rect.IsEmpty
                ? string.Format("[{0},{1}]", (int)rect.Width, (int)rect.Height)
                : "null";

            // Read children
            var childJsons = new List<string>();
            if (depth < maxDepth) {
                try {
                    var children = elem.FindAll(TreeScope.Children, Condition.TrueCondition);
                    foreach (AutomationElement child in children) {
                        string childJson = ReadElement(child, depth + 1, maxDepth);
                        if (childJson != null) childJsons.Add(childJson);
                    }
                } catch {}
            }

            return string.Format(
                "{{\\"role\\":\\"{0}\\",\\"title\\":\\"{1}\\",\\"description\\":{2},\\"value\\":{3},\\"enabled\\":{4},\\"position\\":{5},\\"size\\":{6},\\"children\\":[{7}]}}",
                role, title,
                string.IsNullOrEmpty(desc) ? "null" : "\\"" + desc + "\\"",
                valJson,
                enabled ? "true" : "false",
                posJson, sizeJson,
                string.Join(",", childJsons)
            );
        } catch {
            return null;
        }
    }
}
'@ -ReferencedAssemblies UIAutomationClient, UIAutomationTypes, WindowsBase
Write-Output ([UIAReader]::ReadTree('${safeTitle}', ${maxDepth}))
`;

    try {
      const { stdout } = await execFileAsync('powershell', [...PS_FLAGS, script], {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000,
      });

      const trimmed = stdout.trim();
      if (!trimmed || trimmed === '[]') return [];
      return JSON.parse(trimmed) as RawUIElement[];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read accessibility tree: ${msg}`);
    }
  }

  /**
   * Recursively assign ref IDs to raw elements and build the cache.
   */
  private assignRefs(rawElements: RawUIElement[], filter: 'interactive' | 'all'): UIElement[] {
    const result: UIElement[] = [];

    for (const raw of rawElements) {
      const element = this.processElement(raw, filter);
      if (element) {
        result.push(element);
      }
    }

    return result;
  }

  private processElement(raw: RawUIElement, filter: 'interactive' | 'all'): UIElement | null {
    if (!raw) return null;

    const role = raw.role ?? 'AXUnknown';
    const isInteractive = INTERACTIVE_ROLES.has(role);

    // Process children first (depth-first)
    const children: UIElement[] = [];
    if (raw.children) {
      for (const child of raw.children) {
        const processed = this.processElement(child, filter);
        if (processed) {
          children.push(processed);
        }
      }
    }

    // If filtering for interactive only, skip non-interactive elements without interactive children
    if (filter === 'interactive' && !isInteractive && children.length === 0) {
      return null;
    }

    // Build bounds from position + size
    const bounds: Region = [
      raw.position?.[0] ?? 0,
      raw.position?.[1] ?? 0,
      raw.size?.[0] ?? 0,
      raw.size?.[1] ?? 0,
    ];

    this._refCounter++;
    const ref = `ref_${this._refCounter}`;

    const element: UIElement = {
      ref,
      role: this.friendlyRole(role),
      name: raw.title || raw.description || '',
      ...(raw.description && raw.title !== raw.description ? { description: raw.description } : {}),
      ...(raw.value != null ? { value: String(raw.value) } : {}),
      ...(raw.enabled != null ? { enabled: raw.enabled } : {}),
      bounds,
      ...(children.length > 0 ? { children } : {}),
    };

    // Cache for ref-based interactions
    this._elementCache.set(ref, element);

    return element;
  }

  /**
   * Convert role names to human-friendly names.
   * Supports both macOS AX roles and Windows UIA ControlType names.
   */
  private friendlyRole(role: string): string {
    const map: Record<string, string> = {
      // macOS AX roles
      AXWindow: 'window',
      AXButton: 'button',
      AXCheckBox: 'checkbox',
      AXRadioButton: 'radio',
      AXTextField: 'textfield',
      AXTextArea: 'textarea',
      AXStaticText: 'text',
      AXImage: 'image',
      AXGroup: 'group',
      AXScrollArea: 'scroll-area',
      AXScrollBar: 'scrollbar',
      AXToolbar: 'toolbar',
      AXMenuBar: 'menubar',
      AXMenu: 'menu',
      AXMenuItem: 'menuitem',
      AXPopUpButton: 'popup',
      AXComboBox: 'combobox',
      AXList: 'list',
      AXTable: 'table',
      AXOutline: 'outline',
      AXRow: 'row',
      AXColumn: 'column',
      AXCell: 'cell',
      AXLink: 'link',
      AXTab: 'tab',
      AXTabGroup: 'tabgroup',
      AXSlider: 'slider',
      AXSplitGroup: 'splitgroup',
      AXSplitter: 'splitter',
      AXSheet: 'sheet',
      AXDrawer: 'drawer',
      AXHeading: 'heading',
      AXLayoutArea: 'layout',
      AXLayoutItem: 'layout-item',
      AXWebArea: 'webarea',
      AXUnknown: 'unknown',
      AXApplication: 'application',
      AXSwitch: 'switch',
      AXDisclosureTriangle: 'disclosure',
      AXProgressIndicator: 'progress',
      AXBusyIndicator: 'busy',
      AXSearchField: 'search',
      AXSecureTextField: 'password',
      AXDateField: 'datefield',
      AXColorWell: 'color',
      // Windows UIA ControlType names
      Window: 'window',
      Button: 'button',
      CheckBox: 'checkbox',
      RadioButton: 'radio',
      Edit: 'textfield',
      Document: 'textarea',
      Text: 'text',
      Image: 'image',
      Group: 'group',
      ScrollBar: 'scrollbar',
      ToolBar: 'toolbar',
      MenuBar: 'menubar',
      Menu: 'menu',
      MenuItem: 'menuitem',
      ComboBox: 'combobox',
      List: 'list',
      ListItem: 'listitem',
      Table: 'table',
      Tree: 'outline',
      TreeItem: 'treeitem',
      DataGrid: 'table',
      DataItem: 'row',
      Hyperlink: 'link',
      Tab: 'tabgroup',
      TabItem: 'tab',
      Slider: 'slider',
      Spinner: 'spinner',
      StatusBar: 'statusbar',
      Header: 'heading',
      HeaderItem: 'heading',
      Pane: 'group',
      TitleBar: 'titlebar',
      Thumb: 'thumb',
      ToolTip: 'tooltip',
      Calendar: 'datefield',
      Custom: 'custom',
      Unknown: 'unknown',
    };
    return map[role] ?? role.replace(/^AX/, '').toLowerCase();
  }

  /**
   * Format the UI tree as human-readable text (like Chrome's read_page).
   */
  formatTree(elements: UIElement[], indent = 0): string {
    const lines: string[] = [];

    for (const el of elements) {
      const prefix = '  '.repeat(indent);
      const parts: string[] = [`[${el.ref}]`, el.role];

      if (el.name) parts.push(`"${el.name}"`);
      if (el.value) parts.push(`value="${el.value}"`);
      if (el.enabled === false) parts.push('(disabled)');

      lines.push(`${prefix}${parts.join(' ')}`);

      if (el.children) {
        lines.push(this.formatTree(el.children, indent + 1));
      }
    }

    return lines.join('\n');
  }

  /**
   * Find elements matching a search query (name, role, or value).
   */
  findElements(elements: UIElement[], query: string): UIElement[] {
    const matches: UIElement[] = [];
    const lowerQuery = query.toLowerCase();

    const search = (els: UIElement[]) => {
      for (const el of els) {
        const nameMatch = el.name.toLowerCase().includes(lowerQuery);
        const roleMatch = el.role.toLowerCase().includes(lowerQuery);
        const valueMatch = el.value?.toLowerCase().includes(lowerQuery) ?? false;
        const descMatch = el.description?.toLowerCase().includes(lowerQuery) ?? false;

        if (nameMatch || roleMatch || valueMatch || descMatch) {
          matches.push(el);
        }

        if (el.children) {
          search(el.children);
        }
      }
    };

    search(elements);
    return matches;
  }
}

export const accessibilityReader = new AccessibilityReader();
