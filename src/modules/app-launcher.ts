/**
 * AppLauncher Module
 * macOS: AppleScript/osascript
 * Windows: PowerShell (Start-Process, Stop-Process, Get-Process)
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** PowerShell flags for safe, non-interactive execution */
const PS_FLAGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command'];

/** Escape a string for use inside PowerShell single-quoted strings */
function escapePowerShell(str: string): string {
  return str.replace(/'/g, "''");
}

export class AppLauncher {
  /**
   * Launch an application by name.
   */
  async launch(appName: string): Promise<string> {
    if (process.platform === 'darwin') return this.launchMacOS(appName);
    if (process.platform === 'win32') return this.launchWindows(appName);
    throw new Error(`App launching not implemented for ${process.platform}.`);
  }

  /**
   * Quit an application by name.
   */
  async quit(appName: string): Promise<string> {
    if (process.platform === 'darwin') return this.quitMacOS(appName);
    if (process.platform === 'win32') return this.quitWindows(appName);
    throw new Error(`App quitting not implemented for ${process.platform}.`);
  }

  /**
   * Check if an application is currently running.
   */
  async isRunning(appName: string): Promise<boolean> {
    if (process.platform === 'darwin') return this.isRunningMacOS(appName);
    if (process.platform === 'win32') return this.isRunningWindows(appName);
    return false;
  }

  // --- macOS Implementation ---

  private async launchMacOS(appName: string): Promise<string> {
    const script = `tell application "${this.escapeAppleScript(appName)}" to activate`;
    try {
      await execFileAsync('osascript', ['-e', script], { timeout: 10000 });
      return `Launched: ${appName}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to launch "${appName}": ${msg}`);
    }
  }

  private async quitMacOS(appName: string): Promise<string> {
    const script = `tell application "${this.escapeAppleScript(appName)}" to quit`;
    try {
      await execFileAsync('osascript', ['-e', script], { timeout: 10000 });
      return `Quit: ${appName}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to quit "${appName}": ${msg}`);
    }
  }

  private async isRunningMacOS(appName: string): Promise<boolean> {
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

  // --- Windows Implementation ---

  private async launchWindows(appName: string): Promise<string> {
    const safe = escapePowerShell(appName);
    // Try Start-Process first, then fallback to Start Menu shortcut search
    const script = `
try {
  Start-Process '${safe}'
  Write-Output 'ok'
} catch {
  $shortcut = Get-ChildItem "$env:ProgramData\\Microsoft\\Windows\\Start Menu" -Recurse -Filter '*.lnk' | Where-Object { $_.BaseName -like '*${safe}*' } | Select-Object -First 1
  if ($shortcut) {
    Start-Process $shortcut.FullName
    Write-Output 'ok'
  } else {
    throw "Application '${safe}' not found"
  }
}`;

    try {
      await execFileAsync('powershell', [...PS_FLAGS, script], { timeout: 15000 });
      return `Launched: ${appName}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to launch "${appName}": ${msg}`);
    }
  }

  private async quitWindows(appName: string): Promise<string> {
    const safe = escapePowerShell(appName);
    const script = `Stop-Process -Name '${safe}' -ErrorAction Stop`;

    try {
      await execFileAsync('powershell', [...PS_FLAGS, script], { timeout: 10000 });
      return `Quit: ${appName}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to quit "${appName}": ${msg}`);
    }
  }

  private async isRunningWindows(appName: string): Promise<boolean> {
    const safe = escapePowerShell(appName);
    const script = `if (Get-Process -Name '${safe}' -ErrorAction SilentlyContinue) { Write-Output 'true' } else { Write-Output 'false' }`;

    try {
      const { stdout } = await execFileAsync('powershell', [...PS_FLAGS, script], { timeout: 5000 });
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }
}

export const appLauncher = new AppLauncher();
