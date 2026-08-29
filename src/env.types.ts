export interface CheckoutMcpEnv {
  apiKey?: string;
  accessToken?: string;
  baseUrl: string;
}

export interface WatchlistMcpEnv {
  accessToken: string;
  baseUrl: string;
}

export interface FincobraMcpEnv {
  checkout: CheckoutMcpEnv | null;
  watchlist: WatchlistMcpEnv | null;
}
