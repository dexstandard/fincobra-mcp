import { CheckoutApiError, normalizeBaseUrl } from './checkout-client.js';
import { FINCOBRA_MCP_VERSION } from './version.js';
import type {
  AddWatchlistCarInput,
  WatchlistClient,
  WatchlistClientConfig,
  WatchlistFetch,
  WatchlistBalance,
  WatchlistBalanceLocation,
  WatchlistNetWorth,
  WatchlistSource,
  WatchlistTokenPnl,
  ReportingCurrency,
  WatchlistReportedSource,
} from './watchlist-client.types.js';

const DEFAULT_BASE_URL = 'https://watch.fincobra.com';
const REQUEST_TIMEOUT_MS = 30_000;
const USER_AGENT = `fincobra-mcp/${FINCOBRA_MCP_VERSION}`;

const MANUAL_NET_WORTH_NOTES = [
  'Banks, cash, property, and cars are manual Watchlist entries, not live financial or title feeds.',
];

export function createWatchlistClient(
  config: WatchlistClientConfig,
): WatchlistClient {
  const accessToken = normalizeAccessToken(config.accessToken);
  if (accessToken.length === 0) {
    throw new Error(
      'FinCobra login is missing. Connect FinCobra in your MCP client and approve access in the browser.',
    );
  }

  const baseUrl = normalizeBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL);
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async listSources(currency = 'USD') {
      return listWatchlistSources(fetchImpl, baseUrl, accessToken, currency);
    },
    async getSource(sourceId, currency = 'USD') {
      const id = sourceId.trim();
      if (id.length === 0) {
        throw new CheckoutApiError(400, 'sourceId is required');
      }

      const sources = await listWatchlistSources(
        fetchImpl,
        baseUrl,
        accessToken,
        currency,
      );
      const match = sources.find((source) => source.id === id);
      if (!match) {
        throw new CheckoutApiError(404, `Watchlist source not found: ${id}`);
      }
      return match;
    },
    async getNetWorth(currency = 'USD') {
      const sources = await listWatchlistSources(
        fetchImpl,
        baseUrl,
        accessToken,
        currency,
      );
      return buildNetWorth(sources, currency);
    },
    async addCar(input) {
      return addWatchlistCar(fetchImpl, baseUrl, accessToken, input);
    },
  };
}

async function listWatchlistSources(
  fetchImpl: WatchlistFetch,
  baseUrl: string,
  accessToken: string,
  currency: ReportingCurrency,
): Promise<WatchlistReportedSource[]> {
  const [
    walletsPayload,
    exchangesPayload,
    manualsPayload,
    fxPayload,
    sessionPayload,
  ] = await Promise.all([
    requestJson(fetchImpl, baseUrl, accessToken, '/api/watchlist/wallets'),
    requestJson(fetchImpl, baseUrl, accessToken, '/api/watchlist/exchanges'),
    requestJson(
      fetchImpl,
      baseUrl,
      accessToken,
      '/api/watchlist/manual-assets',
    ),
    requestJson(
      fetchImpl,
      baseUrl,
      accessToken,
      currency === 'USD'
        ? '/api/watchlist/fx-rates'
        : `/api/watchlist/fx-rates?currency=${currency}`,
    ).catch(() => null),
    requestJson(fetchImpl, baseUrl, accessToken, '/api/mcp/session').catch(
      () => null,
    ),
  ]);

  const usdRates = readUsdRates(fxPayload);
  const reportingRate = usdRates[currency];
  if (!Number.isFinite(reportingRate) || reportingRate <= 0) {
    throw new CheckoutApiError(
      503,
      `Reporting currency rate is unavailable: ${currency}`,
    );
  }
  const wallets = readArray(asRecord(walletsPayload)?.wallets);
  const exchanges = readArray(asRecord(exchangesPayload)?.exchanges);
  const manuals = readArray(asRecord(manualsPayload)?.manualAssets);

  const sources = [
    ...wallets.map((wallet) => toWalletSource(wallet)),
    ...exchanges.map((exchange) => toExchangeSource(exchange)),
    ...manuals.map((asset) => toManualSource(asset, usdRates)),
  ];
  const accountId = readString(asRecord(asRecord(sessionPayload)?.account)?.id);

  const enriched = await Promise.all(
    sources.map((source) =>
      enrichCryptoSource(fetchImpl, baseUrl, accessToken, accountId, source),
    ),
  );
  return enriched.map((source) => ({
    ...source,
    reportingCurrency: currency,
    valueInReportingCurrency:
      source.valueUsd === null ? null : source.valueUsd * reportingRate,
    balances:
      source.balances?.map((balance) => ({
        ...balance,
        sourceBalances:
          balance.sourceBalances?.map((location) => ({
            ...location,
            valueInReportingCurrency:
              location.valueUsd === null
                ? null
                : location.valueUsd * reportingRate,
          })) ?? null,
        valueInReportingCurrency:
          balance.valueUsd === null ? null : balance.valueUsd * reportingRate,
      })) ?? null,
  }));
}

