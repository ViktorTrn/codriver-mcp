/**
 * ScreenCapture Module
 * Handles desktop and window screenshots using screenshot-desktop (macOS) + sharp.
 * On Windows, captures via PowerShell + GDI instead: screenshot-desktop's screenCapture bat
 * is quarantined by antivirus software (ThreatDown/Malwarebytes: RiskWare.ScreenCapture).
 */

import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import { readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { windowManager } from './window-manager.js';
import { PS_FLAGS, PS_UTF8_OUTPUT, escapePowerShell } from './powershell.js';
import type { ScreenshotOptions, ScreenshotResult, DisplayInfo, Region, Coordinate } from '../types/index.js';

/**
 * Monitor enumeration and capture in C# 5 (Windows PowerShell 5.1 Add-Type).
 * Mirrors screenshot-desktop's screenCapture.exe: per-monitor DPI aware (manifest True/PM),
 * so bounds are physical pixels matching the input coordinates, and the same `/list` format.
 */
const SCREEN_TYPE = `
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.Runtime.InteropServices;

public static class CoDriverScreen {
    [DllImport("user32.dll")]
    static extern IntPtr SetThreadDpiAwarenessContext(IntPtr dpiContext);

    [DllImport("user32.dll")]
    static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprcClip, MonitorEnumProc lpfnEnum, IntPtr dwData);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFOEX lpmi);

    [DllImport("shcore.dll")]
    static extern int GetDpiForMonitor(IntPtr hMonitor, int dpiType, out uint dpiX, out uint dpiY);

    delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData);

    [StructLayout(LayoutKind.Sequential)]
    struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct MONITORINFOEX {
        public int Size;
        public RECT Monitor;
        public RECT Work;
        public uint Flags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string DeviceName;
    }

    const uint MONITORINFOF_PRIMARY = 1;

    class Monitor {
        public string Name;
        public RECT Bounds;
        public bool Primary;
        public float DpiScale;
    }

    static void BecomeDpiAware() {
        try {
            // PER_MONITOR_AWARE_V2 (Win10 1703+), then PER_MONITOR_AWARE (Win10 1607+)
            if (SetThreadDpiAwarenessContext(new IntPtr(-4)) != IntPtr.Zero) return;
            if (SetThreadDpiAwarenessContext(new IntPtr(-3)) != IntPtr.Zero) return;
        } catch (EntryPointNotFoundException) { }
        SetProcessDPIAware();
    }

    static List<Monitor> GetMonitors() {
        var monitors = new List<Monitor>();
        EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr hMonitor, IntPtr hdc, ref RECT rc, IntPtr data) => {
            var mi = new MONITORINFOEX();
            mi.Size = Marshal.SizeOf(typeof(MONITORINFOEX));
            if (!GetMonitorInfo(hMonitor, ref mi)) return true;
            uint dpiX = 96, dpiY = 96;
            try { GetDpiForMonitor(hMonitor, 0, out dpiX, out dpiY); } catch (DllNotFoundException) { }
            monitors.Add(new Monitor {
                Name = mi.DeviceName,
                Bounds = mi.Monitor,
                Primary = (mi.Flags & MONITORINFOF_PRIMARY) != 0,
                DpiScale = dpiX / 96f,
            });
            return true;
        }, IntPtr.Zero);
        return monitors;
    }

    // Lines: name;top;right;bottom;left;dpiScale
    public static string List() {
        BecomeDpiAware();
        var lines = new List<string>();
        foreach (var m in GetMonitors()) {
            lines.Add(string.Format(CultureInfo.InvariantCulture, "{0};{1};{2};{3};{4};{5}",
                m.Name, m.Bounds.Top, m.Bounds.Right, m.Bounds.Bottom, m.Bounds.Left, m.DpiScale));
        }
        return string.Join("\\n", lines);
    }

    // Capture one monitor (primary if deviceName is empty) to a PNG file; false if not found
    public static bool Capture(string path, string deviceName) {
        BecomeDpiAware();
        Monitor target = null;
        foreach (var m in GetMonitors()) {
            bool match = deviceName.Length == 0
                ? m.Primary
                : string.Equals(m.Name, deviceName, StringComparison.OrdinalIgnoreCase);
            if (match) { target = m; break; }
        }
        if (target == null) return false;

        int width = target.Bounds.Right - target.Bounds.Left;
        int height = target.Bounds.Bottom - target.Bounds.Top;
        using (var bmp = new Bitmap(width, height, PixelFormat.Format32bppRgb))
        using (var g = Graphics.FromImage(bmp)) {
            g.CopyFromScreen(target.Bounds.Left, target.Bounds.Top, 0, 0, new Size(width, height));
            bmp.Save(path, ImageFormat.Png);
        }
        return true;
    }
}
'@
`;

/**
 * Run a call against the CoDriverScreen type in a hidden PowerShell and return its stdout.
 */
function runScreenScript(call: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('powershell', [...PS_FLAGS, PS_UTF8_OUTPUT + SCREEN_TYPE + call], {
      windowsHide: true,
      timeout: 30000,
    }, (err, stdout) => {
      if (err) reject(err);
      else resolve(String(stdout));
    });
  });
}

