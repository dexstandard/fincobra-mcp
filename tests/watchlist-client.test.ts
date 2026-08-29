import { describe, expect, it, vi } from 'vitest';
import type { WatchlistFetch } from '../src/watchlist-client.types.js';
import { createWatchlistClient } from '../src/watchlist-client.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createFetch(routes: Record<string, unknown>): WatchlistFetch {
  return async (url, init) => {
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer fcm_watchlist',
    });
    const path = new URL(url).pathname;
    const body = routes[path];
    if (body === undefined) {
      return jsonResponse(404, { error: `missing mock ${path}` });
    }
    return jsonResponse(200, body);
  };
}

const listedPayloads = {
  '/api/watchlist/wallets': {
    wallets: [
      {
        id: '12',
        blockchain: 'ethereum',
        displayAddress: '0xabc',
        tokenPnl: [{ asset: 'ETH', costBasisUsd: 100, reliable: true }],
      },
    ],
  },
  '/api/watchlist/exchanges': {
    exchanges: [{ provider: 'binance', tokenPnl: null }],
  },
  '/api/watchlist/manual-assets': {
    manualAssets: [
      {
        id: '3',
        assetType: 'manual_bank',
        name: 'Checking',
        currency: 'USD',
        value: 2500,
        accountType: 'bank',
        mortgageBalance: null,
      },
      {
        id: '4',
        assetType: 'manual_bank',
        name: 'Cash',
        currency: 'USD',
        value: 200,
        accountType: 'cash',
        mortgageBalance: null,
      },
      {
        id: '5',
        assetType: 'manual_property',
        name: 'House',
        currency: 'EUR',
        value: 400000,
        accountType: null,
        mortgageBalance: 100000,
      },
    ],
  },
  '/api/watchlist/fx-rates': {
    baseCode: 'USD',
    rates: { USD: 1, EUR: 0.5 },
  },
};

describe('createWatchlistClient', () => {
  it('lists wallets, exchanges, and manual assets', async () => {
    const client = createWatchlistClient({
      accessToken: 'fcm_watchlist',
      fetchImpl: createFetch(listedPayloads),
    });

    const sources = await client.listSources();
    expect(sources.map((source) => source.id)).toEqual([
      'wallet:12',
      'exchange:binance',
      'manual:3',
      'manual:4',
      'manual:5',
    ]);
    expect(sources[0]?.tokenPnl).toEqual([
      { asset: 'ETH', costBasisUsd: 100, reliable: true },
    ]);
    expect(sources[4]?.valueUsd).toBe(600000);
  });

  it('summarizes manual net worth and leaves crypto USD null', async () => {
    const client = createWatchlistClient({
      accessToken: 'fcm_watchlist',
      fetchImpl: createFetch(listedPayloads),
    });

    await expect(client.getNetWorth()).resolves.toMatchObject({
      banksUsd: 2500,
      cashUsd: 200,
      propertyUsd: 600000,
      manualTotalUsd: 602700,
      cryptoUsd: null,
      unpricedManualAssetCount: 0,
      sourceCounts: { wallets: 1, exchanges: 1, manualAssets: 3 },
    });
  });

  it('gets one source by id', async () => {
    const client = createWatchlistClient({
      accessToken: 'fcm_watchlist',
      fetchImpl: createFetch(listedPayloads),
    });

    const source = await client.getSource('exchange:binance');
    expect(source.kind).toBe('exchange');
    expect(source.provider).toBe('binance');
  });

  it('explains an expired browser login', async () => {
    const fetchImpl = vi.fn<WatchlistFetch>(async () =>
      jsonResponse(403, { error: 'forbidden' }),
    );
    const client = createWatchlistClient({
      accessToken: 'fcm_bad',
      fetchImpl,
    });

    await expect(client.listSources()).rejects.toThrow(
      'npx -y fincobra-mcp login',
    );
  });
});
