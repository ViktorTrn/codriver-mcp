/**
 * ScreenCapture Module
 * Handles desktop and window screenshots using screenshot-desktop + sharp
 */

import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import type { ScreenshotOptions, ScreenshotResult } from '../types/index.js';

export class ScreenCapture {
  /**
   * Take a screenshot of the desktop or a specific window.
   * Uses screenshot-desktop for capture and sharp for processing.
   */
  async capture(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const { scale = 1.0, region } = options;

    // Capture full desktop as PNG buffer
    const buffer = await screenshot({ format: 'png' }) as Buffer;

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

    const outputBuffer = await image.png().toBuffer();
    const data = outputBuffer.toString('base64');

    return {
      data,
      mimeType: 'image/png',
      width,
      height,
    };
  }
}

export const screenCapture = new ScreenCapture();
