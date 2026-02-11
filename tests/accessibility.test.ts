import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { AccessibilityReader } from '../src/modules/accessibility.js';

const mockExecFile = vi.mocked(execFile);

// Helper to mock osascript JXA response
function mockJXAResponse(jsonData: unknown) {
  mockExecFile.mockImplementation((...args: unknown[]) => {
    // Find the callback (last function argument)
    const cb = args.find((a, i) => typeof a === 'function' && i >= 2) as
      | ((err: Error | null, result: { stdout: string; stderr: string }) => void)
      | undefined;
    if (cb) {
      cb(null, { stdout: JSON.stringify(jsonData), stderr: '' });
    }
    return undefined as never;
  });
}

// Sample raw JXA tree
// Ref assignment is depth-first (children before parent):
//   Save button    → ref_1
//   Open button    → ref_2
//   Toolbar        → ref_3  (after its children)
//   Search field   → ref_4
//   Status text    → ref_5
//   Window         → ref_6  (last, root)
const sampleTree = [
  {
    role: 'AXWindow',
    title: 'My App',
    description: null,
    value: null,
    enabled: true,
    position: [0, 25],
    size: [1920, 1055],
    children: [
      {
        role: 'AXToolbar',
        title: 'Toolbar',
        description: null,
        value: null,
        enabled: true,
        position: [0, 25],
        size: [1920, 38],
        children: [
          {
            role: 'AXButton',
            title: 'Save',
            description: 'Save document',
            value: null,
            enabled: true,
            position: [100, 30],
            size: [80, 28],
            children: [],
          },
          {
            role: 'AXButton',
            title: 'Open',
            description: null,
            value: null,
            enabled: false,
            position: [200, 30],
            size: [80, 28],
            children: [],
          },
        ],
      },
      {
        role: 'AXTextField',
        title: 'Search',
        description: 'Search field',
        value: 'hello',
        enabled: true,
        position: [500, 30],
        size: [200, 28],
        children: [],
      },
      {
        role: 'AXStaticText',
        title: null,
        description: 'Status',
        value: 'Ready',
        enabled: null,
        position: [0, 1050],
        size: [1920, 30],
        children: [],
      },
    ],
  },
];

describe('AccessibilityReader', () => {
  let reader: AccessibilityReader;

  beforeEach(() => {
    vi.clearAllMocks();
    reader = new AccessibilityReader();
  });

  describe('readUI', () => {
    it('should parse JXA output into UIElement tree with refs', async () => {
      mockJXAResponse(sampleTree);

      const elements = await reader.readUI();

      expect(elements).toHaveLength(1);
      // Window is root → gets last ref (depth-first)
      expect(elements[0].ref).toBe('ref_6');
      expect(elements[0].role).toBe('window');
      expect(elements[0].name).toBe('My App');
      expect(elements[0].children).toBeDefined();
    });

    it('should assign unique refs to all elements (depth-first)', async () => {
      mockJXAResponse(sampleTree);

      const elements = await reader.readUI();

      const refs: string[] = [];
      const collectRefs = (els: typeof elements) => {
        for (const el of els) {
          refs.push(el.ref);
          if (el.children) collectRefs(el.children);
        }
      };
      collectRefs(elements);

      // All refs should be unique
      expect(new Set(refs).size).toBe(refs.length);
      // 6 total: 2 buttons + toolbar + textfield + statictext + window
      expect(refs.length).toBe(6);
    });

    it('should convert AX roles to friendly names', async () => {
      mockJXAResponse(sampleTree);

      const elements = await reader.readUI();

      expect(elements[0].role).toBe('window');
      expect(elements[0].children![0].role).toBe('toolbar');
      expect(elements[0].children![0].children![0].role).toBe('button');
      expect(elements[0].children![1].role).toBe('textfield');
    });

    it('should filter for interactive elements only', async () => {
      mockJXAResponse(sampleTree);

      const elements = await reader.readUI({ filter: 'interactive' });

      const allRoles: string[] = [];
      const collectRoles = (els: typeof elements) => {
        for (const el of els) {
          allRoles.push(el.role);
          if (el.children) collectRoles(el.children);
        }
      };
      collectRoles(elements);

      // Static text has no interactive children → excluded
      expect(allRoles).not.toContain('text');
      expect(allRoles).toContain('button');
      expect(allRoles).toContain('textfield');
    });

    it('should handle empty tree', async () => {
      mockJXAResponse([]);

      const elements = await reader.readUI();
      expect(elements).toHaveLength(0);
    });
  });

  describe('getElementByRef / getElementCenter', () => {
    it('should cache elements and return by ref', async () => {
      mockJXAResponse(sampleTree);
      await reader.readUI();

      // ref_1 = Save button (first leaf in depth-first)
      const saveBtn = reader.getElementByRef('ref_1');
      expect(saveBtn).toBeDefined();
      expect(saveBtn!.role).toBe('button');
      expect(saveBtn!.name).toBe('Save');
    });

    it('should calculate element center from bounds', async () => {
      mockJXAResponse(sampleTree);
      await reader.readUI();

      // ref_1 = Save button at position [100, 30] size [80, 28]
      // Center = [100 + 80/2, 30 + 28/2] = [140, 44]
      const center = reader.getElementCenter('ref_1');
      expect(center).toBeDefined();
      expect(center![0]).toBe(140);
      expect(center![1]).toBe(44);
    });

    it('should return undefined for unknown ref', async () => {
      mockJXAResponse(sampleTree);
      await reader.readUI();

      expect(reader.getElementByRef('ref_999')).toBeUndefined();
      expect(reader.getElementCenter('ref_999')).toBeUndefined();
    });
  });

  describe('findElements', () => {
    it('should find elements by name', async () => {
      mockJXAResponse(sampleTree);
      const elements = await reader.readUI();

      const matches = reader.findElements(elements, 'Save');
      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('Save');
    });

    it('should find elements by role', async () => {
      mockJXAResponse(sampleTree);
      const elements = await reader.readUI();

      const matches = reader.findElements(elements, 'button');
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('should find elements by value', async () => {
      mockJXAResponse(sampleTree);
      const elements = await reader.readUI();

      const matches = reader.findElements(elements, 'hello');
      expect(matches).toHaveLength(1);
      expect(matches[0].role).toBe('textfield');
    });

    it('should be case-insensitive', async () => {
      mockJXAResponse(sampleTree);
      const elements = await reader.readUI();

      const matches = reader.findElements(elements, 'SAVE');
      expect(matches).toHaveLength(1);
    });

    it('should return empty array for no matches', async () => {
      mockJXAResponse(sampleTree);
      const elements = await reader.readUI();

      const matches = reader.findElements(elements, 'nonexistent');
      expect(matches).toHaveLength(0);
    });
  });

  describe('formatTree', () => {
    it('should format tree as indented text', async () => {
      mockJXAResponse(sampleTree);
      const elements = await reader.readUI();

      const output = reader.formatTree(elements);

      expect(output).toContain('window "My App"');
      expect(output).toContain('button "Save"');
      expect(output).toContain('(disabled)');
      expect(output).toContain('value="hello"');
    });
  });

  describe('error handling', () => {
    it('should throw with accessibility permissions hint', async () => {
      mockExecFile.mockImplementation((...args: unknown[]) => {
        const cb = args.find((a, i) => typeof a === 'function' && i >= 2) as
          | ((err: Error | null) => void)
          | undefined;
        if (cb) {
          cb(new Error('not allowed assistive access'));
        }
        return undefined as never;
      });

      await expect(reader.readUI()).rejects.toThrow('Accessibility permissions');
    });
  });
});
