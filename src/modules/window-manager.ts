/**
 * WindowManager Module
 * Handles window enumeration, focus, and management.
 * Uses platform-native commands (macOS: osascript/AppleScript).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { WindowInfo } from '../types/index.js';

const execFileAsync = promisify(execFile);

export class WindowManager {
  /**
   * List all open windows with title, process name, position, and size.
   * Uses AppleScript on macOS.
   */
  async listWindows(): Promise<WindowInfo[]> {
    if (process.platform !== 'darwin') {
      throw new Error(`Window listing not yet implemented for ${process.platform}. Currently macOS only.`);
    }

    return this.listWindowsMacOS();
  }

  /**
   * Focus a window by title (substring match) or window ID.
   */
  async focusWindow(titleOrId: string | number): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error(`Window focus not yet implemented for ${process.platform}. Currently macOS only.`);
    }

    await this.focusWindowMacOS(String(titleOrId));
  }

  // --- macOS Implementation ---

  private async listWindowsMacOS(): Promise<WindowInfo[]> {
    // AppleScript to list all windows with their properties
    const script = `
      set windowList to ""
      tell application "System Events"
        set allProcesses to every process whose visible is true
        repeat with proc in allProcesses
          set procName to name of proc
          try
            set allWindows to every window of proc
            repeat with win in allWindows
              try
                set winTitle to name of win
                set winPos to position of win
                set winSize to size of win
                set isFront to (frontmost of proc) as text
                set windowList to windowList & procName & "|||" & winTitle & "|||" & (item 1 of winPos) & "|||" & (item 2 of winPos) & "|||" & (item 1 of winSize) & "|||" & (item 2 of winSize) & "|||" & isFront & linefeed
              end try
            end repeat
          end try
        end repeat
      end tell
      return windowList
    `;

    const { stdout } = await execFileAsync('osascript', ['-e', script]);
    const lines = stdout.trim().split('\n').filter(Boolean);
    const windows: WindowInfo[] = [];

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split('|||');
      if (parts.length >= 7) {
        windows.push({
          id: i,
          processName: parts[0].trim(),
          title: parts[1].trim(),
          x: parseInt(parts[2], 10) || 0,
          y: parseInt(parts[3], 10) || 0,
          width: parseInt(parts[4], 10) || 0,
          height: parseInt(parts[5], 10) || 0,
          isFocused: parts[6].trim() === 'true',
        });
      }
    }

    return windows;
  }

  private async focusWindowMacOS(title: string): Promise<void> {
    // AppleScript to focus a window by title substring match
    const script = `
      tell application "System Events"
        set allProcesses to every process whose visible is true
        repeat with proc in allProcesses
          try
            set allWindows to every window of proc
            repeat with win in allWindows
              try
                if name of win contains "${title.replace(/"/g, '\\"')}" then
                  set frontmost of proc to true
                  perform action "AXRaise" of win
                  return "focused"
                end if
              end try
            end repeat
          end try
        end repeat
      end tell
      return "not found"
    `;

    const { stdout } = await execFileAsync('osascript', ['-e', script]);
    if (stdout.trim() === 'not found') {
      throw new Error(`Window with title containing "${title}" not found`);
    }
  }
}

export const windowManager = new WindowManager();
