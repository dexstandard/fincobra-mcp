import type { WatchlistFetch } from './watchlist-client.types.js';

export interface FincobraMcpConnection {
  accountId: string;
  clientId: string;
  scopes: string[];
  expiresAt: string;
  resource: string;
}

export interface FincobraMcpHttpOptions {
  resourceUrl: string;
  resolveAccessToken(token: string): Promise<FincobraMcpConnection | null>;
  watchlistBaseUrl: string;
  checkoutBaseUrl: string;
  allowedOrigins?: string[];
  fetchImpl?: WatchlistFetch;
}
