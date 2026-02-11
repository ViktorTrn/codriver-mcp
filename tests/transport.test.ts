import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the MCP SDK express and transport modules
vi.mock('@modelcontextprotocol/sdk/server/express.js', () => {
  const mockApp = {
    use: vi.fn(),
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    listen: vi.fn((_port: number, _host: string, cb: () => void) => {
      cb();
      return { close: vi.fn() };
    }),
  };
  return {
    createMcpExpressApp: vi.fn(() => mockApp),
  };
});

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
    handleRequest: vi.fn(),
    sessionId: 'test-session',
    start: vi.fn(),
    close: vi.fn(),
    send: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
  })),
}));

import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { startHttpTransport } from '../src/transport/streamable-http.js';

const mockCreateApp = vi.mocked(createMcpExpressApp);

describe('HTTP Transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create Express app with host for DNS rebinding protection', async () => {
    const mockServer = { connect: vi.fn() } as never;

    await startHttpTransport(mockServer, {
      port: 3100,
      host: '127.0.0.1',
    });

    expect(mockCreateApp).toHaveBeenCalledWith({ host: '127.0.0.1' });
  });

  it('should register POST, GET, DELETE routes on /mcp', async () => {
    const mockServer = { connect: vi.fn() } as never;

    await startHttpTransport(mockServer, {
      port: 3100,
      host: '127.0.0.1',
    });

    const app = mockCreateApp.mock.results[0].value;
    expect(app.post).toHaveBeenCalledWith('/mcp', expect.any(Function));
    expect(app.get).toHaveBeenCalledWith('/mcp', expect.any(Function));
    expect(app.delete).toHaveBeenCalledWith('/mcp', expect.any(Function));
  });

  it('should register /health endpoint', async () => {
    const mockServer = { connect: vi.fn() } as never;

    await startHttpTransport(mockServer, {
      port: 3100,
      host: '127.0.0.1',
    });

    const app = mockCreateApp.mock.results[0].value;
    // get is called for /mcp and /health
    const getCalls = app.get.mock.calls;
    const healthCall = getCalls.find((c: unknown[]) => c[0] === '/health');
    expect(healthCall).toBeDefined();
  });

  it('should create StreamableHTTPServerTransport with session ID generator', async () => {
    const mockServer = { connect: vi.fn() } as never;

    await startHttpTransport(mockServer, {
      port: 3100,
      host: '127.0.0.1',
    });

    expect(StreamableHTTPServerTransport).toHaveBeenCalledWith({
      sessionIdGenerator: expect.any(Function),
    });
  });

  it('should connect server to transport', async () => {
    const mockServer = { connect: vi.fn() } as never;

    await startHttpTransport(mockServer, {
      port: 3100,
      host: '127.0.0.1',
    });

    expect(mockServer.connect).toHaveBeenCalled();
  });

  it('should start listening on specified port and host', async () => {
    const mockServer = { connect: vi.fn() } as never;

    await startHttpTransport(mockServer, {
      port: 8080,
      host: '0.0.0.0',
    });

    const app = mockCreateApp.mock.results[0].value;
    expect(app.listen).toHaveBeenCalledWith(8080, '0.0.0.0', expect.any(Function));
  });

  describe('API Key Authentication', () => {
    it('should add auth middleware when apiKey is provided', async () => {
      const mockServer = { connect: vi.fn() } as never;

      await startHttpTransport(mockServer, {
        port: 3100,
        host: '127.0.0.1',
        apiKey: 'test-secret-key',
      });

      const app = mockCreateApp.mock.results[0].value;
      expect(app.use).toHaveBeenCalledWith('/mcp', expect.any(Function));
    });

    it('should NOT add auth middleware when no apiKey', async () => {
      const mockServer = { connect: vi.fn() } as never;

      await startHttpTransport(mockServer, {
        port: 3100,
        host: '127.0.0.1',
      });

      const app = mockCreateApp.mock.results[0].value;
      expect(app.use).not.toHaveBeenCalled();
    });

    it('should reject requests without valid Bearer token', async () => {
      const mockServer = { connect: vi.fn() } as never;

      await startHttpTransport(mockServer, {
        port: 3100,
        host: '127.0.0.1',
        apiKey: 'my-secret',
      });

      const app = mockCreateApp.mock.results[0].value;
      const authMiddleware = app.use.mock.calls[0][1];

      // Simulate request without auth header
      const req = { method: 'POST', headers: {} };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept requests with valid Bearer token', async () => {
      const mockServer = { connect: vi.fn() } as never;

      await startHttpTransport(mockServer, {
        port: 3100,
        host: '127.0.0.1',
        apiKey: 'my-secret',
      });

      const app = mockCreateApp.mock.results[0].value;
      const authMiddleware = app.use.mock.calls[0][1];

      const req = { method: 'POST', headers: { authorization: 'Bearer my-secret' } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow DELETE requests without auth (session cleanup)', async () => {
      const mockServer = { connect: vi.fn() } as never;

      await startHttpTransport(mockServer, {
        port: 3100,
        host: '127.0.0.1',
        apiKey: 'my-secret',
      });

      const app = mockCreateApp.mock.results[0].value;
      const authMiddleware = app.use.mock.calls[0][1];

      const req = { method: 'DELETE', headers: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
