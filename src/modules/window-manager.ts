/**
 * WindowManager Module
 * Handles window enumeration, focus, and management.
 * macOS: CoreGraphics (listing) + AppleScript (focus).
 * Windows: PowerShell + inline C# (Win32 P/Invoke).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { WindowInfo } from '../types/index.js';

const execFileAsync = promisify(execFile);

/** PowerShell flags for safe, non-interactive execution */
const PS_FLAGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command'];

/** Escape a string for use inside PowerShell single-quoted strings */
function escapePowerShell(str: string): string {
  return str.replace(/'/g, "''");
}

export class WindowManager {
  /**
   * List all open windows with title, process name, position, and size.
   */
  async listWindows(): Promise<WindowInfo[]> {
    if (process.platform === 'darwin') return this.listWindowsMacOS();
    if (process.platform === 'win32') return this.listWindowsWindows();
    throw new Error(`Window listing not implemented for ${process.platform}.`);
  }

  /**
   * Focus a window by title (substring match) or window ID.
   */
  async focusWindow(titleOrId: string | number): Promise<void> {
    if (process.platform === 'darwin') return this.focusWindowMacOS(String(titleOrId));
    if (process.platform === 'win32') return this.focusWindowWindows(String(titleOrId));
    throw new Error(`Window focus not implemented for ${process.platform}.`);
  }

  // --- macOS Implementation ---

  private async listWindowsMacOS(): Promise<WindowInfo[]> {
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
        timeout: 30000,
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
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not allowed') || msg.includes('Berechtigung') || msg.includes('-25211')) {
        await this.focusByProcessName(title);
      } else if (msg.includes('not found')) {
        throw error;
      } else {
        throw new Error(`Failed to focus window: ${msg}`);
      }
    }
  }

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

  // --- Windows Implementation ---

  private async listWindowsWindows(): Promise<WindowInfo[]> {
    // PowerShell + inline C# using P/Invoke for window enumeration
    const script = `
Add-Type @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class WindowEnum {
    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    static extern bool IsWindowVisible(IntPtr hWnd);

    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    struct RECT { public int Left, Top, Right, Bottom; }

    public static string ListWindows() {
        var results = new List<string>();
        IntPtr fg = GetForegroundWindow();

        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;

            var sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, sb.Capacity);
            string title = sb.ToString();
            if (string.IsNullOrEmpty(title)) return true;

            RECT rect;
            GetWindowRect(hWnd, out rect);

            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            string procName = "";
            try { procName = Process.GetProcessById((int)pid).ProcessName; } catch {}

            bool focused = hWnd == fg;
            int w = rect.Right - rect.Left;
            int h = rect.Bottom - rect.Top;

            results.Add(string.Format(
                "{{\\"processName\\":\\"{0}\\",\\"title\\":\\"{1}\\",\\"x\\":{2},\\"y\\":{3},\\"width\\":{4},\\"height\\":{5},\\"isFocused\\":{6},\\"windowId\\":{7}}}",
                procName.Replace("\\\\","\\\\\\\\").Replace("\\"","\\\\\\""),
                title.Replace("\\\\","\\\\\\\\").Replace("\\"","\\\\\\""),
                rect.Left, rect.Top, w, h,
                focused.ToString().ToLower(),
                (int)hWnd
            ));

            return true;
        }, IntPtr.Zero);

        return "[" + string.Join(",", results) + "]";
    }
}
'@
Write-Output ([WindowEnum]::ListWindows())
`;

    try {
      const { stdout } = await execFileAsync('powershell', [...PS_FLAGS, script], {
        timeout: 30000,
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
      throw new Error(`Failed to list windows: ${msg}`);
    }
  }

  private async focusWindowWindows(title: string): Promise<void> {
    const safe = escapePowerShell(title);

    const script = `
Add-Type @'
using System;
using System.Runtime.InteropServices;

public class WindowFocus {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public const int SW_RESTORE = 9;
}
'@

$proc = Get-Process | Where-Object { $_.MainWindowTitle -like '*${safe}*' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($proc) {
    [WindowFocus]::ShowWindow($proc.MainWindowHandle, [WindowFocus]::SW_RESTORE)
    [WindowFocus]::SetForegroundWindow($proc.MainWindowHandle)
    Write-Output 'focused'
} else {
    Write-Output 'not found'
}
`;

    try {
      const { stdout } = await execFileAsync('powershell', [...PS_FLAGS, script], {
        timeout: 10000,
      });

      if (stdout.trim() === 'not found') {
        throw new Error(`Window with title containing "${title}" not found`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to focus window: ${msg}`);
    }
  }
}

export const windowManager = new WindowManager();
