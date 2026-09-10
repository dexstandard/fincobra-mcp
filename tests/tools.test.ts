import { describe, expect, it } from 'vitest';
import { CheckoutApiError } from '../src/checkout-client.js';
import type {
  CheckoutClient,
  CheckoutInvoiceSummary,
} from '../src/checkout-client.types.js';
import { handleCreateInvoice, handleGetInvoice } from '../src/tools.js';

const invoice: CheckoutInvoiceSummary = {
  id: 'inv_1',
  paymentUrl: 'https://fincobra.com/pay/inv_1',
  status: 'awaiting_payment',
  amountUsd: 12.5,
  receivedAmountUsd: 0,
  confirmedAmountUsd: 0,
  paymentCoverage: 'no_payment',
  remainingAmountUsd: 12.5,
  productName: 'MCP demo',
  merchantReference: 'demo',
};

describe('checkout MCP tools', () => {
  it('returns the pay URL from create_invoice', async () => {
    const client: CheckoutClient = {
      async createInvoice(input) {
        expect(input).toEqual({
          amountUsd: 12.5,
          description: 'MCP demo',
          merchantReference: 'demo',
          customerEmail: undefined,
        });
        return invoice;
      },
      async getInvoice() {
        throw new Error('unused');
      },
    };

    const result = await handleCreateInvoice(client, {
      amountUsd: 12.5,
      description: 'MCP demo',
      merchantReference: 'demo',
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual(invoice);
    expect(result.content[0]?.text).toContain('https://fincobra.com/pay/inv_1');
  });

  it('returns invoice status from get_invoice', async () => {
    const client: CheckoutClient = {
      async createInvoice() {
        throw new Error('unused');
      },
      async getInvoice(invoiceId) {
        expect(invoiceId).toBe('inv_1');
        return { ...invoice, status: 'confirmed', confirmedAmountUsd: 12.5 };
      },
    };

    const result = await handleGetInvoice(client, { invoiceId: 'inv_1' });
    expect(result.structuredContent?.status).toBe('confirmed');
    expect(result.structuredContent?.confirmedAmountUsd).toBe(12.5);
  });

  it('surfaces Checkout API errors to the agent', async () => {
    const client: CheckoutClient = {
      async createInvoice() {
        throw new CheckoutApiError(
          401,
          'Invalid API key. Set FINCOBRA_CHECKOUT_API_KEY to a valid Checkout API key.',
        );
      },
      async getInvoice() {
        throw new Error('unused');
      },
    };

    const result = await handleCreateInvoice(client, { amountUsd: 1 });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Invalid API key');
  });

  it('explains missing Checkout authorization', async () => {
    const result = await handleCreateInvoice(undefined, { amountUsd: 1 });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(
      'approve Checkout access in the browser',
    );
  });
});