function buildNetWorth(
  sources: WatchlistReportedSource[],
  currency: ReportingCurrency,
): WatchlistNetWorth {
  let banksUsd = 0;
  let cashUsd = 0;
  let propertyUsd = 0;
  let carsUsd = 0;
  let pricedCryptoUsd = 0;
  let cryptoValuationComplete = true;
  let unpricedManualAssetCount = 0;
  let wallets = 0;
  let exchanges = 0;
  let manualAssets = 0;

  for (const source of sources) {
    if (source.kind === 'wallet') {
      wallets += 1;
      if (source.valueUsd === null) {
        cryptoValuationComplete = false;
      } else {
        pricedCryptoUsd += source.valueUsd;
      }
      continue;
    }
    if (source.kind === 'exchange') {
      exchanges += 1;
      if (source.valueUsd === null) {
        cryptoValuationComplete = false;
      } else {
        pricedCryptoUsd += source.valueUsd;
      }
      continue;
    }

    manualAssets += 1;
    if (source.valueUsd === null) {
      unpricedManualAssetCount += 1;
      continue;
    }

    if (source.kind === 'manual_property') {
      propertyUsd += source.valueUsd;
      continue;
    }
    if (source.kind === 'manual_car') {
      carsUsd += source.valueUsd;
      continue;
    }

    if (source.accountType === 'cash') {
      cashUsd += source.valueUsd;
    } else {
      banksUsd += source.valueUsd;
    }
  }

  const manualTotalUsd = banksUsd + cashUsd + propertyUsd + carsUsd;
  const cryptoUsd = cryptoValuationComplete ? pricedCryptoUsd : null;
  const notes = [...MANUAL_NET_WORTH_NOTES];
  const excludedCount = sources.reduce(
    (count, source) =>
      count +
      (source.balances?.filter((balance) => !balance.includedInTotal).length ??
        0),
    0,
  );
  if (excludedCount > 0)
    notes.push(
      `${excludedCount} unsupported token balances are excluded from totals. Their original amounts remain available in sources.`,
    );
  if (!cryptoValuationComplete) {
    notes.push(
      'Some crypto sources could not be valued. pricedCryptoUsd excludes unavailable sources.',
    );
  }

  const complete = cryptoUsd !== null && unpricedManualAssetCount === 0;
  return {
    reportingCurrency: currency,
    totalNetWorthInReportingCurrency: complete
      ? sources.reduce(
          (total, source) => total + (source.valueInReportingCurrency ?? 0),
          0,
        )
      : null,
    sources,
    banksUsd,
    cashUsd,
    propertyUsd,
    carsUsd,
    manualTotalUsd,
    pricedCryptoUsd,
    cryptoUsd,
    totalNetWorthUsd: complete ? manualTotalUsd + cryptoUsd : null,
    unpricedManualAssetCount,
    sourceCounts: { wallets, exchanges, manualAssets },
    notes,
  };
}

async function addWatchlistCar(
  fetchImpl: WatchlistFetch,
  baseUrl: string,
  accessToken: string,
  input: AddWatchlistCarInput,
): Promise<WatchlistSource> {
  const payload = await requestJson(
    fetchImpl,
    baseUrl,
    accessToken,
    '/api/watchlist/manual-assets/cars',
    {
      method: 'POST',
      body: {
        name: input.name,
        currency: input.currency,
        value: input.value,
        note: input.note ?? null,
      },
    },
  );
  const fxPayload = await requestJson(
    fetchImpl,
    baseUrl,
    accessToken,
    '/api/watchlist/fx-rates',
  ).catch(() => null);
  return toManualSource(payload, readUsdRates(fxPayload));
}

async function enrichCryptoSource(
  fetchImpl: WatchlistFetch,
  baseUrl: string,
  accessToken: string,
  accountId: string | null,
  source: WatchlistSource,
): Promise<WatchlistSource> {
  try {
    if (source.kind === 'wallet') {
      const walletId = source.id.slice('wallet:'.length);
      const payload = await requestJson(
        fetchImpl,
        baseUrl,
        accessToken,
        `/api/watchlist/wallets/${encodeURIComponent(walletId)}/balances`,
      );
      return withCryptoBalances(source, payload);
    }
    if (source.kind === 'exchange' && source.provider && accountId) {
      if (!['binance', 'bybit', 'hyperliquid'].includes(source.provider)) {
        return source;
      }
      const payload = await requestJson(
        fetchImpl,
        baseUrl,
        accessToken,
        `/api/users/${encodeURIComponent(accountId)}/${source.provider}/account`,
      );
      return withExchangeBalances(source, payload);
    }
    return source;
  } catch {
    return source;
  }
}

