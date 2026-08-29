export interface WatchlistClientConfig {
  accessToken: string;
  baseUrl?: string;
  fetchImpl?: WatchlistFetch;
}

export type WatchlistFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface WatchlistTokenPnl {
  asset: string;
  costBasisUsd: number;
  reliable: boolean;
}

export interface WatchlistSource {
  id: string;
  kind: 'wallet' | 'exchange' | 'manual_bank' | 'manual_property';
  label: string;
  blockchain: string | null;
  displayAddress: string | null;
  provider: string | null;
  currency: string | null;
  value: number | null;
  valueUsd: number | null;
  accountType: 'bank' | 'cash' | null;
  mortgageBalance: number | null;
  tokenPnl: WatchlistTokenPnl[] | null;
}

export interface WatchlistNetWorth {
  banksUsd: number;
  cashUsd: number;
  propertyUsd: number;
  manualTotalUsd: number;
  cryptoUsd: null;
  unpricedManualAssetCount: number;
  sourceCounts: {
    wallets: number;
    exchanges: number;
    manualAssets: number;
  };
  notes: string[];
}

export interface WatchlistClient {
  listSources(): Promise<WatchlistSource[]>;
  getSource(sourceId: string): Promise<WatchlistSource>;
  getNetWorth(): Promise<WatchlistNetWorth>;
}
