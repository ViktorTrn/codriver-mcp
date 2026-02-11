import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { AppLauncher } from '../src/modules/app-launcher.js';

const mockExecFile = vi.mocked(execFile);

function mockAppleScriptSuccess(stdout = '') {
  mockExecFile.mockImplementation((...args: unknown[]) => {
    const cb = args.find((a, i) => typeof a === 'function' && i >= 2) as
      | ((err: Error | null, result: { stdout: string; stderr: string }) => void)
      | undefined;
    if (cb) cb(null, { stdout, stderr: '' });
    return undefined as never;
  });
}

function mockAppleScriptError(message: string) {
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

  describe('launch', () => {
    it('should launch an app via AppleScript', async () => {
      mockAppleScriptSuccess();

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
      mockAppleScriptSuccess();

      await launcher.launch('Finder');

      const script = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
      expect(script[1]).toContain('activate');
    });

    it('should throw on launch failure', async () => {
      mockAppleScriptError('Application not found');

      await expect(launcher.launch('NonExistent')).rejects.toThrow('Failed to launch');
    });
  });

  describe('quit', () => {
    it('should quit an app via AppleScript', async () => {
      mockAppleScriptSuccess();

      const result = await launcher.quit('Safari');

      expect(result).toContain('Quit');
      const script = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
      expect(script[1]).toContain('quit');
    });

    it('should throw on quit failure', async () => {
      mockAppleScriptError('Not running');

      await expect(launcher.quit('Safari')).rejects.toThrow('Failed to quit');
    });
  });

  describe('isRunning', () => {
    it('should return true when app is running', async () => {
      mockAppleScriptSuccess('true');

      const result = await launcher.isRunning('Finder');
      expect(result).toBe(true);
    });

    it('should return false when app is not running', async () => {
      mockAppleScriptSuccess('false');

      const result = await launcher.isRunning('NonExistent');
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockAppleScriptError('Some error');

      const result = await launcher.isRunning('SomeApp');
      expect(result).toBe(false);
    });
  });

  describe('escaping', () => {
    it('should escape quotes in app names', async () => {
      mockAppleScriptSuccess();

      await launcher.launch('My "App"');

      const script = (mockExecFile.mock.calls[0] as unknown[])[1] as string[];
      expect(script[1]).toContain('My \\"App\\"');
    });
  });
});
