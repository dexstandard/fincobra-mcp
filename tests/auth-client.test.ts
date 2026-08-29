import { describe, expect, it, vi } from 'vitest';
import {
  createDeviceAuthorization,
  getSessionStatus,
  pollDeviceAuthorization,
  revokeSession,
} from '../src/auth-client.js';
import type { DeviceAuthorization } from '../src/auth-client.types.js';

const authorization: DeviceAuthorization = {
  deviceCode: 'device-code-value-with-enough-entropy',
  userCode: 'ABCD-EFGH',
  verificationUri: 'https://watch.fincobra.com/mcp/authorize',
  verificationUriComplete:
    'https://watch.fincobra.com/mcp/authorize?user_code=ABCD-EFGH',
  expiresIn: 60,
  interval: 0,
};

describe('FinCobra browser auth client', () => {
  it('creates a scoped browser approval request', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        scopes: ['watchlist:read', 'checkout:read', 'checkout:write'],
      });
      return jsonResponse(201, authorization);
    });

    await expect(
      createDeviceAuthorization('https://watch.fincobra.com', fetchImpl),
    ).resolves.toEqual(authorization);
  });

  it('waits for approval and returns the account credential', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(202, { status: 'authorization_pending' }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: 'fcm_access',
          expiresAt: '2026-12-01T00:00:00.000Z',
          scopes: ['watchlist:read'],
          account: {
            id: 'user-id',
            email: 'user@example.com',
            walletAddress: null,
          },
        }),
      );

    await expect(
      pollDeviceAuthorization(
        'https://watch.fincobra.com',
        authorization,
        fetchImpl,
      ),
    ).resolves.toMatchObject({ accessToken: 'fcm_access' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('checks and revokes a saved login with a bearer token', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer fcm_access',
      });
      return jsonResponse(200, {
        account: { id: 'user-id', email: null, walletAddress: '0xabc' },
        scopes: ['watchlist:read'],
        expiresAt: '2026-12-01T00:00:00.000Z',
      });
    });

    await getSessionStatus(
      'https://watch.fincobra.com',
      'fcm_access',
      fetchImpl,
    );
    await revokeSession('https://watch.fincobra.com', 'fcm_access', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
