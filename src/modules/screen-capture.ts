/**
 * ScreenCapture Module
 * Handles desktop and window screenshots
 */

import type { ScreenshotOptions, ScreenshotResult } from '../types/index.js';

export class ScreenCapture {
  /**
   * Take a screenshot of the desktop or a specific window
   */
  async capture(_options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    // TODO: Implement with screenshot-desktop + sharp
    throw new Error('Not implemented - Phase 1 T1.2');
  }
}

export const screenCapture = new ScreenCapture();
