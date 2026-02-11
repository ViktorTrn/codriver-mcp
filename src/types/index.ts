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

/** UI Element reference (Phase 2) */
export interface UIElement {
  ref: string;
  role: string;
  name: string;
  value?: string;
  bounds: Region;
  children?: UIElement[];
}
