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

export interface WatchlistBalanceLocation {
  source: string;
  label: string;
  amount: number;
  valueUsd: number | null;
}

export interface WatchlistBalance {
  sourceBalances: WatchlistBalanceLocation[] | null;
  lockedBalance: number;
  includedInTotal: boolean;
  exclusionReason: 'unsupported_token' | null;
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
  reportingCurrency: ReportingCurrency;
  totalNetWorthInReportingCurrency: number | null;
  sources: WatchlistReportedSource[];
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
  listSources(currency?: ReportingCurrency): Promise<WatchlistReportedSource[]>;
  getSource(
    sourceId: string,
    currency?: ReportingCurrency,
  ): Promise<WatchlistReportedSource>;
  getNetWorth(currency?: ReportingCurrency): Promise<WatchlistNetWorth>;
  addCar(input: AddWatchlistCarInput): Promise<WatchlistSource>;
}

export const REPORTING_CURRENCIES = [
  'USD',
  'VND',
  'EUR',
  'GBP',
  'JPY',
  'SGD',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'RUB',
  'GEL',
  'THB',
  'BTC',
  'XAU',
] as const;
export type ReportingCurrency = (typeof REPORTING_CURRENCIES)[number];

export interface WatchlistReportedBalance extends WatchlistBalance {
  sourceBalances:
    | (WatchlistBalanceLocation & { valueInReportingCurrency: number | null })[]
    | null;
  valueInReportingCurrency: number | null;
}

export interface WatchlistReportedSource extends WatchlistSource {
  reportingCurrency: ReportingCurrency;
  valueInReportingCurrency: number | null;
  balances: WatchlistReportedBalance[] | null;
}
