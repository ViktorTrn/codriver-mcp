import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { AccessibilityReader } from '../src/modules/accessibility.js';

const mockExecFile = vi.mocked(execFile);

// Helper to mock osascript/powershell response
function mockExecResponse(jsonData: unknown) {
  mockExecFile.mockImplementation((...args: unknown[]) => {
    const cb = args.find((a, i) => typeof a === 'function' && i >= 2) as
      | ((err: Error | null, result: { stdout: string; stderr: string }) => void)
      | undefined;
    if (cb) {
      cb(null, { stdout: JSON.stringify(jsonData), stderr: '' });
    }
    return undefined as never;
  });
}

function mockExecError(message: string) {
  mockExecFile.mockImplementation((...args: unknown[]) => {
    const cb = args.find((a, i) => typeof a === 'function' && i >= 2) as
      | ((err: Error | null) => void)
      | undefined;
    if (cb) {
      cb(new Error(message));
    }
    return undefined as never;
  });
}

// Sample raw tree (compatible with both macOS JXA and Windows UIA output shape)
const sampleTreeMacOS = [
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

// Windows UIA-style tree (same shape, different role names)
const sampleTreeWindows = [
  {
    role: 'Window',
    title: 'My App',
    description: null,
    value: null,
    enabled: true,
    position: [0, 0],
    size: [1920, 1080],
    children: [
      {
        role: 'ToolBar',
        title: 'Toolbar',
        description: null,
        value: null,
        enabled: true,
        position: [0, 0],
        size: [1920, 38],
        children: [
          {
            role: 'Button',
            title: 'Save',
            description: 'Save document',
            value: null,
            enabled: true,
            position: [100, 5],
            size: [80, 28],
            children: [],
          },
          {
            role: 'Button',
            title: 'Open',
            description: null,
            value: null,
            enabled: false,
            position: [200, 5],
            size: [80, 28],
            children: [],
          },
        ],
      },
      {
        role: 'Edit',
        title: 'Search',
        description: 'Search field',
        value: 'hello',
        enabled: true,
        position: [500, 5],
        size: [200, 28],
        children: [],
      },
      {
        role: 'Text',
        title: null,
        description: 'Status',
        value: 'Ready',
        enabled: true,
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

  describe('macOS (JXA)', () => {
    describe('readUI', () => {
      it('should parse JXA output into UIElement tree with refs', async () => {
        mockExecResponse(sampleTreeMacOS);

        const elements = await reader.readUI();

        expect(elements).toHaveLength(1);
        expect(elements[0].ref).toBe('ref_6');
        expect(elements[0].role).toBe('window');
        expect(elements[0].name).toBe('My App');
        expect(elements[0].children).toBeDefined();
      });

      it('should assign unique refs to all elements (depth-first)', async () => {
        mockExecResponse(sampleTreeMacOS);

        const elements = await reader.readUI();

        const refs: string[] = [];
        const collectRefs = (els: typeof elements) => {
          for (const el of els) {
            refs.push(el.ref);
            if (el.children) collectRefs(el.children);
          }
        };
        collectRefs(elements);

        expect(new Set(refs).size).toBe(refs.length);
        expect(refs.length).toBe(6);
      });

      it('should convert AX roles to friendly names', async () => {
        mockExecResponse(sampleTreeMacOS);

        const elements = await reader.readUI();

        expect(elements[0].role).toBe('window');
        expect(elements[0].children![0].role).toBe('toolbar');
        expect(elements[0].children![0].children![0].role).toBe('button');
        expect(elements[0].children![1].role).toBe('textfield');
      });

      it('should filter for interactive elements only', async () => {
        mockExecResponse(sampleTreeMacOS);

        const elements = await reader.readUI({ filter: 'interactive' });

        const allRoles: string[] = [];
        const collectRoles = (els: typeof elements) => {
          for (const el of els) {
            allRoles.push(el.role);
            if (el.children) collectRoles(el.children);
          }
        };
        collectRoles(elements);

        expect(allRoles).not.toContain('text');
        expect(allRoles).toContain('button');
        expect(allRoles).toContain('textfield');
      });

      it('should handle empty tree', async () => {
        mockExecResponse([]);

        const elements = await reader.readUI();
        expect(elements).toHaveLength(0);
      });
    });

    describe('getElementByRef / getElementCenter', () => {
      it('should cache elements and return by ref', async () => {
        mockExecResponse(sampleTreeMacOS);
        await reader.readUI();

        const saveBtn = reader.getElementByRef('ref_1');
        expect(saveBtn).toBeDefined();
        expect(saveBtn!.role).toBe('button');
        expect(saveBtn!.name).toBe('Save');
      });

      it('should calculate element center from bounds', async () => {
        mockExecResponse(sampleTreeMacOS);
        await reader.readUI();

        const center = reader.getElementCenter('ref_1');
        expect(center).toBeDefined();
        expect(center![0]).toBe(140);
        expect(center![1]).toBe(44);
      });

      it('should return undefined for unknown ref', async () => {
        mockExecResponse(sampleTreeMacOS);
        await reader.readUI();

        expect(reader.getElementByRef('ref_999')).toBeUndefined();
        expect(reader.getElementCenter('ref_999')).toBeUndefined();
      });
    });

    describe('findElements', () => {
      it('should find elements by name', async () => {
        mockExecResponse(sampleTreeMacOS);
        const elements = await reader.readUI();

        const matches = reader.findElements(elements, 'Save');
        expect(matches).toHaveLength(1);
        expect(matches[0].name).toBe('Save');
      });

      it('should find elements by role', async () => {
        mockExecResponse(sampleTreeMacOS);
        const elements = await reader.readUI();

        const matches = reader.findElements(elements, 'button');
        expect(matches.length).toBeGreaterThanOrEqual(2);
      });

      it('should find elements by value', async () => {
        mockExecResponse(sampleTreeMacOS);
        const elements = await reader.readUI();

        const matches = reader.findElements(elements, 'hello');
        expect(matches).toHaveLength(1);
        expect(matches[0].role).toBe('textfield');
      });

      it('should be case-insensitive', async () => {
        mockExecResponse(sampleTreeMacOS);
        const elements = await reader.readUI();

        const matches = reader.findElements(elements, 'SAVE');
        expect(matches).toHaveLength(1);
      });

      it('should return empty array for no matches', async () => {
        mockExecResponse(sampleTreeMacOS);
        const elements = await reader.readUI();

        const matches = reader.findElements(elements, 'nonexistent');
        expect(matches).toHaveLength(0);
      });
    });

    describe('formatTree', () => {
      it('should format tree as indented text', async () => {
        mockExecResponse(sampleTreeMacOS);
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
        mockExecError('not allowed assistive access');

        await expect(reader.readUI()).rejects.toThrow('Accessibility permissions');
      });
    });
  });

  describe('Windows (UIA)', () => {
    beforeEach(() => {
      vi.stubGlobal('process', { ...process, platform: 'win32' });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe('readUI', () => {
      it('should parse UIA output into UIElement tree with refs', async () => {
        mockExecResponse(sampleTreeWindows);

        const elements = await reader.readUI();

        expect(elements).toHaveLength(1);
        expect(elements[0].role).toBe('window');
        expect(elements[0].name).toBe('My App');
        expect(elements[0].children).toBeDefined();
      });

      it('should call powershell on Windows', async () => {
        mockExecResponse(sampleTreeWindows);

        await reader.readUI();

        expect(mockExecFile).toHaveBeenCalledWith(
          'powershell',
          expect.arrayContaining(['-NoProfile', '-NonInteractive']),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should convert Windows UIA roles to friendly names', async () => {
        mockExecResponse(sampleTreeWindows);

        const elements = await reader.readUI();

        expect(elements[0].role).toBe('window');
        expect(elements[0].children![0].role).toBe('toolbar');
        expect(elements[0].children![0].children![0].role).toBe('button');
        expect(elements[0].children![1].role).toBe('textfield'); // Edit -> textfield
      });

      it('should filter for interactive elements (Windows roles)', async () => {
        mockExecResponse(sampleTreeWindows);

        const elements = await reader.readUI({ filter: 'interactive' });

        const allRoles: string[] = [];
        const collectRoles = (els: typeof elements) => {
          for (const el of els) {
            allRoles.push(el.role);
            if (el.children) collectRoles(el.children);
          }
        };
        collectRoles(elements);

        expect(allRoles).not.toContain('text');
        expect(allRoles).toContain('button');
        expect(allRoles).toContain('textfield');
      });

      it('should pass window title to PowerShell script', async () => {
        mockExecResponse([]);

        await reader.readUI({ windowTitle: 'Notepad' });

        const args = mockExecFile.mock.calls[0][1] as string[];
        const script = args[args.length - 1];
        expect(script).toContain('Notepad');
      });

      it('should handle empty tree', async () => {
        mockExecResponse([]);

        const elements = await reader.readUI();
        expect(elements).toHaveLength(0);
      });

      it('should throw on PowerShell error', async () => {
        mockExecError('PowerShell error');

        await expect(reader.readUI()).rejects.toThrow('Failed to read accessibility tree');
      });
    });

    describe('getElementByRef / getElementCenter (Windows)', () => {
      it('should cache Windows UIA elements by ref', async () => {
        mockExecResponse(sampleTreeWindows);
        await reader.readUI();

        // ref_1 = Save button (first leaf in depth-first)
        const saveBtn = reader.getElementByRef('ref_1');
        expect(saveBtn).toBeDefined();
        expect(saveBtn!.role).toBe('button');
        expect(saveBtn!.name).toBe('Save');
      });

      it('should calculate element center for Windows UIA elements', async () => {
        mockExecResponse(sampleTreeWindows);
        await reader.readUI();

        // ref_1 = Save button at position [100, 5] size [80, 28]
        const center = reader.getElementCenter('ref_1');
        expect(center).toBeDefined();
        expect(center![0]).toBe(140); // 100 + 80/2
        expect(center![1]).toBe(19);  // 5 + 28/2
      });
    });

    describe('findElements (Windows)', () => {
      it('should find elements by name in Windows UIA tree', async () => {
        mockExecResponse(sampleTreeWindows);
        const elements = await reader.readUI();

        const matches = reader.findElements(elements, 'Save');
        expect(matches).toHaveLength(1);
        expect(matches[0].name).toBe('Save');
      });

      it('should find elements by friendly role', async () => {
        mockExecResponse(sampleTreeWindows);
        const elements = await reader.readUI();

        const matches = reader.findElements(elements, 'button');
        expect(matches.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('unsupported platform', () => {
    beforeEach(() => {
      vi.stubGlobal('process', { ...process, platform: 'linux' });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should throw for readUI on unsupported platform', async () => {
      await expect(reader.readUI()).rejects.toThrow('not implemented');
    });
  });
});
