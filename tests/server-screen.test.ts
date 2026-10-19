import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Display 2 sits left of the primary monitor at (-3840, -97), 3840x2160
vi.mock('../src/modules/screen-capture.js', () => ({
  screenCapture: {
    toDesktopCoordinate: vi.fn(async (screen: number, [x, y]: [number, number]) => {
      if (screen !== 2) throw new Error(`Display ${screen} not found.`);
      if (x >= 3840 || y >= 2160) throw new Error(`Coordinate (${x}, ${y}) is outside display 2 (3840x2160).`);
      return [-3840 + x, -97 + y];
    }),
  },
}));

vi.mock('../src/modules/input-controller.js', () => ({
  inputController: { click: vi.fn(), scroll: vi.fn(), drag: vi.fn() },
}));

vi.mock('../src/modules/accessibility.js', () => ({
  accessibilityReader: {
    getElementCenter: vi.fn(() => [500, 600]),
    getElementByRef: vi.fn(() => ({ role: 'button', name: 'OK' })),
  },
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { inputController } from '../src/modules/input-controller.js';

const client = new Client({ name: 'test', version: '1.0.0' });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await createServer().connect(serverTransport);
await client.connect(clientTransport);

afterAll(async () => {
  await client.close();
});

async function call(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as Array<{ text: string }>)[0]!.text;
  return { text, isError: result.isError === true };
}

describe('screen-relative coordinates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('desktop_click', () => {
    it('should convert x/y relative to the display', async () => {
      const { text, isError } = await call('desktop_click', { x: 840, y: 1097, screen: 2 });

      expect(isError).toBe(false);
      expect(inputController.click).toHaveBeenCalledWith(
        expect.objectContaining({ coordinate: [-3000, 1000] })
      );
      expect(text).toContain('on screen 2 = desktop (-3000, 1000)');
    });

    it('should keep desktop coordinates without screen', async () => {
      await call('desktop_click', { x: 840, y: 1097 });

      expect(inputController.click).toHaveBeenCalledWith(
        expect.objectContaining({ coordinate: [840, 1097] })
      );
    });

    it('should not click outside the display', async () => {
      const { text, isError } = await call('desktop_click', { x: 3840, y: 10, screen: 2 });

      expect(isError).toBe(true);
      expect(text).toContain('outside display 2');
      expect(inputController.click).not.toHaveBeenCalled();
    });

    it('should reject screen together with ref', async () => {
      const { isError } = await call('desktop_click', { ref: 'ref_1', screen: 2 });

      expect(isError).toBe(true);
      expect(inputController.click).not.toHaveBeenCalled();
    });
  });

  describe('desktop_scroll', () => {
    it('should convert x/y relative to the display', async () => {
      const { text } = await call('desktop_scroll', { x: 840, y: 1097, direction: 'down', screen: 2 });

      expect(inputController.scroll).toHaveBeenCalledWith(
        expect.objectContaining({ coordinate: [-3000, 1000], direction: 'down' })
      );
      expect(text).toContain('on screen 2 = desktop (-3000, 1000)');
    });

    it('should not scroll on an unknown display', async () => {
      const { isError } = await call('desktop_scroll', { x: 10, y: 10, direction: 'up', screen: 5 });

      expect(isError).toBe(true);
      expect(inputController.scroll).not.toHaveBeenCalled();
    });
  });

  describe('desktop_drag', () => {
    it('should convert both endpoints relative to the display', async () => {
      await call('desktop_drag', { startX: 840, startY: 1097, endX: 940, endY: 1197, screen: 2 });

      expect(inputController.drag).toHaveBeenCalledWith({
        startCoordinate: [-3000, 1000],
        endCoordinate: [-2900, 1100],
      });
    });

    it('should keep ref endpoints in desktop coordinates', async () => {
      await call('desktop_drag', { startRef: 'ref_1', endX: 840, endY: 1097, screen: 2 });

      expect(inputController.drag).toHaveBeenCalledWith({
        startCoordinate: [500, 600],
        endCoordinate: [-3000, 1000],
      });
    });

    it('should not drag when an endpoint is outside the display', async () => {
      const { isError } = await call('desktop_drag', { startX: 10, startY: 10, endX: 4000, endY: 10, screen: 2 });

      expect(isError).toBe(true);
      expect(inputController.drag).not.toHaveBeenCalled();
    });

    it('should reject screen when both endpoints are refs', async () => {
      const { isError } = await call('desktop_drag', { startRef: 'ref_1', endRef: 'ref_2', screen: 2 });

      expect(isError).toBe(true);
      expect(inputController.drag).not.toHaveBeenCalled();
    });
  });
});
