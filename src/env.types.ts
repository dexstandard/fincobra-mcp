export interface CheckoutMcpEnv {
  apiKey?: string;
  sessionToken?: string;
  baseUrl: string;
}

export interface WatchlistMcpEnv {
  sessionToken: string;
  baseUrl: string;
}

export interface FincobraMcpEnv {
  checkout: CheckoutMcpEnv | null;
  watchlist: WatchlistMcpEnv | null;
}
