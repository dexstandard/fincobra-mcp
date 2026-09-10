import type { CallToolResult } from '@modelcontextprotocol/server';
import type { CheckoutClient } from './checkout-client.types.js';
import type {
  ReportingCurrency,
  WatchlistClient,
} from './watchlist-client.types.js';

export interface FincobraMcpServerOptions {
  connection?: {
    clientId: string;
    scopes: string[];
    expiresAt: string;
    accountId: string;
  };
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

export interface WatchlistReportingInput {
  currency?: ReportingCurrency;
}

export interface GetWatchlistSourceInput extends WatchlistReportingInput {
  sourceId: string;
}

export interface AddWatchlistCarToolInput {
  name: string;
  currency: string;
  value: number;
  note?: string;
}
