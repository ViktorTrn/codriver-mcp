/**
 * InputController Module
 * Mouse: Swift/CGEvent on macOS (robotjs moveMouse broken on Sequoia), robotjs on Windows
 * Keyboard: robotjs (cross-platform)
 */

import robot from '@jitsi/robotjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ClickOptions, TypeOptions, KeyOptions, ScrollOptions, DragOptions } from '../types/index.js';

const execFileAsync = promisify(execFile);

// Map user-friendly key names to robotjs key names
const KEY_MAP: Record<string, string> = {
  // Modifiers (used in combinations like "ctrl+c")
  ctrl: 'control',
  cmd: 'command',
  win: 'command',
  meta: 'command',
  alt: 'alt',
  shift: 'shift',

  // Navigation
  enter: 'enter',
  return: 'enter',
  tab: 'tab',
  escape: 'escape',
  esc: 'escape',
  space: 'space',
  backspace: 'backspace',
  delete: 'delete',
  del: 'delete',

  // Arrow keys
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',

  // Page navigation
  home: 'home',
  end: 'end',
  pageup: 'pageup',
  pagedown: 'pagedown',

  // Function keys
  f1: 'f1', f2: 'f2', f3: 'f3', f4: 'f4',
  f5: 'f5', f6: 'f6', f7: 'f7', f8: 'f8',
  f9: 'f9', f10: 'f10', f11: 'f11', f12: 'f12',

  // Special
  printscreen: 'printscreen',
  insert: 'insert',
  capslock: 'capslock',
  numlock: 'numlock',
};

// Modifier keys that robotjs treats as modifiers in keyTap
const MODIFIER_KEYS = new Set(['control', 'command', 'alt', 'shift']);

/**
 * Resolve a user-friendly key name to robotjs key name.
 */
function resolveKey(name: string): string {
  const lower = name.toLowerCase().trim();
  return KEY_MAP[lower] ?? lower;
}

/**
 * Execute a Swift snippet for mouse operations.
 * Uses CGEvent API which works reliably on macOS Sequoia.
 */
async function swiftMouse(code: string): Promise<string> {
  const script = `import CoreGraphics\n${code}`;
  const { stdout } = await execFileAsync('swift', ['-e', script], { timeout: 10000 });
  return stdout.trim();
}

export class InputController {
  /**
   * Click at a screen coordinate.
   * Uses Swift/CGEvent for reliable mouse control on macOS Sequoia.
   */
  async click(options: ClickOptions): Promise<void> {
    const { coordinate, button = 'left', doubleClick = false } = options;
    const [x, y] = coordinate;

    if (process.platform === 'darwin') {
      await this.clickMacOS(x, y, button, doubleClick);
    } else {
      robot.moveMouse(x, y);
      if (doubleClick) {
        robot.mouseClick(button, true);
      } else {
        robot.mouseClick(button);
      }
    }
  }

  /**
   * Type text at the current cursor position
   */
  async type(options: TypeOptions): Promise<void> {
    const { text, slowly = false } = options;

    if (slowly) {
      for (const char of text) {
        robot.typeString(char);
        await sleep(50);
      }
    } else {
      robot.typeString(text);
    }
  }

  /**
   * Press a key or key combination (e.g. "ctrl+c", "enter", "alt+tab")
   */
  async key(options: KeyOptions): Promise<void> {
    const { key, repeat = 1 } = options;

    const parts = key.split('+').map((p) => resolveKey(p));
    const modifiers: string[] = [];
    let mainKey = '';

    for (const part of parts) {
      if (MODIFIER_KEYS.has(part)) {
        modifiers.push(part);
      } else {
        mainKey = part;
      }
    }

    if (!mainKey && modifiers.length > 0) {
      mainKey = modifiers.pop()!;
    }

    for (let i = 0; i < repeat; i++) {
      if (modifiers.length > 0) {
        robot.keyTap(mainKey, modifiers);
      } else {
        robot.keyTap(mainKey);
      }

      if (repeat > 1 && i < repeat - 1) {
        await sleep(50);
      }
    }
  }

  /**
   * Drag from one coordinate to another.
   * Uses Swift/CGEvent on macOS.
   */
  async drag(options: DragOptions): Promise<void> {
    const { startCoordinate, endCoordinate } = options;
    const [sx, sy] = startCoordinate;
    const [ex, ey] = endCoordinate;

    if (process.platform === 'darwin') {
      await this.dragMacOS(sx, sy, ex, ey);
    } else {
      robot.moveMouse(sx, sy);
      robot.mouseToggle('down');
      robot.dragMouse(ex, ey);
      robot.mouseToggle('up');
    }
  }

