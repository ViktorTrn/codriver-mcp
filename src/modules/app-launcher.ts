/**
 * AppLauncher Module
 * Launch and quit macOS applications using AppleScript/osascript.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class AppLauncher {
  /**
   * Launch an application by name.
   */
  async launch(appName: string): Promise<string> {
    if (process.platform !== 'darwin') {
      throw new Error(`App launching not yet implemented for ${process.platform}. Currently macOS only.`);
    }

    const script = `tell application "${this.escapeAppleScript(appName)}" to activate`;

    try {
      await execFileAsync('osascript', ['-e', script], { timeout: 10000 });
      return `Launched: ${appName}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to launch "${appName}": ${msg}`);
    }
  }

  /**
   * Quit an application by name.
   */
  async quit(appName: string): Promise<string> {
    if (process.platform !== 'darwin') {
      throw new Error(`App quitting not yet implemented for ${process.platform}. Currently macOS only.`);
    }

    const script = `tell application "${this.escapeAppleScript(appName)}" to quit`;

    try {
      await execFileAsync('osascript', ['-e', script], { timeout: 10000 });
      return `Quit: ${appName}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to quit "${appName}": ${msg}`);
    }
  }

  /**
   * Check if an application is currently running.
   */
  async isRunning(appName: string): Promise<boolean> {
    if (process.platform !== 'darwin') return false;

    const script = `tell application "System Events" to (name of processes) contains "${this.escapeAppleScript(appName)}"`;

    try {
      const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 5000 });
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  private escapeAppleScript(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}

export const appLauncher = new AppLauncher();