/**
 * Capture one display on Windows to a PNG file.
 * Without deviceName the primary display is captured.
 */
async function captureWindows(imgPath: string, deviceName?: string): Promise<void> {
  const stdout = await runScreenScript(
    `if (-not [CoDriverScreen]::Capture('${escapePowerShell(imgPath)}', '${escapePowerShell(deviceName ?? '')}')) ` +
    `{ Write-Output 'Unable to capture image' }`
  );
  // A display can disappear between listing and capturing
  if (stdout.includes('Unable to capture image')) {
    throw new Error(`Failed to capture display ${deviceName}`);
  }
}

/** Monitor in virtual desktop coordinates (physical pixels) */
interface WindowsMonitor {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * List monitors on Windows. Output lines: `\\.\DISPLAY1;top;right;bottom;left;dpiScale`.
 */
async function listWindowsMonitors(): Promise<WindowsMonitor[]> {
  const stdout = await runScreenScript('Write-Output ([CoDriverScreen]::List())');
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(';'))
    .filter((parts) => parts.length >= 5 && parts[0].startsWith('\\\\.\\'))
    .map(([name, top, right, bottom, left]) => ({
      name: name!,
      x: Number(left),
      y: Number(top),
      width: Number(right) - Number(left),
      height: Number(bottom) - Number(top),
    }));
}

/** Intersection of two rectangles, or null if they do not overlap */
function intersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

export class ScreenCapture {
  /**
   * Take a screenshot of the desktop or a specific window.
   * Uses screenshot-desktop for capture and sharp for processing.
   */
  async capture(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const { scale = 1.0, format = 'png', quality = 80, screen: screenId, windowTitle } = options;
    let region = options.region;

    let buffer: Buffer;

    if (process.platform === 'win32') {
      let deviceName: string | undefined;
      if (windowTitle != null) {
        // Capture the monitor holding (most of) the window, then crop to the window
        const { monitor, crop } = await this.locateWindowWindows(windowTitle);
        deviceName = monitor.name;
        region = region
          ? [crop[0] + region[0], crop[1] + region[1], region[2], region[3]]
          : crop;
      } else if (screenId != null) {
        const monitors = await listWindowsMonitors();
        const monitor = monitors[screenId];
        if (!monitor) {
          throw new Error(`Display ${screenId} not found. Use desktop_displays to list available monitors.`);
        }
        deviceName = monitor.name;
      }

      const imgPath = join(tmpdir(), `codriver_screenshot_${Date.now()}.png`);
      await captureWindows(imgPath, deviceName);
      buffer = readFileSync(imgPath);
      unlinkSync(imgPath);
    } else {
      const captureOpts: { format: 'png'; screen?: number } = { format: 'png' };
      if (screenId != null) captureOpts.screen = screenId;
      buffer = await screenshot(captureOpts) as Buffer;
    }

    let image = sharp(buffer);
    const metadata = await image.metadata();
    let width = metadata.width ?? 0;
    let height = metadata.height ?? 0;

    // Crop to region if specified [x, y, width, height]
    if (region) {
      const [rx, ry, rw, rh] = region;
      image = image.extract({ left: rx, top: ry, width: rw, height: rh });
      width = rw;
      height = rh;
    }

    // Scale down if requested
    if (scale < 1.0) {
      const newWidth = Math.round(width * scale);
      const newHeight = Math.round(height * scale);
      image = image.resize(newWidth, newHeight);
      width = newWidth;
      height = newHeight;
    }

    // Output format: PNG (lossless) or JPEG (compressed, smaller for remote)
    let outputBuffer: Buffer;
    let mimeType: string;
    if (format === 'jpeg') {
      outputBuffer = await image.jpeg({ quality }).toBuffer();
      mimeType = 'image/jpeg';
    } else {
      outputBuffer = await image.png().toBuffer();
      mimeType = 'image/png';
    }

    const data = outputBuffer.toString('base64');

    return {
      data,
      mimeType,
      width,
      height,
    };
  }

