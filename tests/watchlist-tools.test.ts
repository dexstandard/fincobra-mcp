import { describe, expect, it } from 'vitest';
import {
  handleGetNetWorth,
  handleGetSource,
  handleListSources,
} from '../src/tools.js';
import type {
  WatchlistClient,
  WatchlistNetWorth,
  WatchlistSource,
} from '../src/watchlist-client.types.js';

const source: WatchlistSource = {
  id: 'manual:3',
  kind: 'manual_bank',
  label: 'Checking',
  blockchain: null,
  displayAddress: null,
  provider: null,
  currency: 'USD',
  value: 100,
  valueUsd: 100,
  accountType: 'bank',
  mortgageBalance: null,
  tokenPnl: null,
};

const netWorth: WatchlistNetWorth = {
  banksUsd: 100,
  cashUsd: 0,
  propertyUsd: 0,
  manualTotalUsd: 100,
  cryptoUsd: null,
  unpricedManualAssetCount: 0,
  sourceCounts: { wallets: 0, exchanges: 0, manualAssets: 1 },
  notes: ['manual'],
};

describe('watchlist MCP tools', () => {
  it('returns list_sources and get_net_worth', async () => {
    const client: WatchlistClient = {
      async listSources() {
        return [source];
      },
      async getSource() {
        return source;
      },
      async getNetWorth() {
        return netWorth;
      },
    };

    const listed = await handleListSources(client);
    expect(listed.structuredContent).toEqual({ sources: [source] });

    const summary = await handleGetNetWorth(client);
    expect(summary.structuredContent).toEqual(netWorth);
  });

  it('looks up get_source by id', async () => {
    const client: WatchlistClient = {
      async listSources() {
        return [source];
      },
      async getSource(sourceId) {
        expect(sourceId).toBe('manual:3');
        return source;
      },
      async getNetWorth() {
        return netWorth;
      },
    };

    const result = await handleGetSource(client, { sourceId: 'manual:3' });
    expect(result.structuredContent).toEqual(source);
  });

  it('explains how to sign in when Watchlist is not configured', async () => {
    const result = await handleGetNetWorth(undefined);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('npx -y fincobra-mcp login');
  });
});
