import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFincobraMcpHandler } from '../src/http.js';

const resourceUrl = 'https://watch.fincobra.com/api/mcp';
const handlers: ReturnType<typeof createFincobraMcpHandler>[] = [];
afterEach(async () => {
  await Promise.all(handlers.splice(0).map((handler) => handler.close()));
});
function fixture() {
  const fetchImpl = vi.fn(async () => Response.json({}));
  const handler = createFincobraMcpHandler({
    resourceUrl,
    watchlistBaseUrl: 'https://watch.fincobra.com',
    checkoutBaseUrl: 'https://fincobra.com',
    fetchImpl,
    async resolveAccessToken(token) {
      if (token === 'bad') return null;
      return {
        accountId: token,
        clientId: 'test',
        scopes:
          token === 'writer'
            ? [
                'watchlist:read',
                'watchlist:write',
                'checkout:read',
                'checkout:write',
              ]
            : ['watchlist:read'],
        expiresAt:
          token === 'expired'
            ? '2000-01-01T00:00:00.000Z'
            : '2099-01-01T00:00:00.000Z',
        resource:
          token === 'wrong-resource'
            ? 'https://other.example/mcp'
            : resourceUrl,
      };
    },
  });
  handlers.push(handler);
  async function call(
    method: string,
    params: unknown = {},
    token = 'reader',
    headers: Record<string, string> = {},
  ) {
    return handler.fetch(
      new Request(resourceUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-11-25',
          ...headers,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      }),
    );
  }
  return { handler, call, fetchImpl };
}
async function rpc(response: Response) {
  const text = await response.text();
  return JSON.parse(
    response.headers.get('content-type')?.includes('text/event-stream')
      ? text
          .split('\n')
          .find((line) => line.startsWith('data: '))!
          .slice(6)
      : text,
  ) as {
    result?: {
      tools?: { name: string }[];
      structuredContent?: { accountId: string; scopes: string[] };
      protocolVersion?: string;
    };
    error?: { message: string };
  };
}

describe('hosted MCP transport', () => {
  it.each(['bad', 'expired', 'wrong-resource'])(
    'challenges invalid access: %s',
    async (token) => {
      const f = fixture();
      const response = await f.call('tools/list', {}, token);
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain(
        '/.well-known/oauth-protected-resource/api/mcp',
      );
      expect(f.fetchImpl).not.toHaveBeenCalled();
    },
  );
  it('challenges missing auth and rejects cross-origin browser requests', async () => {
    const f = fixture();
    expect((await f.handler.fetch(new Request(resourceUrl))).status).toBe(401);
    expect(
      (
        await f.call('tools/list', {}, 'reader', {
          origin: 'https://attacker.example',
        })
      ).status,
    ).toBe(403);
  });
  it('initializes standard Streamable HTTP and lists only approved tools', async () => {
    const f = fixture();
    const init = await f.call('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' },
    });
    expect(init.status).toBe(200);
    expect((await rpc(init)).result?.protocolVersion).toBe('2025-11-25');
    const listed = await rpc(await f.call('tools/list'));
    expect(listed.result?.tools?.map((tool) => tool.name)).toEqual([
      'get_connection_status',
      'get_net_worth',
      'list_sources',
      'get_source',
    ]);
    expect(
      (
        await rpc(
          await f.call('tools/call', { name: 'create_invoice', arguments: {} }),
        )
      ).error,
    ).toBeDefined();
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });
  it('keeps concurrent users separate and exposes writes only to approved connections', async () => {
    const f = fixture();
    const responses = await Promise.all(
      ['reader', 'writer'].map((token) =>
        f
          .call(
            'tools/call',
            { name: 'get_connection_status', arguments: {} },
            token,
          )
          .then(rpc),
      ),
    );
    expect(
      responses.map((result) => result.result?.structuredContent?.accountId),
    ).toEqual(['reader', 'writer']);
    const tools = (
      await rpc(await f.call('tools/list', {}, 'writer'))
    ).result?.tools?.map((tool) => tool.name);
    expect(tools).toContain('create_invoice');
    expect(tools).toContain('add_car');
  });
  it('rechecks credentials for every request, including initialized clients', async () => {
    const f = fixture();
    await f.call('tools/list');
    expect((await f.call('tools/list', {}, 'bad')).status).toBe(401);
  });
  it('returns a protocol error for malformed messages without accessing business APIs', async () => {
    const f = fixture();
    const r = await f.handler.fetch(
      new Request(resourceUrl, {
        method: 'POST',
        headers: {
          authorization: 'Bearer reader',
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: '{',
      }),
    );
    expect(r.status).toBe(400);
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });
});
