/**
 * ScreenCapture Module
 * Handles desktop and window screenshots using screenshot-desktop + sharp.
 * On Windows, calls the screenCapture exe directly to work around bat path issues.
 */

import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { windowManager } from './window-manager.js';
import type { ScreenshotOptions, ScreenshotResult, DisplayInfo, Region, Coordinate } from '../types/index.js';

const require = createRequire(import.meta.url);

/**
 * Ensure the screenCapture exe exists in temp on Windows.
 * screenshot-desktop ships a polyglot bat/C# file that self-compiles via .NET csc.exe.
 * We ensure compilation happened, then call the exe directly (bypassing bat path issues).
 */
function ensureWindowsExe(): string {
  const tmpDir = join(tmpdir(), 'screenCapture');
  const exePath = join(tmpDir, 'screenCapture_1.3.2.exe');

  if (existsSync(exePath)) return exePath;

  // Copy bat + manifest from screenshot-desktop to temp for self-compilation
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

  const pkgDir = dirname(require.resolve('screenshot-desktop'));
  const srcBat = join(pkgDir, 'lib', 'win32', 'screenCapture_1.3.2.bat');
  const srcManifest = join(pkgDir, 'lib', 'win32', 'app.manifest');

  const dstBat = join(tmpDir, 'screenCapture_1.3.2.bat');
  const dstManifest = join(tmpDir, 'app.manifest');

  if (!existsSync(dstBat)) writeFileSync(dstBat, readFileSync(srcBat));
  if (!existsSync(dstManifest)) writeFileSync(dstManifest, readFileSync(srcManifest));

  // Find .NET Framework csc.exe and compile the C# code directly
  const cscPaths = [
    join(process.env.SystemRoot ?? 'C:\\Windows', 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
    join(process.env.SystemRoot ?? 'C:\\Windows', 'Microsoft.NET', 'Framework', 'v3.5', 'csc.exe'),
  ];
  const csc = cscPaths.find(p => existsSync(p));
  if (csc) {
    execFileSync(csc, [
      '/nologo',
      '/r:Microsoft.VisualBasic.dll',
      `/win32manifest:${dstManifest}`,
      `/out:${exePath}`,
      dstBat,
    ], { cwd: tmpDir, windowsHide: true, stdio: 'ignore' });
  }

  return exePath;
}

/**
 * Run the screenCapture exe directly and return its stdout.
 */
function runWindowsExe(args: string[]): Promise<string> {
  const exePath = ensureWindowsExe();
  return new Promise((resolve, reject) => {
    execFile(exePath, args, {
      cwd: join(tmpdir(), 'screenCapture'),
      windowsHide: true,
      timeout: 30000,
    }, (err, stdout) => {
      if (err) reject(err);
      else resolve(String(stdout));
    });
  });
}

/**
 * Capture screenshot on Windows by calling the exe directly.
 * Without deviceName the exe captures the primary display.
 */
async function captureWindows(imgPath: string, deviceName?: string): Promise<void> {
  const args = deviceName ? [imgPath, '/d', deviceName] : [imgPath];
  const stdout = await runWindowsExe(args);
  // The exe silently falls back to the primary display if the device name does not match
  if (stdout.includes('Unable to capture image')) {
    throw new Error(`Failed to capture display ${deviceName}`);
  }
}

/** Monitor as reported by `screenCapture.exe /list` (virtual desktop coordinates) */
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
  const stdout = await runWindowsExe(['/list']);
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
      // Direct exe call - bypasses bat path resolution issues
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
