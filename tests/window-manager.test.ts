import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { WindowManager } from '../src/modules/window-manager.js';

const mockExecFile = vi.mocked(execFile);

describe('WindowManager', () => {
  let wm: WindowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    wm = new WindowManager();
  });

  describe('listWindows', () => {
    it('should parse Swift/CoreGraphics JSON output into WindowInfo array', async () => {
      const swiftJsonOutput = JSON.stringify([
        { processName: 'Finder', title: 'Desktop', x: 0, y: 25, width: 1920, height: 1055, isFocused: true, windowId: 42 },
        { processName: 'Safari', title: 'Google', x: 100, y: 50, width: 1200, height: 800, isFocused: false, windowId: 55 },
      ]);

      mockExecFile.mockImplementation((cmd, _args, _opts, callback) => {
        // execFileAsync uses promisify, which passes (cmd, args, opts, callback)
        // But with promisify, the callback is the last argument
        const cb = typeof _opts === 'function' ? _opts : callback;
        if (typeof cb === 'function') {
          (cb as (err: Error | null, result: { stdout: string; stderr: string }) => void)(null, {
            stdout: swiftJsonOutput,
            stderr: '',
          });
        }
        return undefined as never;
      });

      const windows = await wm.listWindows();

      expect(windows).toHaveLength(2);
      expect(windows[0]).toEqual({
        id: 42,
        processName: 'Finder',
        title: 'Desktop',
        x: 0,
        y: 25,
        width: 1920,
        height: 1055,
        isFocused: true,
      });
      expect(windows[1]).toEqual({
        id: 55,
        processName: 'Safari',
        title: 'Google',
        x: 100,
        y: 50,
        width: 1200,
        height: 800,
        isFocused: false,
      });

      // Verify swift was called (not osascript)
      expect(mockExecFile).toHaveBeenCalledWith(
        'swift',
        expect.any(Array),
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function)
      );
    });

    it('should return empty array for no windows', async () => {
      mockExecFile.mockImplementation((cmd, _args, _opts, callback) => {
        const cb = typeof _opts === 'function' ? _opts : callback;
        if (typeof cb === 'function') {
          (cb as (err: Error | null, result: { stdout: string; stderr: string }) => void)(null, {
            stdout: '[]',
            stderr: '',
          });
        }
        return undefined as never;
      });

      const windows = await wm.listWindows();
      expect(windows).toHaveLength(0);
    });
  });

  describe('focusWindow', () => {
    it('should call osascript to focus window', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const cb = typeof _opts === 'function' ? _opts : callback;
        if (typeof cb === 'function') {
          (cb as (err: Error | null, result: { stdout: string; stderr: string }) => void)(null, {
            stdout: 'focused',
            stderr: '',
          });
        }
        return undefined as never;
      });

      await expect(wm.focusWindow('Safari')).resolves.toBeUndefined();
      expect(mockExecFile).toHaveBeenCalledWith(
        'osascript',
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should throw when window not found', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const cb = typeof _opts === 'function' ? _opts : callback;
        if (typeof cb === 'function') {
          (cb as (err: Error | null, result: { stdout: string; stderr: string }) => void)(null, {
            stdout: 'not found',
            stderr: '',
          });
        }
        return undefined as never;
      });

      await expect(wm.focusWindow('NonExistent')).rejects.toThrow('not found');
    });
  });
});
