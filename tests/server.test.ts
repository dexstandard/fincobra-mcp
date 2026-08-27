import { describe, expect, it } from 'vitest';
import type { CheckoutClient } from '../src/checkout-client.types.js';
import type { WatchlistClient } from '../src/watchlist-client.types.js';
import {
  createCheckoutMcpServer,
  createFincobraMcpServer,
} from '../src/server.js';

const unusedCheckout: CheckoutClient = {
  async createInvoice() {
    throw new Error('unused');
  },
  async getInvoice() {
    throw new Error('unused');
  },
};

const unusedWatchlist: WatchlistClient = {
  async listSources() {
    throw new Error('unused');
  },
  async getSource() {
    throw new Error('unused');
  },
  async getNetWorth() {
    throw new Error('unused');
  },
};

describe('createFincobraMcpServer', () => {
  it('constructs a server with the v0 Checkout and Watchlist tools', () => {
    const server = createFincobraMcpServer({
      checkoutClient: unusedCheckout,
      watchlistClient: unusedWatchlist,
    });
    expect(server).toBeDefined();
    expect(registeredToolNames(server)).toEqual([
      'create_invoice',
      'get_invoice',
      'get_net_worth',
      'list_sources',
      'get_source',
    ]);
  });

  it('keeps the Checkout constructor alias', () => {
    const server = createCheckoutMcpServer({ client: unusedCheckout });
    expect(registeredToolNames(server)).toContain('create_invoice');
  });
});

function registeredToolNames(server: object): string[] {
  const record = server as {
    tools?: Map<string, unknown> | Record<string, unknown>;
    _registeredTools?: Map<string, unknown> | Record<string, unknown>;
  };
  const tools = record.tools ?? record._registeredTools;
  if (!tools) {
    throw new Error('MCP server did not expose registered tools');
  }

  if (tools instanceof Map) {
    return [...tools.keys()];
  }

  return Object.keys(tools);
}
