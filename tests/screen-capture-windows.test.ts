import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process: the capture runs as a PowerShell script via execFile
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
  execFileSync: vi.fn(),
}));

// Pretend the capture file is readable
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => Buffer.from('png')),
    writeFileSync: vi.fn(),
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

import { execFile, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
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

/** The PowerShell script passed to execFile (last argument after the flags) */
function scriptOf(call: unknown[]): string {
  return (call[1] as string[]).at(-1)!;
}

const isList = (call: unknown[]) => scriptOf(call).includes('[CoDriverScreen]::List()');

/** Answer the monitor list with LIST_OUTPUT and any capture call with captureStdout */
function mockPowerShell(captureStdout = '') {
  mockExecFile.mockImplementation(((...call: unknown[]) => {
    const cb = call.at(-1) as Function;
    cb(null, isList(call) ? LIST_OUTPUT : captureStdout, '');
  }) as never);
}

/** The capture call: [CoDriverScreen]::Capture('<path>', '<device>') */
function captureCall(): { path: string; device: string } {
  const call = mockExecFile.mock.calls.find((c) => !isList(c));
  const match = /\[CoDriverScreen\]::Capture\('((?:[^']|'')*)', '((?:[^']|'')*)'\)/.exec(scriptOf(call!));
  return { path: match![1]!, device: match![2]! };
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
    it('should parse monitors from PowerShell, including negative coordinates', async () => {
      mockPowerShell();

      const displays = await capture.listDisplays();

      expect(displays).toEqual([
        { id: 0, name: '\\\\.\\DISPLAY2', x: 3840, y: 731, width: 1920, height: 1200 },
        { id: 1, name: '\\\\.\\DISPLAY3', x: 0, y: 0, width: 3840, height: 2160 },
        { id: 2, name: '\\\\.\\DISPLAY4', x: -3840, y: -97, width: 3840, height: 2160 },
      ]);
    });
  });

  // ThreatDown quarantines screenshot-desktop's screenCapture bat as RiskWare.ScreenCapture
  describe('antivirus-safe capture', () => {
    it('should run hidden PowerShell instead of a helper exe', async () => {
      mockPowerShell();

      await capture.capture();

      for (const call of mockExecFile.mock.calls) {
        expect(call[0]).toBe('powershell');
        expect(call[2]).toEqual(expect.objectContaining({ windowsHide: true }));
      }
      expect(captureCall().device).toBe('');
    });

    it('should neither write nor compile helper files', async () => {
      mockPowerShell();

      await capture.capture({ screen: 1 });
      await capture.listDisplays();

      expect(writeFileSync).not.toHaveBeenCalled();
      expect(execFileSync).not.toHaveBeenCalled();
    });

    it('should make the capture DPI-aware like the former exe (dpiAware True/PM)', async () => {
      mockPowerShell();

      await capture.listDisplays();

      expect(scriptOf(mockExecFile.mock.calls[0]!)).toContain('SetThreadDpiAwarenessContext');
    });

    it('should escape quotes in the capture path', async () => {
      vi.stubEnv('TEMP', "C:\\Users\\O'Brien\\Temp");
      vi.stubEnv('TMP', "C:\\Users\\O'Brien\\Temp");
      vi.stubEnv('TMPDIR', "/tmp/O'Brien"); // CI also runs this file on macOS
      mockPowerShell();

      await capture.capture();

      expect(captureCall().path).toContain("O''Brien");
      vi.unstubAllEnvs();
    });
  });

  describe('capture with windowTitle', () => {
    it('should capture the monitor holding the window and crop to it', async () => {
      mockPowerShell();
      mockListWindows.mockResolvedValue([win('Labelwin (IBT Ingenierbüro Trncik)', 3840, 731, 321, 556)]);

      const result = await capture.capture({ windowTitle: 'labelwin (ibt' });

      expect(captureCall().device).toBe('\\\\.\\DISPLAY2');
      expect(mockSharpInstance.extract).toHaveBeenCalledWith({ left: 0, top: 0, width: 321, height: 556 });
      expect(result.width).toBe(321);
      expect(result.height).toBe(556);
    });

    it('should handle monitors with negative coordinates', async () => {
      mockPowerShell();
      mockListWindows.mockResolvedValue([win('Fällige Tätigkeiten', -3840, 959, 1920, 1056)]);

      await capture.capture({ windowTitle: 'Fällige' });

      expect(captureCall().device).toBe('\\\\.\\DISPLAY4');
      expect(mockSharpInstance.extract).toHaveBeenCalledWith({ left: 0, top: 1056, width: 1920, height: 1056 });
    });

    it('should clip a window that extends beyond its monitor', async () => {
      mockPowerShell();
      mockListWindows.mockResolvedValue([win('Maximized', -8, -8, 3856, 2176)]);

      await capture.capture({ windowTitle: 'Maximized' });

      expect(captureCall().device).toBe('\\\\.\\DISPLAY3');
      expect(mockSharpInstance.extract).toHaveBeenCalledWith({ left: 0, top: 0, width: 3840, height: 2160 });
    });

    it('should throw instead of falling back when the window is not found', async () => {
      mockPowerShell();
      mockListWindows.mockResolvedValue([win('Other', 0, 0, 100, 100)]);

      await expect(capture.capture({ windowTitle: 'Labelwin' })).rejects.toThrow('not found');
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('should throw for a minimized window', async () => {
      mockPowerShell();
      mockListWindows.mockResolvedValue([win('Firefox', -32000, -32000, 160, 28)]);

      await expect(capture.capture({ windowTitle: 'Firefox' })).rejects.toThrow('not visible');
    });
  });

  describe('capture with screen', () => {
    it('should capture the display with the given index', async () => {
      mockPowerShell();

      await capture.capture({ screen: 2 });

      expect(captureCall().device).toBe('\\\\.\\DISPLAY4');
    });

    it('should throw for an unknown display index', async () => {
      mockPowerShell();

      await expect(capture.capture({ screen: 7 })).rejects.toThrow('Display 7 not found');
    });

    it('should throw when the display cannot be captured', async () => {
      mockPowerShell('Unable to capture image');

      await expect(capture.capture({ screen: 0 })).rejects.toThrow('Failed to capture display');
    });
  });

  describe('toDesktopCoordinate', () => {
    it('should add the monitor origin to screen-relative coordinates', async () => {
      mockPowerShell();

      await expect(capture.toDesktopCoordinate(0, [100, 50])).resolves.toEqual([3940, 781]);
    });

    it('should handle monitors with negative coordinates', async () => {
      mockPowerShell();

      await expect(capture.toDesktopCoordinate(2, [840, 1097])).resolves.toEqual([-3000, 1000]);
    });

    it('should reject coordinates outside the monitor', async () => {
      mockPowerShell();

      await expect(capture.toDesktopCoordinate(0, [1920, 10])).rejects.toThrow('outside display 0');
      await expect(capture.toDesktopCoordinate(0, [-1, 10])).rejects.toThrow('outside display 0');
    });

    it('should throw for an unknown display index', async () => {
      mockPowerShell();

      await expect(capture.toDesktopCoordinate(7, [0, 0])).rejects.toThrow('Display 7 not found');
    });
  });

  it('should capture the primary display by default', async () => {
    mockPowerShell();

    await capture.capture();

    expect(captureCall().device).toBe('');
  });
});
