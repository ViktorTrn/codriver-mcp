import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock tesseract.js
vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn(async () => ({
      data: {
        text: '  Hello World  \n',
        confidence: 92.5,
      },
    })),
  },
}));

// Mock screen-capture module
vi.mock('../src/modules/screen-capture.js', () => ({
  screenCapture: {
    capture: vi.fn(async () => ({
      data: 'base64imagedata',
      mimeType: 'image/png',
      width: 800,
      height: 600,
    })),
  },
}));

import Tesseract from 'tesseract.js';
import { screenCapture } from '../src/modules/screen-capture.js';
import { OcrEngine } from '../src/modules/ocr-engine.js';

const mockRecognize = vi.mocked(Tesseract.recognize);
const mockCapture = vi.mocked(screenCapture.capture);

describe('OcrEngine', () => {
  let ocr: OcrEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    ocr = new OcrEngine();
  });

  it('should capture screenshot and run OCR', async () => {
    const result = await ocr.recognize();

    expect(mockCapture).toHaveBeenCalledWith({ region: undefined, format: 'png' });
    expect(mockRecognize).toHaveBeenCalled();
    expect(result.text).toBe('Hello World');
    expect(result.confidence).toBe(92.5);
  });

  it('should pass region to screenshot capture', async () => {
    await ocr.recognize({ region: [100, 200, 400, 300] });

    expect(mockCapture).toHaveBeenCalledWith({
      region: [100, 200, 400, 300],
      format: 'png',
    });
  });

  it('should pass language to tesseract', async () => {
    await ocr.recognize({ language: 'deu' });

    expect(mockRecognize).toHaveBeenCalledWith(expect.any(Buffer), 'deu');
  });

  it('should default to English language', async () => {
    await ocr.recognize();

    expect(mockRecognize).toHaveBeenCalledWith(expect.any(Buffer), 'eng');
  });

  it('should trim whitespace from OCR result', async () => {
    const result = await ocr.recognize();

    expect(result.text).toBe('Hello World');
    expect(result.text).not.toContain('\n');
  });
});
