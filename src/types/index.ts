/**
 * CoDriver MCP - Shared Type Definitions
 */

/** Coordinate on screen [x, y] */
export type Coordinate = [number, number];

/** Region on screen [x, y, width, height] */
export type Region = [number, number, number, number];

/** Mouse button types */
export type MouseButton = 'left' | 'right' | 'middle';

/** Scroll direction */
export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

/** Window information */
export interface WindowInfo {
  id: number;
  title: string;
  processName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isFocused: boolean;
}

/** Screenshot options */
export interface ScreenshotOptions {
  windowTitle?: string;
  region?: Region;
  scale?: number;
  format?: 'png' | 'jpeg';
  quality?: number;
  screen?: number;
}

/** Screenshot result */
export interface ScreenshotResult {
  data: string; // base64
  mimeType: string;
  width: number;
  height: number;
}

/** Click options */
export interface ClickOptions {
  coordinate: Coordinate;
  button?: MouseButton;
  doubleClick?: boolean;
}

/** Type options */
export interface TypeOptions {
  text: string;
  slowly?: boolean;
}

/** Key press options */
export interface KeyOptions {
  key: string;
  repeat?: number;
}

/** Scroll options */
export interface ScrollOptions {
  coordinate: Coordinate;
  direction: ScrollDirection;
  amount?: number;
}

/** Drag options */
export interface DragOptions {
  startCoordinate: Coordinate;
  endCoordinate: Coordinate;
}

/** Display info for multi-monitor */
export interface DisplayInfo {
  id: number;
  name: string;
}

/** OCR result */
export interface OcrResult {
  text: string;
  confidence: number;
}

/** UI Element from accessibility tree */
export interface UIElement {
  ref: string;
  role: string;
  name: string;
  description?: string;
  value?: string;
  enabled?: boolean;
  bounds: Region;
  children?: UIElement[];
}

/** Options for reading the accessibility tree */
export interface ReadUIOptions {
  windowTitle?: string;
  depth?: number;
  filter?: 'interactive' | 'all';
}

/** Click options with optional ref */
export interface ClickWithRefOptions extends ClickOptions {
  ref?: string;
}

/** Type options with optional ref */
export interface TypeWithRefOptions extends TypeOptions {
  ref?: string;
}

/** Raw UI element before ref assignment (from JXA on macOS, UIA on Windows) */
export interface RawUIElement {
  role: string | null;
  title: string | null;
  description: string | null;
  value: string | null;
  enabled: boolean | null;
  position: [number, number] | null;
  size: [number, number] | null;
  children: RawUIElement[];
}
