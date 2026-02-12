import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { AppLauncher } from '../src/modules/app-launcher.js';

const mockExecFile = vi.mocked(execFile);

function mockExecSuccess(stdout = '') {
  mockExecFile.mockImplementation((...args: unknown[]) => {
    const cb = args.find((a, i) => typeof a === 'function' && i >= 2) as
      | ((err: Error | null, result: { stdout: string; stderr: string }) => void)
      | undefined;
    if (cb) cb(null, { stdout, stderr: '' });
    return undefined as never;
  });
}

function mockExecError(message: string) {
  mockExecFile.mockImplementation((...args: unknown[]) => {
    const cb = args.find((a, i) => typeof a === 'function' && i >= 2) as
      | ((err: Error | null) => void)
      | undefined;
    if (cb) cb(new Error(message));
    return undefined as never;
  });
}

describe('AppLauncher', () => {
  let launcher: AppLauncher;

  beforeEach(() => {
    vi.clearAllMocks();
    launcher = new AppLauncher();
  });

  describe('macOS', () => {
    describe('launch', () => {
      it('should launch an app via AppleScript', async () => {
        mockExecSuccess();

        const result = await launcher.launch('Safari');

        expect(result).toContain('Launched');
        expect(result).toContain('Safari');
        expect(mockExecFile).toHaveBeenCalledWith(
          'osascript',
          ['-e', expect.stringContaining('Safari')],
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should use activate command', async () => {
        mockExecSuccess();

        await launcher.launch('Finder');

        const script = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
        expect(script[1]).toContain('activate');
      });

      it('should throw on launch failure', async () => {
        mockExecError('Application not found');

        await expect(launcher.launch('NonExistent')).rejects.toThrow('Failed to launch');
      });
    });

    describe('quit', () => {
      it('should quit an app via AppleScript', async () => {
        mockExecSuccess();

        const result = await launcher.quit('Safari');

        expect(result).toContain('Quit');
        const script = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
        expect(script[1]).toContain('quit');
      });

      it('should throw on quit failure', async () => {
        mockExecError('Not running');

        await expect(launcher.quit('Safari')).rejects.toThrow('Failed to quit');
      });
    });

    describe('isRunning', () => {
      it('should return true when app is running', async () => {
        mockExecSuccess('true');

        const result = await launcher.isRunning('Finder');
        expect(result).toBe(true);
      });

      it('should return false when app is not running', async () => {
        mockExecSuccess('false');

        const result = await launcher.isRunning('NonExistent');
        expect(result).toBe(false);
      });

      it('should return false on error', async () => {
        mockExecError('Some error');

        const result = await launcher.isRunning('SomeApp');
        expect(result).toBe(false);
      });
    });

    describe('escaping', () => {
      it('should escape quotes in app names', async () => {
        mockExecSuccess();

        await launcher.launch('My "App"');

        const script = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
        expect(script[1]).toContain('My \\"App\\"');
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

    describe('launch', () => {
      it('should launch an app via PowerShell Start-Process', async () => {
        mockExecSuccess('ok');

        const result = await launcher.launch('notepad');

        expect(result).toContain('Launched');
        expect(result).toContain('notepad');
        expect(mockExecFile).toHaveBeenCalledWith(
          'powershell',
          expect.arrayContaining(['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command']),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should escape single quotes in app names for PowerShell', async () => {
        mockExecSuccess('ok');

        await launcher.launch("My'App");

        const args = mockExecFile.mock.calls[0][1] as string[];
        const script = args[args.length - 1];
        expect(script).toContain("My''App");
      });

      it('should throw on launch failure', async () => {
        mockExecError('Application not found');

        await expect(launcher.launch('NonExistent')).rejects.toThrow('Failed to launch');
      });
    });

    describe('quit', () => {
      it('should quit an app via PowerShell Stop-Process', async () => {
        mockExecSuccess();

        const result = await launcher.quit('notepad');

        expect(result).toContain('Quit');
        const args = mockExecFile.mock.calls[0][1] as string[];
        const script = args[args.length - 1];
        expect(script).toContain('Stop-Process');
        expect(script).toContain('notepad');
      });

      it('should throw on quit failure', async () => {
        mockExecError('Process not found');

        await expect(launcher.quit('notepad')).rejects.toThrow('Failed to quit');
      });
    });

    describe('isRunning', () => {
      it('should return true when process is running', async () => {
        mockExecSuccess('true');

        const result = await launcher.isRunning('notepad');
        expect(result).toBe(true);
      });

      it('should return false when process is not running', async () => {
        mockExecSuccess('false');

        const result = await launcher.isRunning('notepad');
        expect(result).toBe(false);
      });

      it('should return false on error', async () => {
        mockExecError('Some error');

        const result = await launcher.isRunning('notepad');
        expect(result).toBe(false);
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

    it('should throw for launch on unsupported platform', async () => {
      await expect(launcher.launch('app')).rejects.toThrow('not implemented');
    });

    it('should throw for quit on unsupported platform', async () => {
      await expect(launcher.quit('app')).rejects.toThrow('not implemented');
    });

    it('should return false for isRunning on unsupported platform', async () => {
      const result = await launcher.isRunning('app');
      expect(result).toBe(false);
    });
  });
});
