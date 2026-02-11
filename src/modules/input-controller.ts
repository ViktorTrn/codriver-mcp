/**
 * InputController Module
 * Handles mouse and keyboard input injection using @jitsi/robotjs
 */

import * as robot from '@jitsi/robotjs';
import type { ClickOptions, TypeOptions, KeyOptions, ScrollOptions } from '../types/index.js';

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
 * Handles single characters, mapped names, and passthrough.
 */
function resolveKey(name: string): string {
  const lower = name.toLowerCase().trim();
  return KEY_MAP[lower] ?? lower;
}

export class InputController {
  /**
   * Click at a screen coordinate
   */
  async click(options: ClickOptions): Promise<void> {
    const { coordinate, button = 'left', doubleClick = false } = options;
    const [x, y] = coordinate;

    robot.moveMouse(x, y);

    if (doubleClick) {
      robot.mouseClick(button, true);
    } else {
      robot.mouseClick(button);
    }
  }

  /**
   * Type text at the current cursor position
   */
  async type(options: TypeOptions): Promise<void> {
    const { text, slowly = false } = options;

    if (slowly) {
      // Type one character at a time with a small delay
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

    // Parse key combination: "ctrl+shift+s" → modifiers=["control","shift"], key="s"
    const parts = key.split('+').map((p) => resolveKey(p));

    // Separate modifiers from the main key
    const modifiers: string[] = [];
    let mainKey = '';

    for (const part of parts) {
      if (MODIFIER_KEYS.has(part)) {
        modifiers.push(part);
      } else {
        mainKey = part;
      }
    }

    // If no main key found (e.g. just "ctrl"), use the last modifier as main key
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
   * Scroll at a screen position
   */
  async scroll(options: ScrollOptions): Promise<void> {
    const { coordinate, direction, amount = 3 } = options;
    const [x, y] = coordinate;

    // Move mouse to position first
    robot.moveMouse(x, y);

    // robotjs scrollMouse(x, y) where positive y = up, negative y = down
    switch (direction) {
      case 'up':
        robot.scrollMouse(0, amount);
        break;
      case 'down':
        robot.scrollMouse(0, -amount);
        break;
      case 'left':
        robot.scrollMouse(-amount, 0);
        break;
      case 'right':
        robot.scrollMouse(amount, 0);
        break;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const inputController = new InputController();
