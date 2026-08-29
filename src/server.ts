import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  handleAddCar,
  handleCreateInvoice,
  handleGetInvoice,
  handleGetNetWorth,
  handleGetSource,
  handleListSources,
} from './tools.js';
import type { CheckoutMcpServerOptions } from './server.types.js';
import { FINCOBRA_MCP_VERSION } from './version.js';

const invoiceSummarySchema = z.object({
  id: z.string(),
  paymentUrl: z.string(),
  status: z.string(),
  amountUsd: z.number(),
  receivedAmountUsd: z.number(),
  confirmedAmountUsd: z.number(),
  paymentCoverage: z.string().nullable(),
  remainingAmountUsd: z.number().nullable(),
  productName: z.string().nullable(),
  merchantReference: z.string().nullable(),
});

const createInvoiceInputSchema = z.object({
  amountUsd: z
    .number()
    .min(0.01)
    .describe(
      'Invoice amount in USD. Minimum 0.01. Settlement coins and chains come from the merchant Checkout payment methods, not this field.',
    ),
  description: z
    .string()
    .max(200)
    .optional()
    .describe('Product or service description shown on the invoice.'),
  merchantReference: z
    .string()
    .max(200)
    .optional()
    .describe('Your order or internal reference.'),
  customerEmail: z
    .string()
    .max(320)
    .optional()
    .describe('Customer email for reconciliation.'),
});

const getInvoiceInputSchema = z.object({
  invoiceId: z
    .string()
    .min(1)
    .describe('Invoice id returned by create_invoice.'),
});

const getSourceInputSchema = z.object({
  sourceId: z
    .string()
    .min(1)
    .describe(
      'Source id from list_sources, such as wallet:12, exchange:binance, or manual:3.',
    ),
});

const addCarInputSchema = z.object({
  name: z.string().trim().min(1).max(160).describe('Car name or description.'),
  currency: z
    .enum([
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
    ])
    .describe('Currency used for the estimated car value.'),
  value: z
    .number()
    .finite()
    .min(0)
    .max(1_000_000_000_000_000)
    .describe('Current estimated car value in the selected currency.'),
  note: z.string().trim().max(2000).optional(),
});

const watchlistSourceSchema = z.object({
  id: z.string(),
  kind: z.enum([
    'wallet',
    'exchange',
    'manual_bank',
    'manual_property',
    'manual_car',
  ]),
  label: z.string(),
  blockchain: z.string().nullable(),
  displayAddress: z.string().nullable(),
  provider: z.string().nullable(),
  currency: z.string().nullable(),
  value: z.number().nullable(),
  valueUsd: z.number().nullable(),
  accountType: z.enum(['bank', 'cash']).nullable(),
  mortgageBalance: z.number().nullable(),
  tokenPnl: z
    .array(
      z.object({
        asset: z.string(),
        costBasisUsd: z.number(),
        reliable: z.boolean(),
      }),
    )
    .nullable(),
  balances: z
    .array(
      z.object({
        asset: z.string(),
        balance: z.number(),
        valueUsd: z.number().nullable(),
      }),
    )
    .nullable(),
  valuationStatus: z.enum(['complete', 'partial', 'unavailable']),
});

const netWorthSchema = z.object({
  banksUsd: z.number(),
  cashUsd: z.number(),
  propertyUsd: z.number(),
  carsUsd: z.number(),
  manualTotalUsd: z.number(),
  pricedCryptoUsd: z.number(),
  cryptoUsd: z.number().nullable(),
  totalNetWorthUsd: z.number().nullable(),
  unpricedManualAssetCount: z.number(),
  sourceCounts: z.object({
    wallets: z.number(),
    exchanges: z.number(),
    manualAssets: z.number(),
  }),
  notes: z.array(z.string()),
});

export function createFincobraMcpServer(
  options: CheckoutMcpServerOptions = {},
): McpServer {
  const checkoutClient = options.checkoutClient ?? options.client;
  const server = new McpServer({
    name: 'fincobra',
    version: FINCOBRA_MCP_VERSION,
  });

  server.registerTool(
    'create_invoice',
    {
      title: 'Create Checkout invoice',
      description:
        'Create a FinCobra Checkout invoice in USD and return the hosted payment URL. Payment methods (Bitcoin, Ethereum USDT/USDC, Solana USDT/USDC, Arbitrum One USDC, Base USDC) are those enabled in the merchant dashboard.',
      inputSchema: createInvoiceInputSchema,
      outputSchema: invoiceSummarySchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async (input) => handleCreateInvoice(checkoutClient, input),
  );

  server.registerTool(
    'get_invoice',
    {
      title: 'Get Checkout invoice',
      description:
        'Look up a known FinCobra Checkout invoice by id. Returns status, hosted payment URL, and amounts.',
      inputSchema: getInvoiceInputSchema,
      outputSchema: invoiceSummarySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => handleGetInvoice(checkoutClient, input),
  );

  server.registerTool(
    'get_net_worth',
    {
      title: 'Get Watchlist net worth',
      description:
        'Read Watchlist net worth with live wallet and exchange balances. Banks, cash, property, and cars are manual entries. When a live source cannot be valued, cryptoUsd and totalNetWorthUsd are null and pricedCryptoUsd contains the available subtotal.',
      outputSchema: netWorthSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () => handleGetNetWorth(options.watchlistClient),
  );

  server.registerTool(
    'list_sources',
    {
      title: 'List Watchlist sources',
      description:
        'List Watchlist wallets, exchanges, and manual bank, cash, property, or car sources. Includes live crypto balances and stored token PnL cost-basis rows when available.',
      outputSchema: z.object({ sources: z.array(watchlistSourceSchema) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () => handleListSources(options.watchlistClient),
  );

  server.registerTool(
    'get_source',
    {
      title: 'Get Watchlist source',
      description:
        'Look up one Watchlist source by the id returned from list_sources.',
      inputSchema: getSourceInputSchema,
      outputSchema: watchlistSourceSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => handleGetSource(options.watchlistClient, input),
  );

  server.registerTool(
    'add_car',
    {
      title: 'Add Watchlist car',
      description:
        'Add a car to Watchlist as a manual asset using its current estimated value.',
      inputSchema: addCarInputSchema,
      outputSchema: watchlistSourceSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async (input) => handleAddCar(options.watchlistClient, input),
  );

  return server;
}

export function createCheckoutMcpServer(
  options: CheckoutMcpServerOptions,
): McpServer {
  return createFincobraMcpServer(options);
}
