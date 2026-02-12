/**
 * WindowManager Module
 * Handles window enumeration, focus, and management.
 * macOS: CoreGraphics (listing) + AppleScript (focus).
 * CoreGraphics only needs Screen Recording permission (no Accessibility).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { WindowInfo } from '../types/index.js';

const execFileAsync = promisify(execFile);

export class WindowManager {
  /**
   * List all open windows with title, process name, position, and size.
   * Uses CoreGraphics on macOS (requires Screen Recording, NOT Accessibility).
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
    // Use Swift + CoreGraphics to list windows.
    // Only requires Screen Recording permission (not Accessibility).
    const swiftCode = `
import CoreGraphics
import Foundation
import AppKit

let options: CGWindowListOption = [.optionOnScreenOnly]
guard let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    print("[]")
    exit(0)
}

struct WindowEntry: Codable {
    let processName: String
    let title: String
    let x: Int
    let y: Int
    let width: Int
    let height: Int
    let isFocused: Bool
    let windowId: Int
}

var results: [WindowEntry] = []
let frontApp = NSWorkspace.shared.frontmostApplication?.localizedName ?? ""

for w in windowList {
    let owner = w["kCGWindowOwnerName"] as? String ?? ""
    let name = w["kCGWindowName"] as? String ?? ""
    let layer = w["kCGWindowLayer"] as? Int ?? -1
    let windowId = w["kCGWindowNumber"] as? Int ?? 0
    let bounds = w["kCGWindowBounds"] as? [String: Any] ?? [:]

    // Only include normal windows (layer 0) with a title
    if layer == 0 && !name.isEmpty {
        let entry = WindowEntry(
            processName: owner,
            title: name,
            x: bounds["X"] as? Int ?? 0,
            y: bounds["Y"] as? Int ?? 0,
            width: Int(bounds["Width"] as? Double ?? 0),
            height: Int(bounds["Height"] as? Double ?? 0),
            isFocused: owner == frontApp,
            windowId: windowId
        )
        results.append(entry)
    }
}

let encoder = JSONEncoder()
if let data = try? encoder.encode(results), let json = String(data: data, encoding: .utf8) {
    print(json)
}
`;

    try {
      const { stdout } = await execFileAsync('swift', ['-e', swiftCode], {
        timeout: 30000, // Swift compiler needs time on first run
      });

      const trimmed = stdout.trim();
      if (!trimmed || trimmed === '[]') return [];

      const entries = JSON.parse(trimmed) as Array<{
        processName: string;
        title: string;
        x: number;
        y: number;
        width: number;
        height: number;
        isFocused: boolean;
        windowId: number;
      }>;

      return entries.map((entry, index) => ({
        id: entry.windowId || index,
        processName: entry.processName,
        title: entry.title,
        x: entry.x,
        y: entry.y,
        width: entry.width,
        height: entry.height,
        isFocused: entry.isFocused,
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // Only match permission errors from macOS, not Swift source code in error output
      if (msg.includes('not permitted') || msg.includes('permission denied')) {
        throw new Error(
          'Screen Recording permission not granted. ' +
          'Go to System Settings > Privacy & Security > Screen Recording and enable your terminal app.'
        );
      }
      throw new Error(`Failed to list windows: ${msg}`);
    }
  }

  private async focusWindowMacOS(title: string): Promise<void> {
    // Focus still uses AppleScript (NSRunningApplication + AXUIElement).
    // Uses NSRunningApplication to activate the process (no Accessibility needed),
    // then osascript to raise the specific window (needs Accessibility).
    // Fallback: just activate the process if AXRaise fails.
    const escapedTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const script = `
      tell application "System Events"
        set allProcesses to every process whose visible is true
        repeat with proc in allProcesses
          try
            set allWindows to every window of proc
            repeat with win in allWindows
              try
                if name of win contains "${escapedTitle}" then
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

    try {
      const { stdout } = await execFileAsync('osascript', ['-e', script]);
      if (stdout.trim() === 'not found') {
        throw new Error(`Window with title containing "${title}" not found`);
      }
    } catch (error) {
      // Fallback: Try activating by process name using open command
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not allowed') || msg.includes('Berechtigung') || msg.includes('-25211')) {
        // Accessibility not available - try to activate by app name match
        await this.focusByProcessName(title);
      } else if (msg.includes('not found')) {
        throw error;
      } else {
        throw new Error(`Failed to focus window: ${msg}`);
      }
    }
  }

  /**
   * Fallback: activate app by process name when Accessibility is not available.
   */
  private async focusByProcessName(title: string): Promise<void> {
    const swiftCode = `
import AppKit
let apps = NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular }
let searchTerm = "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}".lowercased()
for app in apps {
    let name = app.localizedName?.lowercased() ?? ""
    if name.contains(searchTerm) {
        app.activate()
        print("focused")
        exit(0)
    }
}
print("not found")
`;

    const { stdout } = await execFileAsync('swift', ['-e', swiftCode], { timeout: 10000 });
    if (stdout.trim() === 'not found') {
      throw new Error(`No app matching "${title}" found. Accessibility permission may be needed for window-level focus.`);
    }
  }
}

export const windowManager = new WindowManager();
