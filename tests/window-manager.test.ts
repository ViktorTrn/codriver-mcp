import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { WindowManager } from '../src/modules/window-manager.js';

const mockExecFile = vi.mocked(execFile);

function mockExecSuccess(stdout: string) {
  mockExecFile.mockImplementation((cmd, _args, _opts, callback) => {
    const cb = typeof _opts === 'function' ? _opts : callback;
    if (typeof cb === 'function') {
      (cb as (err: Error | null, result: { stdout: string; stderr: string }) => void)(null, {
        stdout,
        stderr: '',
      });
    }
    return undefined as never;
  });
}

function mockExecError(message: string) {
  mockExecFile.mockImplementation((cmd, _args, _opts, callback) => {
    const cb = typeof _opts === 'function' ? _opts : callback;
    if (typeof cb === 'function') {
      (cb as (err: Error | null) => void)(new Error(message));
    }
    return undefined as never;
  });
}

const sampleWindows = [
  { processName: 'Finder', title: 'Desktop', x: 0, y: 25, width: 1920, height: 1055, isFocused: true, windowId: 42 },
  { processName: 'Safari', title: 'Google', x: 100, y: 50, width: 1200, height: 800, isFocused: false, windowId: 55 },
];

describe('WindowManager', () => {
  let wm: WindowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    wm = new WindowManager();
  });

  describe('macOS', () => {
    describe('listWindows', () => {
      it('should parse Swift/CoreGraphics JSON output into WindowInfo array', async () => {
        mockExecSuccess(JSON.stringify(sampleWindows));

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

        expect(mockExecFile).toHaveBeenCalledWith(
          'swift',
          expect.any(Array),
          expect.objectContaining({ timeout: 30000 }),
          expect.any(Function)
        );
      });

      it('should return empty array for no windows', async () => {
        mockExecSuccess('[]');

        const windows = await wm.listWindows();
        expect(windows).toHaveLength(0);
      });
    });

    describe('focusWindow', () => {
      it('should call osascript to focus window', async () => {
        mockExecSuccess('focused');

        await expect(wm.focusWindow('Safari')).resolves.toBeUndefined();
        expect(mockExecFile).toHaveBeenCalledWith(
          'osascript',
          expect.any(Array),
          expect.any(Function)
        );
      });

      it('should throw when window not found', async () => {
        mockExecSuccess('not found');

        await expect(wm.focusWindow('NonExistent')).rejects.toThrow('not found');
      });
    });
  });

  describe('Windows', () => {
    beforeEach(() => {
      vi.stubGlobal('process', { ...process, platform: 'win32' });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe('listWindows', () => {
      it('should parse PowerShell JSON output into WindowInfo array', async () => {
        mockExecSuccess(JSON.stringify(sampleWindows));

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

        expect(mockExecFile).toHaveBeenCalledWith(
          'powershell',
          expect.arrayContaining(['-NoProfile', '-NonInteractive']),
          expect.objectContaining({ timeout: 30000 }),
          expect.any(Function)
        );
      });

      it('should return empty array for no windows', async () => {
        mockExecSuccess('[]');

        const windows = await wm.listWindows();
        expect(windows).toHaveLength(0);
      });

      it('should throw on PowerShell error', async () => {
        mockExecError('PowerShell error');

        await expect(wm.listWindows()).rejects.toThrow('Failed to list windows');
      });
    });

    describe('focusWindow', () => {
      it('should focus window via PowerShell', async () => {
        mockExecSuccess('focused');

        await expect(wm.focusWindow('Notepad')).resolves.toBeUndefined();
        expect(mockExecFile).toHaveBeenCalledWith(
          'powershell',
          expect.arrayContaining(['-NoProfile']),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should throw when window not found', async () => {
        mockExecSuccess('not found');

        await expect(wm.focusWindow('NonExistent')).rejects.toThrow('not found');
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

    it('should throw for listWindows on unsupported platform', async () => {
      await expect(wm.listWindows()).rejects.toThrow('not implemented');
    });

    it('should throw for focusWindow on unsupported platform', async () => {
      await expect(wm.focusWindow('test')).rejects.toThrow('not implemented');
    });
  });
});
