import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock screenshot-desktop
vi.mock('screenshot-desktop', () => {
  // Create a minimal 1x1 PNG buffer
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  return { default: vi.fn(async () => pngBuffer) };
});

// Mock sharp
const mockSharpInstance = {
  metadata: vi.fn(async () => ({ width: 1920, height: 1080 })),
  extract: vi.fn().mockReturnThis(),
  resize: vi.fn().mockReturnThis(),
  png: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  toBuffer: vi.fn(async () =>
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
  ),
};

vi.mock('sharp', () => ({
  default: vi.fn(() => mockSharpInstance),
}));

import { ScreenCapture } from '../src/modules/screen-capture.js';

describe('ScreenCapture', () => {
  let capture: ScreenCapture;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chainable methods
    mockSharpInstance.extract.mockReturnThis();
    mockSharpInstance.resize.mockReturnThis();
    mockSharpInstance.png.mockReturnThis();
    mockSharpInstance.jpeg.mockReturnThis();
    capture = new ScreenCapture();
  });

  it('should capture a full desktop screenshot', async () => {
    const result = await capture.capture();

    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(typeof result.data).toBe('string');
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('should scale down screenshot', async () => {
    await capture.capture({ scale: 0.5 });

    expect(mockSharpInstance.resize).toHaveBeenCalledWith(960, 540);
  });

  it('should crop to region', async () => {
    await capture.capture({ region: [100, 200, 400, 300] });

    expect(mockSharpInstance.extract).toHaveBeenCalledWith({
      left: 100,
      top: 200,
      width: 400,
      height: 300,
    });
  });

  it('should return base64 encoded data', async () => {
    const result = await capture.capture();

    // Verify it's valid base64
    expect(() => Buffer.from(result.data, 'base64')).not.toThrow();
  });

  it('should not scale when scale is 1.0', async () => {
    await capture.capture({ scale: 1.0 });

    expect(mockSharpInstance.resize).not.toHaveBeenCalled();
  });

  it('should output JPEG when format is jpeg', async () => {
    const result = await capture.capture({ format: 'jpeg', quality: 60 });

    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 60 });
    expect(mockSharpInstance.png).not.toHaveBeenCalled();
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('should default to PNG format', async () => {
    const result = await capture.capture();

    expect(mockSharpInstance.png).toHaveBeenCalled();
    expect(mockSharpInstance.jpeg).not.toHaveBeenCalled();
    expect(result.mimeType).toBe('image/png');
  });
});
