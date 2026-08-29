import { normalizeBaseUrl } from './checkout-client.js';
import { getMissingAuthMessage } from './cli-help.js';
import type {
  CheckoutMcpEnv,
  FincobraMcpEnv,
  WatchlistMcpEnv,
} from './env.types.js';
import type { StoredCredential } from './credentials.types.js';

const DEFAULT_CHECKOUT_BASE_URL = 'https://fincobra.com';
const DEFAULT_WATCHLIST_BASE_URL = 'https://watch.fincobra.com';

export class CheckoutMcpEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutMcpEnvError';
  }
}

export function readFincobraMcpEnv(
  env: NodeJS.ProcessEnv = process.env,
  credential: StoredCredential | null = null,
): FincobraMcpEnv {
  const checkout = readCheckoutEnv(env, credential);
  const watchlist = readWatchlistEnv(env, credential);
  return { checkout, watchlist };
}

export function readCheckoutMcpEnv(
  env: NodeJS.ProcessEnv = process.env,
  credential: StoredCredential | null = null,
): CheckoutMcpEnv {
  const checkout = readCheckoutEnv(env, credential);
  if (!checkout) {
    throw new CheckoutMcpEnvError(getMissingAuthMessage());
  }

  return checkout;
}

function readCheckoutEnv(
  env: NodeJS.ProcessEnv,
  credential: StoredCredential | null,
): CheckoutMcpEnv | null {
  const apiKey = firstNonEmpty(
    env.FINCOBRA_CHECKOUT_API_KEY,
    env.FINCOBRA_API_KEY,
  );
  const configuredBaseUrl = firstNonEmpty(env.FINCOBRA_CHECKOUT_BASE_URL);
  const baseUrl = configuredBaseUrl
    ? normalizeBaseUrl(configuredBaseUrl)
    : DEFAULT_CHECKOUT_BASE_URL;
  if (apiKey) {
    return { apiKey, baseUrl };
  }
  if (credential) {
    return { accessToken: credential.accessToken, baseUrl };
  }

  return null;
}

function readWatchlistEnv(
  env: NodeJS.ProcessEnv,
  credential: StoredCredential | null,
): WatchlistMcpEnv | null {
  if (!credential) {
    return null;
  }

  const configuredBaseUrl = firstNonEmpty(env.FINCOBRA_WATCHLIST_BASE_URL);
  return {
    accessToken: credential.accessToken,
    baseUrl: configuredBaseUrl
      ? normalizeBaseUrl(configuredBaseUrl)
      : DEFAULT_WATCHLIST_BASE_URL,
  };
}

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}
