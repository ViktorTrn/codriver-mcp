/**
 * CoDriver MCP Server
 * Registers all desktop automation tools with the MCP server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { screenCapture } from './modules/screen-capture.js';
import { inputController } from './modules/input-controller.js';
import { windowManager } from './modules/window-manager.js';
import { accessibilityReader } from './modules/accessibility.js';

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'codriver-mcp',
      version: '0.3.0',
    },
    {
      capabilities: {
        logging: {},
      },
    }
  );

  // === Phase 1: Core Tools ===

  server.registerTool(
    'desktop_screenshot',
    {
      title: 'Desktop Screenshot',
      description:
        'Take a screenshot of the entire desktop or a specific window. ' +
        'Returns the image as base64 PNG. Use windowTitle to capture a specific window.',
      inputSchema: {
        windowTitle: z
          .string()
          .optional()
          .describe('Title of window to capture (substring match). Omit for full desktop.'),
        scale: z
          .number()
          .min(0.1)
          .max(1.0)
          .optional()
          .describe('Scale factor 0.1-1.0 to reduce image size. Default 1.0.'),
        format: z
          .enum(['png', 'jpeg'])
          .optional()
          .describe('Image format. JPEG is smaller for remote usage. Default: png.'),
        quality: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('JPEG quality 1-100. Only used with format=jpeg. Default: 80.'),
      },
    },
    async ({ windowTitle, scale, format, quality }) => {
      const result = await screenCapture.capture({
        windowTitle,
        scale: scale ?? 1.0,
        format: format ?? 'png',
        quality: quality ?? 80,
      });
      return {
        content: [
          {
            type: 'image' as const,
            data: result.data,
            mimeType: result.mimeType,
          },
          {
            type: 'text' as const,
            text: `Screenshot: ${result.width}x${result.height}px`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'desktop_click',
    {
      title: 'Desktop Click',
      description:
        'Click at a specific coordinate or on a UI element by ref. ' +
        'Provide either (x, y) coordinates or a ref from desktop_read_ui/desktop_find.',
      inputSchema: {
        x: z.number().optional().describe('X coordinate (pixels from left). Required if no ref.'),
        y: z.number().optional().describe('Y coordinate (pixels from top). Required if no ref.'),
        ref: z
          .string()
          .optional()
          .describe('Element reference from desktop_read_ui (e.g. "ref_1"). Alternative to x/y.'),
        button: z
          .enum(['left', 'right', 'middle'])
          .optional()
          .describe('Mouse button. Default: left'),
        doubleClick: z
          .boolean()
          .optional()
          .describe('Double-click instead of single click'),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ x, y, ref, button, doubleClick }) => {
      let clickX: number;
      let clickY: number;
      let targetDesc: string;

      if (ref) {
        const center = accessibilityReader.getElementCenter(ref);
        if (!center) {
          return {
            content: [{ type: 'text' as const, text: `Error: Element "${ref}" not found. Run desktop_read_ui first.` }],
            isError: true,
          };
        }
        [clickX, clickY] = center;
        const el = accessibilityReader.getElementByRef(ref);
        targetDesc = `${ref} (${el?.role} "${el?.name}") at (${clickX}, ${clickY})`;
      } else if (x != null && y != null) {
        clickX = x;
        clickY = y;
        targetDesc = `(${x}, ${y})`;
      } else {
        return {
          content: [{ type: 'text' as const, text: 'Error: Provide either (x, y) coordinates or a ref.' }],
          isError: true,
        };
      }

      await inputController.click({
        coordinate: [clickX, clickY],
        button: button ?? 'left',
        doubleClick: doubleClick ?? false,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Clicked ${button ?? 'left'} at ${targetDesc}${doubleClick ? ' (double)' : ''}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'desktop_type',
    {
      title: 'Desktop Type',
      description:
        'Type text at the current cursor position or into a specific UI element. ' +
        'Provide ref to first click the element, then type.',
      inputSchema: {
        text: z.string().describe('Text to type'),
        ref: z
          .string()
          .optional()
          .describe('Element reference to click first before typing (e.g. "ref_3").'),
        slowly: z
          .boolean()
          .optional()
          .describe('Type one character at a time (for apps with key handlers)'),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ text, ref, slowly }) => {
      // If ref provided, click the element first to focus it
      if (ref) {
        const center = accessibilityReader.getElementCenter(ref);
        if (!center) {
          return {
            content: [{ type: 'text' as const, text: `Error: Element "${ref}" not found. Run desktop_read_ui first.` }],
            isError: true,
          };
        }
        await inputController.click({ coordinate: center });
      }

      await inputController.type({ text, slowly: slowly ?? false });

      const truncated = text.length > 50 ? text.slice(0, 50) + '...' : text;
      return {
        content: [
          {
            type: 'text' as const,
            text: ref
              ? `Clicked ${ref} and typed: "${truncated}"`
              : `Typed: "${truncated}"`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'desktop_key',
    {
      title: 'Desktop Key',
      description:
        'Press a key or key combination. ' +
        'Examples: "enter", "ctrl+c", "ctrl+shift+s", "alt+tab", "f5"',
      inputSchema: {
        key: z
          .string()
          .describe(
            'Key or combination to press (e.g. "enter", "ctrl+c", "alt+tab", "f5")'
          ),
        repeat: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Number of times to press. Default: 1'),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ key, repeat }) => {
      await inputController.key({ key, repeat: repeat ?? 1 });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Pressed: ${key}${(repeat ?? 1) > 1 ? ` x${repeat}` : ''}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'desktop_scroll',
    {
      title: 'Desktop Scroll',
      description: 'Scroll at a specific position on the screen.',
      inputSchema: {
        x: z.number().describe('X coordinate'),
        y: z.number().describe('Y coordinate'),
        direction: z.enum(['up', 'down', 'left', 'right']).describe('Scroll direction'),
        amount: z
          .number()
          .min(1)
          .max(20)
          .optional()
          .describe('Number of scroll ticks. Default: 3'),
      },
    },
    async ({ x, y, direction, amount }) => {
      await inputController.scroll({
        coordinate: [x, y],
        direction,
        amount: amount ?? 3,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Scrolled ${direction} ${amount ?? 3}x at (${x}, ${y})`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'desktop_windows',
    {
      title: 'Desktop Windows',
      description:
        'List all open windows, or focus a specific window by title. ' +
        'Use action "list" to see windows, "focus" to bring a window to front.',
      inputSchema: {
        action: z
          .enum(['list', 'focus'])
          .describe('"list" to get all windows, "focus" to activate a window'),
        title: z
          .string()
          .optional()
          .describe('Window title to focus (substring match). Required for "focus" action.'),
      },
      annotations: {
        readOnlyHint: false,
      },
    },
    async ({ action, title }) => {
      if (action === 'list') {
        const windows = await windowManager.listWindows();
        const text = windows
          .map(
            (w) =>
              `[${w.isFocused ? '*' : ' '}] ${w.title} (${w.processName}) - ${w.width}x${w.height} at (${w.x},${w.y})`
          )
          .join('\n');
        return {
          content: [
            {
              type: 'text' as const,
              text: windows.length > 0 ? `Open Windows:\n${text}` : 'No windows found.',
            },
          ],
        };
      }

      if (action === 'focus' && title) {
        await windowManager.focusWindow(title);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Focused window: "${title}"`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: 'Error: "focus" action requires a "title" parameter',
          },
        ],
        isError: true,
      };
    }
  );

  // === Phase 2: Accessibility Tools ===

  server.registerTool(
    'desktop_read_ui',
    {
      title: 'Desktop Read UI',
      description:
        'Read the accessibility tree of the frontmost window or a specific app. ' +
        'Returns UI elements with ref IDs that can be used with desktop_click and desktop_type. ' +
        'Use filter "interactive" to show only buttons, text fields, etc.',
      inputSchema: {
        windowTitle: z
          .string()
          .optional()
          .describe('App/process name to read (substring match). Omit for frontmost app.'),
        depth: z
          .number()
          .min(1)
          .max(20)
          .optional()
          .describe('Maximum tree depth. Default: 10.'),
        filter: z
          .enum(['interactive', 'all'])
          .optional()
          .describe('"interactive" for buttons/inputs only, "all" for everything. Default: all.'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ windowTitle, depth, filter }) => {
      const elements = await accessibilityReader.readUI({
        windowTitle,
        depth: depth ?? 10,
        filter: filter ?? 'all',
      });

      const tree = accessibilityReader.formatTree(elements);
      const count = countElements(elements);

      return {
        content: [
          {
            type: 'text' as const,
            text: tree
              ? `UI Tree (${count} elements):\n${tree}`
              : 'No UI elements found. Is the app focused? Are accessibility permissions granted?',
          },
        ],
      };
    }
  );

  server.registerTool(
    'desktop_find',
    {
      title: 'Desktop Find',
      description:
        'Find UI elements by name, role, or value. Returns matching elements with ref IDs. ' +
        'Searches the accessibility tree of the frontmost window. ' +
        'Use desktop_read_ui first to populate the tree, or this tool will read it automatically.',
      inputSchema: {
        query: z
          .string()
          .describe('Search query (matches element name, role, or value). E.g. "Save", "button", "search".'),
        windowTitle: z
          .string()
          .optional()
          .describe('App/process name to search (substring match). Omit for frontmost app.'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ query, windowTitle }) => {
      // Always read fresh tree for find
      const elements = await accessibilityReader.readUI({
        windowTitle,
        depth: 10,
        filter: 'all',
      });

      const matches = accessibilityReader.findElements(elements, query);

      if (matches.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No elements found matching "${query}".`,
            },
          ],
        };
      }

      const lines = matches.map((el) => {
        const parts = [`[${el.ref}]`, el.role, `"${el.name}"`];
        if (el.value) parts.push(`value="${el.value}"`);
        if (el.enabled === false) parts.push('(disabled)');
        const [bx, by, bw, bh] = el.bounds;
        parts.push(`at (${bx},${by}) ${bw}x${bh}`);
        return parts.join(' ');
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Found ${matches.length} element(s) matching "${query}":\n${lines.join('\n')}`,
          },
        ],
      };
    }
  );

  return server;
}

/** Count total elements in a tree */
function countElements(elements: { children?: { children?: unknown[] }[] }[]): number {
  let count = 0;
  for (const el of elements) {
    count++;
    if (el.children) {
      count += countElements(el.children as typeof elements);
    }
  }
  return count;
}
