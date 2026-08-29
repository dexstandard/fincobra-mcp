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

export interface WatchlistBalance {
  asset: string;
  balance: number;
  valueUsd: number | null;
}

export type WatchlistValuationStatus = 'complete' | 'partial' | 'unavailable';

export interface WatchlistSource {
  id: string;
  kind:
    | 'wallet'
    | 'exchange'
    | 'manual_bank'
    | 'manual_property'
    | 'manual_car';
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
  balances: WatchlistBalance[] | null;
  valuationStatus: WatchlistValuationStatus;
}

export interface AddWatchlistCarInput {
  name: string;
  currency: string;
  value: number;
  note?: string;
}

export interface WatchlistNetWorth {
  banksUsd: number;
  cashUsd: number;
  propertyUsd: number;
  carsUsd: number;
  manualTotalUsd: number;
  pricedCryptoUsd: number;
  cryptoUsd: number | null;
  totalNetWorthUsd: number | null;
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
  addCar(input: AddWatchlistCarInput): Promise<WatchlistSource>;
}
