import { CheckoutApiError, normalizeBaseUrl } from './checkout-client.js';
import type {
  WatchlistClient,
  WatchlistClientConfig,
  WatchlistFetch,
  WatchlistNetWorth,
  WatchlistSource,
  WatchlistTokenPnl,
} from './watchlist-client.types.js';

const DEFAULT_BASE_URL = 'https://watch.fincobra.com';
const REQUEST_TIMEOUT_MS = 30_000;
const USER_AGENT = 'fincobra-mcp/0.1.0';
const SESSION_COOKIE_NAME = 'session';

const MANUAL_NET_WORTH_NOTES = [
  'Banks, cash, and property values are manual Watchlist entries, not live bank or title feeds.',
  'Live crypto wallet and exchange USD balances are computed in the Watchlist UI. The list API does not return those balances.',
];

export function createWatchlistClient(
  config: WatchlistClientConfig,
): WatchlistClient {
  const sessionToken = normalizeSessionToken(config.sessionToken);
  if (sessionToken.length === 0) {
    throw new Error(
      'Watchlist session token is empty. Set FINCOBRA_WATCHLIST_SESSION_TOKEN to the Identity session cookie from a signed-in Watchlist browser.',
    );
  }

  const baseUrl = normalizeBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL);
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async listSources() {
      return listWatchlistSources(fetchImpl, baseUrl, sessionToken);
    },
    async getSource(sourceId) {
      const id = sourceId.trim();
      if (id.length === 0) {
        throw new CheckoutApiError(400, 'sourceId is required');
      }

      const sources = await listWatchlistSources(
        fetchImpl,
        baseUrl,
        sessionToken,
      );
      const match = sources.find((source) => source.id === id);
      if (!match) {
        throw new CheckoutApiError(404, `Watchlist source not found: ${id}`);
      }
      return match;
    },
    async getNetWorth() {
      const sources = await listWatchlistSources(
        fetchImpl,
        baseUrl,
        sessionToken,
      );
      return buildNetWorth(sources);
    },
  };
}

async function listWatchlistSources(
  fetchImpl: WatchlistFetch,
  baseUrl: string,
  sessionToken: string,
): Promise<WatchlistSource[]> {
  const [walletsPayload, exchangesPayload, manualsPayload, fxPayload] =
    await Promise.all([
      requestJson(fetchImpl, baseUrl, sessionToken, '/api/watchlist/wallets'),
      requestJson(fetchImpl, baseUrl, sessionToken, '/api/watchlist/exchanges'),
      requestJson(
        fetchImpl,
        baseUrl,
        sessionToken,
        '/api/watchlist/manual-assets',
      ),
      requestJson(
        fetchImpl,
        baseUrl,
        sessionToken,
        '/api/watchlist/fx-rates',
      ).catch(() => null),
    ]);

  const usdRates = readUsdRates(fxPayload);
  const wallets = readArray(asRecord(walletsPayload)?.wallets);
  const exchanges = readArray(asRecord(exchangesPayload)?.exchanges);
  const manuals = readArray(asRecord(manualsPayload)?.manualAssets);

  return [
    ...wallets.map((wallet) => toWalletSource(wallet)),
    ...exchanges.map((exchange) => toExchangeSource(exchange)),
    ...manuals.map((asset) => toManualSource(asset, usdRates)),
  ];
}

function buildNetWorth(sources: WatchlistSource[]): WatchlistNetWorth {
  let banksUsd = 0;
  let cashUsd = 0;
  let propertyUsd = 0;
  let unpricedManualAssetCount = 0;
  let wallets = 0;
  let exchanges = 0;
  let manualAssets = 0;

  for (const source of sources) {
    if (source.kind === 'wallet') {
      wallets += 1;
      continue;
    }
    if (source.kind === 'exchange') {
      exchanges += 1;
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

    if (source.accountType === 'cash') {
      cashUsd += source.valueUsd;
    } else {
      banksUsd += source.valueUsd;
    }
  }

  return {
    banksUsd,
    cashUsd,
    propertyUsd,
    manualTotalUsd: banksUsd + cashUsd + propertyUsd,
    cryptoUsd: null,
    unpricedManualAssetCount,
    sourceCounts: { wallets, exchanges, manualAssets },
    notes: [...MANUAL_NET_WORTH_NOTES],
  };
}

async function requestJson(
  fetchImpl: WatchlistFetch,
  baseUrl: string,
  sessionToken: string,
  path: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        'User-Agent': USER_AGENT,
      },
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
    return `${apiMessage ?? 'forbidden'}. Set FINCOBRA_WATCHLIST_SESSION_TOKEN to a valid Identity session cookie from a signed-in Watchlist browser.`;
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
  };
}

function toManualSource(
  raw: unknown,
  usdRates: Record<string, number>,
): WatchlistSource {
  const record = asRecord(raw) ?? {};
  const id = readString(record.id) ?? 'unknown';
  const assetType =
    record.assetType === 'manual_property' ? 'manual_property' : 'manual_bank';
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

  return {
    id: `manual:${id}`,
    kind: assetType,
    label: name,
    blockchain: null,
    displayAddress: null,
    provider: null,
    currency,
    value,
    valueUsd:
      localValue === null || !currency
        ? null
        : convertCurrencyToUsd(localValue, currency, usdRates),
    accountType,
    mortgageBalance,
    tokenPnl: null,
  };
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

function normalizeSessionToken(value: string): string {
  return value
    .trim()
    .replace(/^session=/i, '')
    .trim();
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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
