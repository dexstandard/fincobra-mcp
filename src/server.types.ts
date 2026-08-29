import type { CallToolResult } from '@modelcontextprotocol/server';
import type { CheckoutClient } from './checkout-client.types.js';
import type { WatchlistClient } from './watchlist-client.types.js';

export interface CheckoutMcpServerOptions {
  client?: CheckoutClient;
  checkoutClient?: CheckoutClient;
  watchlistClient?: WatchlistClient;
}

export type CheckoutMcpToolResult = CallToolResult;

export interface CreateInvoiceToolInput {
  amountUsd: number;
  description?: string;
  merchantReference?: string;
  customerEmail?: string;
}

export interface GetInvoiceToolInput {
  invoiceId: string;
}

export interface GetWatchlistSourceInput {
  sourceId: string;
}

export interface AddWatchlistCarToolInput {
  name: string;
  currency: string;
  value: number;
  note?: string;
}
