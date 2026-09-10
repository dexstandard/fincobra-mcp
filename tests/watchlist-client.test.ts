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
  '/api/mcp/session': {
    account: { id: 'user-id' },
  },
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
  '/api/watchlist/wallets/12/balances': {
    balances: [{ asset: 'ETH', balance: 0.2, valueUsd: 500 }],
    totalUsd: 500,
  },
  '/api/users/user-id/binance/account': {
    balances: [
      {
        asset: 'BTC',
        sourceBalances: [{ source: 'spot', label: 'Spot', amount: '0.1' }],
        lockedBalance: '0',
      },
    ],
    tokenPrices: { BTC: 50_000 },
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
    expect(sources[0]).toMatchObject({
      valueUsd: 500,
      valuationStatus: 'complete',
    });
    expect(sources[1]).toMatchObject({
      valueUsd: 5_000,
      valuationStatus: 'complete',
    });
    expect(sources[4]?.valueUsd).toBe(600000);
  });

  it('summarizes live crypto and manual net worth', async () => {
    const client = createWatchlistClient({
      accessToken: 'fcm_watchlist',
      fetchImpl: createFetch(listedPayloads),
    });

    await expect(client.getNetWorth()).resolves.toMatchObject({
      banksUsd: 2500,
      cashUsd: 200,
      propertyUsd: 600000,
      carsUsd: 0,
      manualTotalUsd: 602700,
      pricedCryptoUsd: 5500,
      cryptoUsd: 5500,
      totalNetWorthUsd: 608200,
      unpricedManualAssetCount: 0,
      sourceCounts: { wallets: 1, exchanges: 1, manualAssets: 3 },
    });
  });

  it('marks crypto totals incomplete when a positive balance has no price', async () => {
    const client = createWatchlistClient({
      accessToken: 'fcm_watchlist',
      fetchImpl: createFetch({
        ...listedPayloads,
        '/api/users/user-id/binance/account': {
          balances: [
            {
              asset: 'UNKNOWN',
              sourceBalances: [{ source: 'spot', label: 'Spot', amount: '2' }],
              lockedBalance: '0',
            },
          ],
          tokenPrices: {},
        },
      }),
    });

    const sources = await client.listSources();
    expect(sources[1]).toMatchObject({
      valueUsd: null,
      valuationStatus: 'partial',
    });
    await expect(client.getNetWorth()).resolves.toMatchObject({
      pricedCryptoUsd: 500,
      cryptoUsd: null,
      totalNetWorthUsd: null,
    });
  });

  it('excludes an unsupported airdrop without blocking supported Hyperliquid equity', async () => {
    const client = createWatchlistClient({
      accessToken: 'fcm_watchlist',
      fetchImpl: createFetch({
        ...listedPayloads,
        '/api/watchlist/exchanges': {
          exchanges: [{ provider: 'hyperliquid' }],
        },
        '/api/users/user-id/hyperliquid/account': {
          balances: [
            {
              asset: 'HYPE',
              sourceBalances: [{ amount: '2' }],
              lockedBalance: '1',
            },
            {
              asset: 'MAX',
              sourceBalances: [{ amount: '172724.7177' }],
              lockedBalance: '0',
            },
          ],
          tokenPrices: { HYPE: 80, MAX: 999 },
          excludedAssets: ['MAX'],
        },
      }),
    });
    const result = await client.getNetWorth();
    expect(result).toMatchObject({
      reportingCurrency: 'USD',
      cryptoUsd: 740,
      totalNetWorthUsd: 603440,
      totalNetWorthInReportingCurrency: 603440,
    });
    expect(result.sources[1]).toMatchObject({
      valueUsd: 240,
      valuationStatus: 'complete',
      balances: [
        {
          asset: 'HYPE',
          balance: 3,
          valueUsd: 240,
          valueInReportingCurrency: 240,
          includedInTotal: true,
          exclusionReason: null,
        },
        {
          asset: 'MAX',
          balance: 172724.7177,
          valueUsd: null,
          valueInReportingCurrency: null,
          includedInTotal: false,
          exclusionReason: 'unsupported_token',
        },
      ],
    });
    expect(result.notes.join(' ')).toContain('1 unsupported token balances');
  });

  it.each([
    ['EUR', 0.5],
    ['BTC', 0.00001],
    ['XAU', 1 / 3000],
  ] as const)(
    'reports totals in %s while retaining original amounts and USD values',
    async (currency, rate) => {
      const fetchImpl = vi.fn(
        createFetch({
          ...listedPayloads,
          '/api/watchlist/fx-rates': {
            rates: { USD: 1, EUR: 0.5, [currency]: rate },
          },
        }),
      );
      const client = createWatchlistClient({
        accessToken: 'fcm_watchlist',
        fetchImpl,
      });
      const result = await client.getNetWorth(currency);
      expect(result.reportingCurrency).toBe(currency);
      expect(result.totalNetWorthUsd).toBe(608200);
      expect(result.totalNetWorthInReportingCurrency).toBeCloseTo(
        608200 * rate,
      );
      expect(result.sources[0]?.balances?.[0]).toMatchObject({
        asset: 'ETH',
        balance: 0.2,
        valueUsd: 500,
        valueInReportingCurrency: 500 * rate,
      });
      expect(result.sources[4]).toMatchObject({
        currency: 'EUR',
        value: 400000,
        mortgageBalance: 100000,
        valueUsd: 600000,
        valueInReportingCurrency: 600000 * rate,
      });
      expect(
        fetchImpl.mock.calls.some(([url]) =>
          url.endsWith(`/api/watchlist/fx-rates?currency=${currency}`),
        ),
      ).toBe(true);
      expect(
        (await client.getSource('wallet:12', currency))
          .valueInReportingCurrency,
      ).toBe(500 * rate);
    },
  );

  it('does not invent a requested currency rate', async () => {
    const client = createWatchlistClient({
      accessToken: 'fcm_watchlist',
      fetchImpl: createFetch(listedPayloads),
    });
    await expect(client.getNetWorth('GEL')).rejects.toThrow(
      'Reporting currency rate is unavailable: GEL',
    );
  });

  it('does not report a complete total when a manual asset cannot be converted', async () => {
    const client = createWatchlistClient({
      accessToken: 'fcm_watchlist',
      fetchImpl: createFetch({
        ...listedPayloads,
        '/api/watchlist/fx-rates': { rates: { USD: 1 } },
      }),
    });
    expect(await client.getNetWorth()).toMatchObject({
      unpricedManualAssetCount: 1,
      totalNetWorthUsd: null,
      totalNetWorthInReportingCurrency: null,
    });
  });

  it('adds a car as a manual Watchlist asset', async () => {
    const fetchImpl = vi.fn<WatchlistFetch>(async (url, init) => {
      const path = new URL(url).pathname;
      if (path === '/api/watchlist/manual-assets/cars') {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({
          name: 'Roadster',
          currency: 'EUR',
          value: 25_000,
          note: '2024 model',
        });
        return jsonResponse(201, {
          id: '9',
          assetType: 'manual_car',
          name: 'Roadster',
          currency: 'EUR',
          value: 25_000,
          accountType: null,
          mortgageBalance: null,
          note: '2024 model',
        });
      }
      if (path === '/api/watchlist/fx-rates') {
        return jsonResponse(200, { rates: { USD: 1, EUR: 0.5 } });
      }
      return jsonResponse(404, { error: `missing mock ${path}` });
    });
    const client = createWatchlistClient({
      accessToken: 'fcm_watchlist',
      fetchImpl,
    });

    await expect(
      client.addCar({
        name: 'Roadster',
        currency: 'EUR',
        value: 25_000,
        note: '2024 model',
      }),
    ).resolves.toMatchObject({
      id: 'manual:9',
      kind: 'manual_car',
      valueUsd: 50_000,
      valuationStatus: 'complete',
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
