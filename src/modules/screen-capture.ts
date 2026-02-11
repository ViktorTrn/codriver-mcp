/**
 * ScreenCapture Module
 * Handles desktop and window screenshots using screenshot-desktop + sharp
 */

import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import type { ScreenshotOptions, ScreenshotResult, DisplayInfo } from '../types/index.js';

export class ScreenCapture {
  /**
   * Take a screenshot of the desktop or a specific window.
   * Uses screenshot-desktop for capture and sharp for processing.
   */
  async capture(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const { scale = 1.0, region, format = 'png', quality = 80, screen: screenId } = options;

    // Capture desktop (optionally specific screen) as PNG buffer
    const captureOpts: { format: 'png'; screen?: number } = { format: 'png' };
    if (screenId != null) captureOpts.screen = screenId;
    const buffer = await screenshot(captureOpts) as Buffer;

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
