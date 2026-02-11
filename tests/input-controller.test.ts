import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @jitsi/robotjs
vi.mock('@jitsi/robotjs', () => ({
  moveMouse: vi.fn(),
  mouseClick: vi.fn(),
  typeString: vi.fn(),
  keyTap: vi.fn(),
  scrollMouse: vi.fn(),
  getMousePos: vi.fn(() => ({ x: 0, y: 0 })),
}));

import * as robot from '@jitsi/robotjs';
import { InputController } from '../src/modules/input-controller.js';

describe('InputController', () => {
  let controller: InputController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new InputController();
  });

  describe('click', () => {
    it('should move mouse and click left button', async () => {
      await controller.click({ coordinate: [100, 200] });

      expect(robot.moveMouse).toHaveBeenCalledWith(100, 200);
      expect(robot.mouseClick).toHaveBeenCalledWith('left');
    });

    it('should handle right-click', async () => {
      await controller.click({ coordinate: [50, 75], button: 'right' });

      expect(robot.moveMouse).toHaveBeenCalledWith(50, 75);
      expect(robot.mouseClick).toHaveBeenCalledWith('right');
    });

    it('should handle double-click', async () => {
      await controller.click({ coordinate: [300, 400], doubleClick: true });

      expect(robot.moveMouse).toHaveBeenCalledWith(300, 400);
      expect(robot.mouseClick).toHaveBeenCalledWith('left', true);
    });
  });

  describe('type', () => {
    it('should type text at once', async () => {
      await controller.type({ text: 'Hello World' });

      expect(robot.typeString).toHaveBeenCalledWith('Hello World');
    });

    it('should type text slowly (char by char)', async () => {
      await controller.type({ text: 'Hi', slowly: true });

      expect(robot.typeString).toHaveBeenCalledTimes(2);
      expect(robot.typeString).toHaveBeenCalledWith('H');
      expect(robot.typeString).toHaveBeenCalledWith('i');
    });
  });

  describe('key', () => {
    it('should press a single key', async () => {
      await controller.key({ key: 'enter' });

      expect(robot.keyTap).toHaveBeenCalledWith('enter');
    });

    it('should handle ctrl+c combination', async () => {
      await controller.key({ key: 'ctrl+c' });

      expect(robot.keyTap).toHaveBeenCalledWith('c', ['control']);
    });

    it('should handle ctrl+shift+s combination', async () => {
      await controller.key({ key: 'ctrl+shift+s' });

      expect(robot.keyTap).toHaveBeenCalledWith('s', ['control', 'shift']);
    });

    it('should handle cmd+a on macOS', async () => {
      await controller.key({ key: 'cmd+a' });

      expect(robot.keyTap).toHaveBeenCalledWith('a', ['command']);
    });

    it('should handle repeat', async () => {
      await controller.key({ key: 'tab', repeat: 3 });

      expect(robot.keyTap).toHaveBeenCalledTimes(3);
    });

    it('should handle function keys', async () => {
      await controller.key({ key: 'f5' });

      expect(robot.keyTap).toHaveBeenCalledWith('f5');
    });

    it('should handle escape alias', async () => {
      await controller.key({ key: 'esc' });

      expect(robot.keyTap).toHaveBeenCalledWith('escape');
    });
  });

  describe('scroll', () => {
    it('should scroll down at position', async () => {
      await controller.scroll({ coordinate: [500, 500], direction: 'down', amount: 3 });

      expect(robot.moveMouse).toHaveBeenCalledWith(500, 500);
      expect(robot.scrollMouse).toHaveBeenCalledWith(0, -3);
    });

    it('should scroll up at position', async () => {
      await controller.scroll({ coordinate: [100, 100], direction: 'up', amount: 5 });

      expect(robot.moveMouse).toHaveBeenCalledWith(100, 100);
      expect(robot.scrollMouse).toHaveBeenCalledWith(0, 5);
    });

    it('should scroll left', async () => {
      await controller.scroll({ coordinate: [0, 0], direction: 'left', amount: 2 });

      expect(robot.scrollMouse).toHaveBeenCalledWith(-2, 0);
    });

    it('should scroll right', async () => {
      await controller.scroll({ coordinate: [0, 0], direction: 'right', amount: 4 });

      expect(robot.scrollMouse).toHaveBeenCalledWith(4, 0);
    });
  });
});