function withCryptoBalances(
  source: WatchlistSource,
  payload: unknown,
): WatchlistSource {
  const record = asRecord(payload);
  const balances = readBalances(record?.balances);
  const totalUsd = readNumber(record?.totalUsd);
  if (!record) {
    return source;
  }
  return {
    ...source,
    value: totalUsd,
    valueUsd: totalUsd,
    balances,
    valuationStatus: totalUsd === null ? 'partial' : 'complete',
  };
}

function withExchangeBalances(
  source: WatchlistSource,
  payload: unknown,
): WatchlistSource {
  const record = asRecord(payload);
  if (!record) {
    return source;
  }
  const prices = readPriceMap(record.tokenPrices);
  const excludedAssets = new Set(
    readArray(record.excludedAssets).flatMap((asset) =>
      typeof asset === 'string' ? [asset.toUpperCase()] : [],
    ),
  );
  const balances: WatchlistBalance[] = readArray(record.balances).flatMap(
    (raw) => {
      const balance = asRecord(raw);
      const asset = balance ? readString(balance.asset) : null;
      if (!balance || !asset) {
        return [];
      }
      const excluded = excludedAssets.has(asset.toUpperCase());
      const price = excluded ? undefined : prices[asset.toUpperCase()];
      const sourceBalances =
        readBalanceLocations(balance.sourceBalances, price ?? null) ?? [];
      const lockedBalance = readNumeric(balance.lockedBalance) ?? 0;
      const amount =
        sourceBalances.reduce((total, entry) => total + entry.amount, 0) +
        lockedBalance;
      return [
        {
          asset,
          includedInTotal: !excluded,
          exclusionReason: excluded ? 'unsupported_token' : null,
          balance: amount,
          sourceBalances,
          lockedBalance,
          valueUsd:
            typeof price === 'number' && Number.isFinite(price)
              ? amount * price
              : null,
        } satisfies WatchlistBalance,
      ];
    },
  );
  const pricedBalances = balances.filter(
    (balance): balance is WatchlistBalance & { valueUsd: number } =>
      balance.valueUsd !== null,
  );
  const hasUnpricedBalance = balances.some(
    (balance) =>
      balance.includedInTotal &&
      balance.balance > 0 &&
      balance.valueUsd === null,
  );
  const totalUsd = pricedBalances.reduce(
    (total, balance) => total + balance.valueUsd,
    0,
  );
  return {
    ...source,
    value: hasUnpricedBalance ? null : totalUsd,
    valueUsd: hasUnpricedBalance ? null : totalUsd,
    balances,
    valuationStatus: hasUnpricedBalance ? 'partial' : 'complete',
  };
}

async function requestJson(
  fetchImpl: WatchlistFetch,
  baseUrl: string,
  accessToken: string,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        'User-Agent': USER_AGENT,
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    throw new CheckoutApiError(
      0,
      `Failed to reach Watchlist at ${baseUrl}: ${errorMessage(err)}`,
    );
  }

  const payload = await readJsonBody(response);
  if (!response.ok) {
    throw new CheckoutApiError(
      response.status,
      formatWatchlistHttpError(response.status, payload),
    );
  }

  return payload;
}

function formatWatchlistHttpError(
  statusCode: number,
  payload: unknown,
): string {
  const apiMessage = readApiErrorMessage(payload);

  if (statusCode === 403 || statusCode === 401) {
    return `${apiMessage ?? 'FinCobra login expired'}. Reconnect FinCobra in your MCP client to renew browser authorization.`;
  }

  return apiMessage ?? `Watchlist request failed with HTTP ${statusCode}`;
}

function toWalletSource(value: unknown): WatchlistSource {
  const record = asRecord(value) ?? {};
  const id = readString(record.id) ?? 'unknown';
  const blockchain = readString(record.blockchain);
  const displayAddress = readString(record.displayAddress);

  return {
    id: `wallet:${id}`,
    kind: 'wallet',
    label: [blockchain, displayAddress].filter(Boolean).join(' ') || id,
    blockchain,
    displayAddress,
    provider: null,
    currency: null,
    value: null,
    valueUsd: null,
    accountType: null,
    mortgageBalance: null,
    tokenPnl: readTokenPnl(record.tokenPnl),
    balances: null,
    valuationStatus: 'unavailable',
  };
}

