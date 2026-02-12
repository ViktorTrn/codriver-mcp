import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @jitsi/robotjs - factory must be self-contained (hoisted)
vi.mock('@jitsi/robotjs', () => {
  const mock = {
    moveMouse: vi.fn(),
    mouseClick: vi.fn(),
    mouseToggle: vi.fn(),
    dragMouse: vi.fn(),
    typeString: vi.fn(),
    keyTap: vi.fn(),
    scrollMouse: vi.fn(),
    getMousePos: vi.fn(() => ({ x: 0, y: 0 })),
  };
  return { default: mock, ...mock };
});

// Mock child_process for Swift calls
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, callback: Function) => {
    if (typeof _opts === 'function') {
      (_opts as Function)(null, { stdout: '', stderr: '' });
    } else if (typeof callback === 'function') {
      callback(null, { stdout: '', stderr: '' });
    }
    return undefined as never;
  }),
}));

import robot from '@jitsi/robotjs';
import { execFile } from 'node:child_process';
import { InputController } from '../src/modules/input-controller.js';

const mockExecFile = vi.mocked(execFile);

describe('InputController', () => {
  let controller: InputController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new InputController();
  });

  describe('click (macOS - Swift/CGEvent)', () => {
    it('should call Swift for left click', async () => {
      await controller.click({ coordinate: [100, 200] });

      expect(mockExecFile).toHaveBeenCalledWith(
        'swift',
        expect.any(Array),
        expect.objectContaining({ timeout: 10000 }),
        expect.any(Function)
      );
      // Swift code should contain the coordinates
      const swiftArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(swiftArgs[1]).toContain('CGPoint(x: 100, y: 200)');
      expect(swiftArgs[1]).toContain('.leftMouseDown');
    });

    it('should handle right-click', async () => {
      await controller.click({ coordinate: [50, 75], button: 'right' });

      const swiftArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(swiftArgs[1]).toContain('.rightMouseDown');
    });

    it('should handle double-click', async () => {
      await controller.click({ coordinate: [300, 400], doubleClick: true });

      const swiftArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(swiftArgs[1]).toContain('mouseEventClickState');
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

  describe('scroll (macOS - Swift/CGEvent)', () => {
    it('should scroll down at position via Swift', async () => {
      await controller.scroll({ coordinate: [500, 500], direction: 'down', amount: 3 });

      const swiftArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(swiftArgs[1]).toContain('CGPoint(x: 500, y: 500)');
      expect(swiftArgs[1]).toContain('wheel1: Int32(-3)');
    });

    it('should scroll up at position', async () => {
      await controller.scroll({ coordinate: [100, 100], direction: 'up', amount: 5 });

      const swiftArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(swiftArgs[1]).toContain('wheel1: Int32(5)');
    });

    it('should scroll left', async () => {
      await controller.scroll({ coordinate: [0, 0], direction: 'left', amount: 2 });

      const swiftArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(swiftArgs[1]).toContain('wheel2: Int32(-2)');
    });

    it('should scroll right', async () => {
      await controller.scroll({ coordinate: [0, 0], direction: 'right', amount: 4 });

      const swiftArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(swiftArgs[1]).toContain('wheel2: Int32(4)');
    });
  });

  describe('drag (macOS - Swift/CGEvent)', () => {
    it('should drag via Swift with start and end coordinates', async () => {
      await controller.drag({
        startCoordinate: [100, 200],
        endCoordinate: [300, 400],
      });

      const swiftArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(swiftArgs[1]).toContain('CGPoint(x: 100, y: 200)');
      expect(swiftArgs[1]).toContain('CGPoint(x: 300, y: 400)');
      expect(swiftArgs[1]).toContain('.leftMouseDown');
      expect(swiftArgs[1]).toContain('.leftMouseDragged');
      expect(swiftArgs[1]).toContain('.leftMouseUp');
    });

    it('should use smooth drag with steps', async () => {
      await controller.drag({
        startCoordinate: [0, 0],
        endCoordinate: [100, 100],
      });

      const swiftArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(swiftArgs[1]).toContain('let steps = 20');
    });
  });
});
