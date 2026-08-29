import { normalizeBaseUrl } from './checkout-client.js';
import type {
  DeviceAuthorization,
  FincobraLoginSession,
  FincobraSessionStatus,
  McpAccessScope,
} from './auth-client.types.js';

const DEFAULT_AUTH_BASE_URL = 'https://watch.fincobra.com';
const REQUEST_TIMEOUT_MS = 30_000;
const LOGIN_SCOPES: McpAccessScope[] = [
  'watchlist:read',
  'checkout:read',
  'checkout:write',
];

export function getAuthBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return normalizeBaseUrl(
    env.FINCOBRA_AUTH_BASE_URL?.trim() || DEFAULT_AUTH_BASE_URL,
  );
}

export async function createDeviceAuthorization(
  authBaseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DeviceAuthorization> {
  return requestJson<DeviceAuthorization>(
    fetchImpl,
    `${authBaseUrl}/api/mcp/device`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scopes: LOGIN_SCOPES }),
    },
  );
}

export async function pollDeviceAuthorization(
  authBaseUrl: string,
  authorization: DeviceAuthorization,
  fetchImpl: typeof fetch = fetch,
): Promise<FincobraLoginSession> {
  const deadline = Date.now() + authorization.expiresIn * 1000;
  while (Date.now() < deadline) {
    const response = await fetchImpl(`${authBaseUrl}/api/mcp/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceCode: authorization.deviceCode }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 202) {
      await wait(authorization.interval * 1000);
      continue;
    }
    return readResponse<FincobraLoginSession>(response);
  }
  throw new Error('FinCobra login expired. Run the login command again.');
}

export async function getSessionStatus(
  authBaseUrl: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FincobraSessionStatus> {
  return requestJson<FincobraSessionStatus>(
    fetchImpl,
    `${authBaseUrl}/api/mcp/session`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}

export async function revokeSession(
  authBaseUrl: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await requestJson(fetchImpl, `${authBaseUrl}/api/mcp/session`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function requestJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    throw new Error(`Could not reach FinCobra: ${errorMessage(error)}`);
  }
  return readResponse<T>(response);
}

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    throw new Error(
      readError(payload) ?? `FinCobra returned HTTP ${response.status}`,
    );
  }
  return payload as T;
}

function readError(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
    ? value.error
    : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