function toExchangeSource(value: unknown): WatchlistSource {
  const record = asRecord(value) ?? {};
  const provider = readString(record.provider) ?? 'unknown';

  return {
    id: `exchange:${provider}`,
    kind: 'exchange',
    label: provider,
    blockchain: null,
    displayAddress: null,
    provider,
    currency: null,
    value: null,
    valueUsd: null,
    accountType: null,
    mortgageBalance: null,
    tokenPnl: readTokenPnl(record.tokenPnl),
    balances: null,
    valuationStatus: 'unavailable',
  };
}

function toManualSource(
  raw: unknown,
  usdRates: Record<string, number>,
): WatchlistSource {
  const record = asRecord(raw) ?? {};
  const id = readString(record.id) ?? 'unknown';
  const assetType =
    record.assetType === 'manual_property'
      ? 'manual_property'
      : record.assetType === 'manual_car'
        ? 'manual_car'
        : 'manual_bank';
  const name = readString(record.name) ?? id;
  const currency = readString(record.currency);
  const value = readNumber(record.value);
  const mortgageBalance = readNumber(record.mortgageBalance);
  const localValue =
    assetType === 'manual_property' && value !== null
      ? value - (mortgageBalance ?? 0)
      : value;
  const accountType =
    record.accountType === 'cash'
      ? 'cash'
      : record.accountType === 'bank'
        ? 'bank'
        : null;
  const valueUsd =
    localValue === null || !currency
      ? null
      : convertCurrencyToUsd(localValue, currency, usdRates);

  return {
    id: `manual:${id}`,
    kind: assetType,
    label: name,
    blockchain: null,
    displayAddress: null,
    provider: null,
    currency,
    value,
    valueUsd,
    accountType,
    mortgageBalance,
    tokenPnl: null,
    balances: null,
    valuationStatus:
      localValue !== null && currency && valueUsd !== null
        ? 'complete'
        : 'unavailable',
  };
}

function readBalanceLocations(
  value: unknown,
  price: number | null,
): WatchlistBalanceLocation[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value))
    throw new Error('Balance locations are unavailable.');
  return value.map((raw) => {
    const entry = asRecord(raw);
    const source = readString(entry?.source);
    const label = readString(entry?.label);
    const amount = readNumeric(entry?.amount);
    if (!source || !label || amount === null)
      throw new Error('A balance location is incomplete.');
    return {
      source,
      label,
      amount,
      valueUsd: price === null ? null : price * amount,
    };
  });
}

function readBalances(value: unknown): WatchlistBalance[] {
  return readArray(value).flatMap((raw) => {
    const record = asRecord(raw);
    const asset = record ? readString(record.asset) : null;
    const balance = record ? readNumber(record.balance) : null;
    const valueUsd = record ? readNumber(record.valueUsd) : null;
    if (!asset || balance === null) {
      return [];
    }
    return [
      {
        asset,
        balance,
        valueUsd,
        includedInTotal: true,
        exclusionReason: null,
        sourceBalances: readBalanceLocations(
          record?.sourceBalances,
          valueUsd !== null && balance > 0 ? valueUsd / balance : null,
        ),
        lockedBalance: 0,
      },
    ];
  });
}

function readPriceMap(value: unknown): Record<string, number> {
  const record = asRecord(value);
  const result: Record<string, number> = {};
  if (!record) {
    return result;
  }
  for (const [asset, rawPrice] of Object.entries(record)) {
    const price = readNumeric(rawPrice);
    if (price !== null && price > 0) {
      result[asset.toUpperCase()] = price;
    }
  }
  return result;
}

function readTokenPnl(value: unknown): WatchlistTokenPnl[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const rows = value.flatMap((row) => {
    const record = asRecord(row);
    const asset = record ? readString(record.asset) : null;
    const costBasisUsd = record ? readNumber(record.costBasisUsd) : null;
    if (!asset || costBasisUsd === null) {
      return [];
    }
    return [
      {
        asset,
        costBasisUsd,
        reliable: record?.reliable === true,
      },
    ];
  });

  return rows.length > 0 ? rows : null;
}

function readUsdRates(payload: unknown): Record<string, number> {
  const rates = asRecord(asRecord(payload)?.rates);
  const result: Record<string, number> = { USD: 1 };
  if (!rates) {
    return result;
  }

  for (const [code, value] of Object.entries(rates)) {
    const rate = readNumber(value);
    if (rate !== null && rate > 0) {
      result[code.toUpperCase()] = rate;
    }
  }

  return result;
}

function convertCurrencyToUsd(
  value: number,
  currency: string,
  usdRates: Record<string, number>,
): number | null {
  const rate = usdRates[currency.toUpperCase()];
  if (!Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return value / rate;
}

function normalizeAccessToken(value: string): string {
  return value.trim();
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readApiErrorMessage(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) {
    return typeof payload === 'string' && payload.trim().length > 0
      ? payload
      : null;
  }

  return readString(record.error);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readNumeric(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
