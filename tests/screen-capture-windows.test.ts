import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process: the screenCapture exe is called via execFile
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
  execFileSync: vi.fn(),
}));

// Pretend the compiled exe already exists and the capture file is readable
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => Buffer.from('png')),
    unlinkSync: vi.fn(),
  };
});

vi.mock('screenshot-desktop', () => ({ default: vi.fn() }));

vi.mock('../src/modules/window-manager.js', () => ({
  windowManager: { listWindows: vi.fn() },
}));

const mockSharpInstance = {
  metadata: vi.fn(async () => ({ width: 1920, height: 1200 })),
  extract: vi.fn().mockReturnThis(),
  resize: vi.fn().mockReturnThis(),
  png: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  toBuffer: vi.fn(async () => Buffer.from('out')),
};

vi.mock('sharp', () => ({
  default: vi.fn(() => mockSharpInstance),
}));

import { execFile } from 'node:child_process';
import { windowManager } from '../src/modules/window-manager.js';
import { ScreenCapture } from '../src/modules/screen-capture.js';

const mockExecFile = vi.mocked(execFile);
const mockListWindows = vi.mocked(windowManager.listWindows);

// Layout of IBT01: secondary monitor right, primary 4K, 4K monitor left with negative coordinates
const LIST_OUTPUT = [
  '\\\\.\\DISPLAY2;731;5760;1931;3840;1',
  '\\\\.\\DISPLAY3;0;3840;2160;0;1',
  '\\\\.\\DISPLAY4;-97;0;2063;-3840;1',
  '',
].join('\r\n');

/** Answer `/list` with LIST_OUTPUT and any capture call with captureStdout */
function mockExe(captureStdout = 'Taking a capture of the whole screen') {
  mockExecFile.mockImplementation(((_file: string, args: string[], _opts: unknown, cb: Function) => {
    cb(null, args[0] === '/list' ? LIST_OUTPUT : captureStdout, '');
  }) as never);
}

function captureArgs(): string[] {
  const call = mockExecFile.mock.calls.find((c) => (c[1] as string[])[0] !== '/list');
  return call![1] as string[];
}

function win(title: string, x: number, y: number, width: number, height: number) {
  return { id: 1, title, processName: 'labelwin', x, y, width, height, isFocused: false };
}

describe('ScreenCapture on Windows', () => {
  let capture: ScreenCapture;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('process', { ...process, platform: 'win32' });
    mockSharpInstance.extract.mockReturnThis();
    mockSharpInstance.resize.mockReturnThis();
    mockSharpInstance.png.mockReturnThis();
    mockSharpInstance.jpeg.mockReturnThis();
    capture = new ScreenCapture();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listDisplays', () => {
    it('should parse monitors from the exe directly, including negative coordinates', async () => {
      mockExe();

      const displays = await capture.listDisplays();

      expect(displays).toEqual([
        { id: 0, name: '\\\\.\\DISPLAY2', x: 3840, y: 731, width: 1920, height: 1200 },
        { id: 1, name: '\\\\.\\DISPLAY3', x: 0, y: 0, width: 3840, height: 2160 },
        { id: 2, name: '\\\\.\\DISPLAY4', x: -3840, y: -97, width: 3840, height: 2160 },
      ]);
      expect(mockExecFile.mock.calls[0]![0]).toMatch(/screenCapture_1\.3\.2\.exe$/);
      expect(mockExecFile.mock.calls[0]![1]).toEqual(['/list']);
    });
  });

  describe('capture with windowTitle', () => {
    it('should capture the monitor holding the window and crop to it', async () => {
      mockExe();
      mockListWindows.mockResolvedValue([win('Labelwin (IBT Ingenierbüro Trncik)', 3840, 731, 321, 556)]);

      const result = await capture.capture({ windowTitle: 'labelwin (ibt' });

      expect(captureArgs().slice(1)).toEqual(['/d', '\\\\.\\DISPLAY2']);
      expect(mockSharpInstance.extract).toHaveBeenCalledWith({ left: 0, top: 0, width: 321, height: 556 });
      expect(result.width).toBe(321);
      expect(result.height).toBe(556);
    });

    it('should handle monitors with negative coordinates', async () => {
      mockExe();
      mockListWindows.mockResolvedValue([win('Fällige Tätigkeiten', -3840, 959, 1920, 1056)]);

      await capture.capture({ windowTitle: 'Fällige' });

      expect(captureArgs().slice(1)).toEqual(['/d', '\\\\.\\DISPLAY4']);
      expect(mockSharpInstance.extract).toHaveBeenCalledWith({ left: 0, top: 1056, width: 1920, height: 1056 });
    });

    it('should clip a window that extends beyond its monitor', async () => {
      mockExe();
      mockListWindows.mockResolvedValue([win('Maximized', -8, -8, 3856, 2176)]);

      await capture.capture({ windowTitle: 'Maximized' });

      expect(captureArgs().slice(1)).toEqual(['/d', '\\\\.\\DISPLAY3']);
      expect(mockSharpInstance.extract).toHaveBeenCalledWith({ left: 0, top: 0, width: 3840, height: 2160 });
    });

    it('should throw instead of falling back when the window is not found', async () => {
      mockExe();
      mockListWindows.mockResolvedValue([win('Other', 0, 0, 100, 100)]);

      await expect(capture.capture({ windowTitle: 'Labelwin' })).rejects.toThrow('not found');
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('should throw for a minimized window', async () => {
      mockExe();
      mockListWindows.mockResolvedValue([win('Firefox', -32000, -32000, 160, 28)]);

      await expect(capture.capture({ windowTitle: 'Firefox' })).rejects.toThrow('not visible');
    });
  });

  describe('capture with screen', () => {
    it('should capture the display with the given index', async () => {
      mockExe();

      await capture.capture({ screen: 2 });

      expect(captureArgs().slice(1)).toEqual(['/d', '\\\\.\\DISPLAY4']);
    });

    it('should throw for an unknown display index', async () => {
      mockExe();

      await expect(capture.capture({ screen: 7 })).rejects.toThrow('Display 7 not found');
    });

    it('should throw when the exe falls back to the main display', async () => {
      mockExe('Unable to capture image... using main display');

      await expect(capture.capture({ screen: 0 })).rejects.toThrow('Failed to capture display');
    });
  });

  it('should capture the primary display without /d by default', async () => {
    mockExe();

    await capture.capture();

    expect(captureArgs()).toHaveLength(1);
  });
});
