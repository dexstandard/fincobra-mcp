import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CheckoutApiError,
  createCheckoutClient,
  normalizeBaseUrl,
} from '../src/checkout-client.js';
import type { CheckoutFetch } from '../src/checkout-client.types.js';

const invoicePayload = {
  id: 'a1b2c3d4-1111-4222-8333-abcdefabcdef',
  paymentUrl: 'https://fincobra.com/pay/a1b2c3d4-1111-4222-8333-abcdefabcdef',
  status: 'awaiting_payment',
  amountUsd: 49.99,
  receivedAmountUsd: 0,
  confirmedAmountUsd: 0,
  paymentCoverage: 'no_payment',
  productName: 'Pro Plan',
  merchantReference: 'order_123',
  paymentSummary: {
    remainingAmountUsd: 49.99,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createCheckoutClient', () => {
  it('creates an invoice with X-Api-Key and maps the hosted pay URL', async () => {
    const fetchImpl = vi.fn<CheckoutFetch>(async (_url, init) => {
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        'X-Api-Key': 'fc_live_test',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        amountUsd: 49.99,
        productName: 'Pro Plan',
        merchantReference: 'order_123',
        customerEmail: 'buyer@example.com',
      });
      return jsonResponse(201, invoicePayload);
    });

    const client = createCheckoutClient({
      apiKey: 'fc_live_test',
      fetchImpl,
    });
    const invoice = await client.createInvoice({
      amountUsd: 49.99,
      description: 'Pro Plan',
      merchantReference: 'order_123',
      customerEmail: 'buyer@example.com',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://fincobra.com/api/checkout/invoices',
      expect.any(Object),
    );
    expect(invoice).toEqual({
      id: invoicePayload.id,
      paymentUrl: invoicePayload.paymentUrl,
      status: 'awaiting_payment',
      amountUsd: 49.99,
      receivedAmountUsd: 0,
      confirmedAmountUsd: 0,
      paymentCoverage: 'no_payment',
      remainingAmountUsd: 49.99,
      productName: 'Pro Plan',
      merchantReference: 'order_123',
    });
  });

  it('gets a known invoice by id', async () => {
    const fetchImpl = vi.fn<CheckoutFetch>(async (url) => {
      expect(url).toBe(
        'https://dev.fincobra.com/api/checkout/invoices/a1b2c3d4-1111-4222-8333-abcdefabcdef',
      );
      return jsonResponse(200, {
        ...invoicePayload,
        status: 'payment_detected',
        receivedAmountUsd: 49.99,
        paymentCoverage: 'exact_payment',
        paymentSummary: {
          remainingAmountUsd: 0,
        },
      });
    });

    const client = createCheckoutClient({
      apiKey: 'fc_live_test',
      baseUrl: 'https://dev.fincobra.com/',
      fetchImpl,
    });
    const invoice = await client.getInvoice(
      'a1b2c3d4-1111-4222-8333-abcdefabcdef',
    );

    expect(invoice.status).toBe('payment_detected');
    expect(invoice.receivedAmountUsd).toBe(49.99);
    expect(invoice.remainingAmountUsd).toBe(0);
  });

  it('creates an invoice with a browser login credential', async () => {
    const fetchImpl = vi.fn<CheckoutFetch>(async (_url, init) => {
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer fcm_checkout',
        'Content-Type': 'application/json',
      });
      expect(init?.headers).not.toHaveProperty('X-Api-Key');
      return jsonResponse(201, invoicePayload);
    });

    const client = createCheckoutClient({
      accessToken: 'fcm_checkout',
      fetchImpl,
    });

    await client.createInvoice({ amountUsd: 49.99 });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('prefers the Checkout API key when both credentials are set', async () => {
    const fetchImpl = vi.fn<CheckoutFetch>(async (_url, init) => {
      expect(init?.headers).toMatchObject({
        'X-Api-Key': 'fc_live_test',
      });
      expect(init?.headers).not.toHaveProperty('Authorization');
      return jsonResponse(201, invoicePayload);
    });

    const client = createCheckoutClient({
      apiKey: 'fc_live_test',
      accessToken: 'fcm_checkout',
      fetchImpl,
    });

    await client.createInvoice({ amountUsd: 49.99 });
  });

  it('explains an invalid API key', async () => {
    const client = createCheckoutClient({
      apiKey: 'fc_live_bad',
      fetchImpl: async () => jsonResponse(401, { error: 'Invalid API key' }),
    });

    await expect(client.createInvoice({ amountUsd: 1 })).rejects.toMatchObject({
      name: 'CheckoutApiError',
      statusCode: 401,
      message:
        'Invalid API key. Set FINCOBRA_CHECKOUT_API_KEY to a valid Checkout API key.',
    });
  });

  it('explains an expired browser login', async () => {
    const client = createCheckoutClient({
      accessToken: 'fcm_expired',
      fetchImpl: async () =>
        jsonResponse(401, { error: 'Invalid FinCobra login' }),
    });

    await expect(client.createInvoice({ amountUsd: 1 })).rejects.toMatchObject({
      name: 'CheckoutApiError',
      statusCode: 401,
      message: 'Invalid FinCobra login. Run `npx -y fincobra-mcp login` again.',
    });
  });

  it('passes through Checkout validation errors', async () => {
    const client = createCheckoutClient({
      apiKey: 'fc_live_test',
      fetchImpl: async () =>
        jsonResponse(400, { error: 'amountUsd must be at least 0.01' }),
    });

    await expect(client.createInvoice({ amountUsd: 0 })).rejects.toBeInstanceOf(
      CheckoutApiError,
    );
    await expect(client.createInvoice({ amountUsd: 0 })).rejects.toThrow(
      'amountUsd must be at least 0.01',
    );
  });

  it('maps invoice lookup failures', async () => {
    const client = createCheckoutClient({
      apiKey: 'fc_live_test',
      fetchImpl: async () => jsonResponse(404, { error: 'Invoice not found' }),
    });

    await expect(client.getInvoice('missing')).rejects.toThrow(
      'Invoice not found',
    );
  });

  it('rejects an empty invoice id before calling Checkout', async () => {
    const fetchImpl = vi.fn<CheckoutFetch>(async () => {
      throw new Error('should not fetch');
    });
    const client = createCheckoutClient({
      apiKey: 'fc_live_test',
      fetchImpl,
    });

    await expect(client.getInvoice('   ')).rejects.toThrow(
      'invoiceId is required',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects empty Checkout credentials', () => {
    expect(() => createCheckoutClient({ apiKey: '   ' })).toThrow(
      'Checkout authentication is missing',
    );
  });
});

describe('normalizeBaseUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizeBaseUrl('https://fincobra.com/')).toBe(
      'https://fincobra.com',
    );
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
