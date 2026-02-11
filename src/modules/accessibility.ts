/**
 * Accessibility Module
 * Reads the macOS Accessibility tree via JXA (JavaScript for Automation).
 * Provides UI element enumeration with ref IDs for programmatic interaction.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { UIElement, ReadUIOptions, RawJXAElement, Region } from '../types/index.js';

const execFileAsync = promisify(execFile);

/** Interactive roles that are typically actionable */
const INTERACTIVE_ROLES = new Set([
  'AXButton',
  'AXCheckBox',
  'AXRadioButton',
  'AXTextField',
  'AXTextArea',
  'AXComboBox',
  'AXPopUpButton',
  'AXMenuButton',
  'AXSlider',
  'AXIncrementor',
  'AXLink',
  'AXTab',
  'AXTabGroup',
  'AXMenuItem',
  'AXMenu',
  'AXToolbar',
  'AXList',
  'AXTable',
  'AXOutline',
  'AXDisclosureTriangle',
  'AXSwitch',
  'AXColorWell',
  'AXDateField',
  'AXSearchField',
  'AXSecureTextField',
]);

export class AccessibilityReader {
  /** Cache of last-read elements by ref ID for click/type interactions */
  private _elementCache = new Map<string, UIElement>();
  private _refCounter = 0;

  /**
   * Read the accessibility tree of a window or the frontmost app.
   */
  async readUI(options: ReadUIOptions = {}): Promise<UIElement[]> {
    if (process.platform !== 'darwin') {
      throw new Error(`Accessibility reading not yet implemented for ${process.platform}. Currently macOS only.`);
    }

    const { windowTitle, depth = 10, filter = 'all' } = options;

    const rawTree = await this.readTreeJXA(windowTitle, depth);

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

  /**
   * Execute JXA script to read the accessibility tree.
   * Returns the raw JSON tree from osascript.
   */
  private async readTreeJXA(windowTitle: string | undefined, maxDepth: number): Promise<RawJXAElement[]> {
    // Build JXA script that reads the UI tree and outputs JSON
    const targetExpr = windowTitle
      ? `systemEvents.processes.whose({ name: { _contains: '${windowTitle.replace(/'/g, "\\'")}' } })[0]`
      : `systemEvents.processes.whose({ frontmost: true })[0]`;

    const script = `
      ObjC.import('stdlib');

      const systemEvents = Application('System Events');
      const targetProcess = ${targetExpr};

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

      JSON.stringify(results);
    `;

    try {
      const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script], {
        maxBuffer: 10 * 1024 * 1024, // 10MB for large trees
        timeout: 10000, // 10s timeout
      });

      const trimmed = stdout.trim();
      if (!trimmed) return [];
      return JSON.parse(trimmed) as RawJXAElement[];
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

  /**
   * Recursively assign ref IDs to raw elements and build the cache.
   */
  private assignRefs(rawElements: RawJXAElement[], filter: 'interactive' | 'all'): UIElement[] {
    const result: UIElement[] = [];

    for (const raw of rawElements) {
      const element = this.processElement(raw, filter);
      if (element) {
        result.push(element);
      }
    }

    return result;
  }

  private processElement(raw: RawJXAElement, filter: 'interactive' | 'all'): UIElement | null {
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
   * Convert AX role names to human-friendly names.
   */
  private friendlyRole(axRole: string): string {
    const map: Record<string, string> = {
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
    };
    return map[axRole] ?? axRole.replace(/^AX/, '').toLowerCase();
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
