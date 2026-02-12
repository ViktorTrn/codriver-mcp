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
import type { ScreenshotOptions, ScreenshotResult, DisplayInfo } from '../types/index.js';

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
 * Capture screenshot on Windows by calling the exe directly.
 */
function captureWindows(imgPath: string): Promise<void> {
  const exePath = ensureWindowsExe();
  return new Promise((resolve, reject) => {
    execFile(exePath, [imgPath], {
      cwd: join(tmpdir(), 'screenCapture'),
      windowsHide: true,
      timeout: 30000,
    }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export class ScreenCapture {
  /**
   * Take a screenshot of the desktop or a specific window.
   * Uses screenshot-desktop for capture and sharp for processing.
   */
  async capture(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const { scale = 1.0, region, format = 'png', quality = 80, screen: screenId } = options;

    let buffer: Buffer;

    if (process.platform === 'win32') {
      // Direct exe call - bypasses bat path resolution issues
      const imgPath = join(tmpdir(), `codriver_screenshot_${Date.now()}.png`);
      await captureWindows(imgPath);
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
   */
  async listDisplays(): Promise<DisplayInfo[]> {
    const displays = await screenshot.listDisplays();
    return displays.map((d) => ({ id: d.id, name: d.name }));
  }
}

export const screenCapture = new ScreenCapture();
