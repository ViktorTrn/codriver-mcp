/**
 * CoDriver MCP Server
 * Registers all desktop automation tools with the MCP server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { screenCapture } from './modules/screen-capture.js';
import { inputController } from './modules/input-controller.js';
import { windowManager } from './modules/window-manager.js';

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'codriver-mcp',
      version: '0.1.0',
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
      },
    },
    async ({ windowTitle, scale }) => {
      const result = await screenCapture.capture({
        windowTitle,
        scale: scale ?? 1.0,
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
        'Click at a specific coordinate on the screen. ' +
        'Use desktop_screenshot first to identify the target location.',
      inputSchema: {
        x: z.number().describe('X coordinate (pixels from left)'),
        y: z.number().describe('Y coordinate (pixels from top)'),
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
    async ({ x, y, button, doubleClick }) => {
      await inputController.click({
        coordinate: [x, y],
        button: button ?? 'left',
        doubleClick: doubleClick ?? false,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Clicked ${button ?? 'left'} at (${x}, ${y})${doubleClick ? ' (double)' : ''}`,
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
        'Type text at the current cursor position. ' +
        'Use desktop_click first to focus the target input field.',
      inputSchema: {
        text: z.string().describe('Text to type'),
        slowly: z
          .boolean()
          .optional()
          .describe('Type one character at a time (for apps with key handlers)'),
      },
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ text, slowly }) => {
      await inputController.type({ text, slowly: slowly ?? false });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Typed: "${text.length > 50 ? text.slice(0, 50) + '...' : text}"`,
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

  return server;
}
