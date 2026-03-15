/**
 * OCR Engine Module
 * Text recognition using tesseract.js for apps without accessibility support.
 */

import Tesseract from 'tesseract.js';
import { screenCapture } from './screen-capture.js';
import type { Region, OcrResult } from '../types/index.js';

export class OcrEngine {
  /**
   * Extract text from a screen region using OCR.
   * Takes a screenshot of the region and runs Tesseract on it.
   */
  async recognize(options: { region?: Region; language?: string; screen?: number } = {}): Promise<OcrResult> {
    const { region, language = 'eng', screen } = options;

    // Capture screenshot (optionally cropped to region, from a specific display)
    const screenshot = await screenCapture.capture({ region, format: 'png', screen });
    const imageBuffer = Buffer.from(screenshot.data, 'base64');

    const result = await Tesseract.recognize(imageBuffer, language);

    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence,
    };
  }
}

export const ocrEngine = new OcrEngine();