  /**
   * Scroll at a screen position.
   * Uses Swift/CGEvent on macOS for mouse positioning.
   */
  async scroll(options: ScrollOptions): Promise<void> {
    const { coordinate, direction, amount = 3 } = options;
    const [x, y] = coordinate;

    if (process.platform === 'darwin') {
      await this.scrollMacOS(x, y, direction, amount);
    } else {
      robot.moveMouse(x, y);
      switch (direction) {
        case 'up': robot.scrollMouse(0, amount); break;
        case 'down': robot.scrollMouse(0, -amount); break;
        case 'left': robot.scrollMouse(-amount, 0); break;
        case 'right': robot.scrollMouse(amount, 0); break;
      }
    }
  }

  // --- macOS Swift/CGEvent implementations ---

  private async clickMacOS(x: number, y: number, button: string, doubleClick: boolean): Promise<void> {
    const mouseButton = button === 'right' ? '.right' : button === 'middle' ? '.center' : '.left';
    const downType = button === 'right' ? '.rightMouseDown' : '.leftMouseDown';
    const upType = button === 'right' ? '.rightMouseUp' : '.leftMouseUp';
    const point = `CGPoint(x: ${x}, y: ${y})`;

    let code = `
CGWarpMouseCursorPosition(${point})
// Small delay for cursor to settle
usleep(10000)
let down = CGEvent(mouseEventSource: nil, mouseType: ${downType}, mouseCursorPosition: ${point}, mouseButton: ${mouseButton})
let up = CGEvent(mouseEventSource: nil, mouseType: ${upType}, mouseCursorPosition: ${point}, mouseButton: ${mouseButton})
down?.post(tap: .cghidEventTap)
up?.post(tap: .cghidEventTap)
`;

    if (doubleClick) {
      code += `
usleep(50000)
let down2 = CGEvent(mouseEventSource: nil, mouseType: ${downType}, mouseCursorPosition: ${point}, mouseButton: ${mouseButton})
let up2 = CGEvent(mouseEventSource: nil, mouseType: ${upType}, mouseCursorPosition: ${point}, mouseButton: ${mouseButton})
down2?.setIntegerValueField(.mouseEventClickState, value: 2)
up2?.setIntegerValueField(.mouseEventClickState, value: 2)
down2?.post(tap: .cghidEventTap)
up2?.post(tap: .cghidEventTap)
`;
    }

    await swiftMouse(code);
  }

  private async dragMacOS(sx: number, sy: number, ex: number, ey: number): Promise<void> {
    const code = `
let startPoint = CGPoint(x: ${sx}, y: ${sy})
let endPoint = CGPoint(x: ${ex}, y: ${ey})

CGWarpMouseCursorPosition(startPoint)
usleep(50000)

let mouseDown = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: startPoint, mouseButton: .left)
mouseDown?.post(tap: .cghidEventTap)
usleep(50000)

// Smooth drag in steps
let steps = 20
for i in 1...steps {
    let progress = Double(i) / Double(steps)
    let currentX = Double(startPoint.x) + (Double(endPoint.x) - Double(startPoint.x)) * progress
    let currentY = Double(startPoint.y) + (Double(endPoint.y) - Double(startPoint.y)) * progress
    let currentPoint = CGPoint(x: currentX, y: currentY)
    let drag = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged, mouseCursorPosition: currentPoint, mouseButton: .left)
    drag?.post(tap: .cghidEventTap)
    usleep(10000)
}

let mouseUp = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: endPoint, mouseButton: .left)
mouseUp?.post(tap: .cghidEventTap)
`;

    await swiftMouse(code);
  }

  private async scrollMacOS(x: number, y: number, direction: string, amount: number): Promise<void> {
    let dy = 0;
    let dx = 0;
    switch (direction) {
      case 'up': dy = amount; break;
      case 'down': dy = -amount; break;
      case 'left': dx = -amount; break;
      case 'right': dx = amount; break;
    }

    const code = `
CGWarpMouseCursorPosition(CGPoint(x: ${x}, y: ${y}))
usleep(10000)
let scrollEvent = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 2, wheel1: Int32(${dy}), wheel2: Int32(${dx}), wheel3: 0)
scrollEvent?.post(tap: CGEventTapLocation.cghidEventTap)
`;

    await swiftMouse(code);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const inputController = new InputController();