  /**
   * List all available displays/monitors.
   * On Windows the id is the index to pass as desktop_screenshot's screen parameter.
   */
  async listDisplays(): Promise<DisplayInfo[]> {
    if (process.platform === 'win32') {
      const monitors = await listWindowsMonitors();
      return monitors.map((m, index) => ({
        id: index,
        name: m.name,
        x: m.x,
        y: m.y,
        width: m.width,
        height: m.height,
      }));
    }
    const displays = await screenshot.listDisplays();
    return displays.map((d) => ({ id: d.id, name: d.name }));
  }

  /**
   * Convert a coordinate relative to a display (as in a full-size desktop_screenshot of that
   * screen) into virtual desktop coordinates for input injection.
   * Rejects points outside the display so a wrong guess never lands on a neighbouring monitor.
   */
  async toDesktopCoordinate(screenId: number, [x, y]: Coordinate): Promise<Coordinate> {
    if (process.platform !== 'win32') {
      throw new Error('Screen-relative coordinates are only supported on Windows.');
    }
    const monitor = (await listWindowsMonitors())[screenId];
    if (!monitor) {
      throw new Error(`Display ${screenId} not found. Use desktop_displays to list available monitors.`);
    }
    if (x < 0 || y < 0 || x >= monitor.width || y >= monitor.height) {
      throw new Error(
        `Coordinate (${x}, ${y}) is outside display ${screenId} (${monitor.width}x${monitor.height}).`
      );
    }
    return [monitor.x + x, monitor.y + y];
  }

  /**
   * Find a window by title (case-insensitive substring) and the monitor showing most of it.
   * Returns the crop region relative to that monitor's top-left corner.
   */
  private async locateWindowWindows(
    windowTitle: string,
  ): Promise<{ monitor: WindowsMonitor; crop: Region }> {
    const needle = windowTitle.toLowerCase();
    const matches = (await windowManager.listWindows())
      .filter((w) => w.title.toLowerCase().includes(needle));
    if (matches.length === 0) {
      throw new Error(`Window with title containing "${windowTitle}" not found`);
    }

    const monitors = await listWindowsMonitors();
    for (const win of matches) {
      // Pick the monitor with the largest overlap; minimized windows (-32000) overlap none
      let best: { monitor: WindowsMonitor; area: { x: number; y: number; width: number; height: number } } | null = null;
      for (const monitor of monitors) {
        const area = intersect(win, monitor);
        if (area && (!best || area.width * area.height > best.area.width * best.area.height)) {
          best = { monitor, area };
        }
      }
      if (best) {
        const { monitor, area } = best;
        return {
          monitor,
          crop: [area.x - monitor.x, area.y - monitor.y, area.width, area.height],
        };
      }
    }
    throw new Error(`Window "${matches[0]!.title}" is not visible on any display (minimized?)`);
  }
}

export const screenCapture = new ScreenCapture();
