import type {
  CheckoutClient,
  CheckoutClientConfig,
  CheckoutFetch,
  CheckoutInvoiceSummary,
} from './checkout-client.types.js';
import { FINCOBRA_MCP_VERSION } from './version.js';

const DEFAULT_BASE_URL = 'https://fincobra.com';
const REQUEST_TIMEOUT_MS = 30_000;
const USER_AGENT = `fincobra-mcp/${FINCOBRA_MCP_VERSION}`;

type CheckoutAuth =
  | { type: 'api_key'; value: string }
  | { type: 'browser_login'; value: string };

export class CheckoutApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'CheckoutApiError';
    this.statusCode = statusCode;
  }
}

export function createCheckoutClient(
  config: CheckoutClientConfig,
): CheckoutClient {
  const auth = resolveCheckoutAuth(config);
  if (!auth) {
    throw new Error(
      'Checkout authentication is missing. Connect FinCobra in your MCP client and approve Checkout access in the browser.',
    );
  }

  const baseUrl = normalizeBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL);
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    createInvoice(input) {
      return requestInvoice(fetchImpl, {
        auth,
        baseUrl,
        method: 'POST',
        path: '/api/checkout/invoices',
        body: {
          amountUsd: input.amountUsd,
          ...(input.description === undefined
            ? {}
            : { productName: input.description }),
          ...(input.merchantReference === undefined
            ? {}
            : { merchantReference: input.merchantReference }),
          ...(input.customerEmail === undefined
            ? {}
            : { customerEmail: input.customerEmail }),
        },
      });
    },
    async getInvoice(invoiceId) {
      const id = invoiceId.trim();
      if (id.length === 0) {
        throw new CheckoutApiError(400, 'invoiceId is required');
      }

      return requestInvoice(fetchImpl, {
        auth,
        baseUrl,
        method: 'GET',
        path: `/api/checkout/invoices/${encodeURIComponent(id)}`,
      });
    },
  };
}

interface RequestInvoiceOptions {
  auth: CheckoutAuth;
  baseUrl: string;
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
}

async function requestInvoice(
  fetchImpl: CheckoutFetch,
  options: RequestInvoiceOptions,
): Promise<CheckoutInvoiceSummary> {
  let response: Response;
  try {
    response = await fetchImpl(`${options.baseUrl}${options.path}`, {
      method: options.method,
      headers: {
        Accept: 'application/json',
        ...checkoutAuthHeaders(options.auth),
        'User-Agent': USER_AGENT,
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    throw new CheckoutApiError(
      0,
      `Failed to reach Checkout at ${options.baseUrl}: ${errorMessage(err)}`,
    );
  }

  const payload = await readJsonBody(response);
  if (!response.ok) {
    throw new CheckoutApiError(
      response.status,
      formatCheckoutHttpError(response.status, payload, options.auth.type),
    );
  }

  return toInvoiceSummary(payload);
}

function resolveCheckoutAuth(
  config: CheckoutClientConfig,
): CheckoutAuth | null {
  const apiKey = normalizeCredential(config.apiKey);
  if (apiKey) {
    return { type: 'api_key', value: apiKey };
  }

  const accessToken = normalizeCredential(config.accessToken);
  return accessToken ? { type: 'browser_login', value: accessToken } : null;
}

function checkoutAuthHeaders(auth: CheckoutAuth): Record<string, string> {
  if (auth.type === 'api_key') {
    return { 'X-Api-Key': auth.value };
  }

  return { Authorization: `Bearer ${auth.value}` };
}

function normalizeCredential(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatCheckoutHttpError(
  statusCode: number,
  payload: unknown,
  authType: CheckoutAuth['type'],
): string {
  const apiMessage = readApiErrorMessage(payload);

  if (statusCode === 401) {
    return authType === 'api_key'
      ? `${apiMessage ?? 'Invalid API key'}. Set FINCOBRA_CHECKOUT_API_KEY to a valid Checkout API key.`
      : `${apiMessage ?? 'FinCobra login expired'}. Reconnect FinCobra in your MCP client to renew browser authorization.`;
  }

  if (apiMessage) {
    return apiMessage;
  }

  if (statusCode === 404) {
    return 'Invoice not found';
  }

  if (statusCode === 429) {
    return 'Checkout rate limit exceeded. Retry after the time shown by the API.';
  }

  return `Checkout request failed with HTTP ${statusCode}`;
}

function toInvoiceSummary(payload: unknown): CheckoutInvoiceSummary {
  const record = asRecord(payload);
  if (!record) {
    throw new CheckoutApiError(
      0,
      'Checkout returned an unexpected invoice payload.',
    );
  }

  const id = readString(record.id);
  const paymentUrl = readString(record.paymentUrl);
  const status = readString(record.status);
  const amountUsd = readNumber(record.amountUsd);
  if (!id || !paymentUrl || !status || amountUsd === null) {
    throw new CheckoutApiError(
      0,
      'Checkout returned an unexpected invoice payload.',
    );
  }

  const paymentSummary = asRecord(record.paymentSummary);

  return {
    id,
    paymentUrl,
    status,
    amountUsd,
    receivedAmountUsd: readNumber(record.receivedAmountUsd) ?? 0,
    confirmedAmountUsd: readNumber(record.confirmedAmountUsd) ?? 0,
    paymentCoverage: readString(record.paymentCoverage),
    remainingAmountUsd: readNumber(paymentSummary?.remainingAmountUsd),
    productName: readString(record.productName),
    merchantReference: readString(record.merchantReference),
  };
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

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.length === 0) {
    throw new Error(
      'FINCOBRA_CHECKOUT_BASE_URL is empty. Use https://fincobra.com or https://dev.fincobra.com.',
    );
  }

  return trimmed;
}
