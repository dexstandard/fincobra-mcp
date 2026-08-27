import { normalizeBaseUrl } from './checkout-client.js';
import type {
  CheckoutMcpEnv,
  FincobraMcpEnv,
  WatchlistMcpEnv,
} from './env.types.js';

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
): FincobraMcpEnv {
  const checkout = readCheckoutEnv(env);
  const watchlist = readWatchlistEnv(env);
  if (!checkout && !watchlist) {
    throw new CheckoutMcpEnvError(
      'Set FINCOBRA_CHECKOUT_API_KEY and/or FINCOBRA_WATCHLIST_SESSION_TOKEN. Checkout uses a dashboard API key. Watchlist has no public API key and uses the Identity session cookie from a signed-in Watchlist browser.',
    );
  }

  return { checkout, watchlist };
}

export function readCheckoutMcpEnv(
  env: NodeJS.ProcessEnv = process.env,
): CheckoutMcpEnv {
  const checkout = readCheckoutEnv(env);
  if (!checkout) {
    throw new CheckoutMcpEnvError(
      'FINCOBRA_CHECKOUT_API_KEY is required. Create a Checkout API key in the dashboard and set it in your MCP server env.',
    );
  }

  return checkout;
}

function readCheckoutEnv(env: NodeJS.ProcessEnv): CheckoutMcpEnv | null {
  const apiKey = firstNonEmpty(
    env.FINCOBRA_CHECKOUT_API_KEY,
    env.FINCOBRA_API_KEY,
  );
  if (!apiKey) {
    return null;
  }

  const configuredBaseUrl = firstNonEmpty(env.FINCOBRA_CHECKOUT_BASE_URL);
  return {
    apiKey,
    baseUrl: configuredBaseUrl
      ? normalizeBaseUrl(configuredBaseUrl)
      : DEFAULT_CHECKOUT_BASE_URL,
  };
}

function readWatchlistEnv(env: NodeJS.ProcessEnv): WatchlistMcpEnv | null {
  const sessionToken = firstNonEmpty(
    env.FINCOBRA_WATCHLIST_SESSION_TOKEN,
    env.FINCOBRA_SESSION_TOKEN,
  );
  if (!sessionToken) {
    return null;
  }

  const configuredBaseUrl = firstNonEmpty(env.FINCOBRA_WATCHLIST_BASE_URL);
  return {
    sessionToken,
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
