import { CheckoutApiError } from './checkout-client.js';
import type {
  CheckoutClient,
  CheckoutInvoiceSummary,
} from './checkout-client.types.js';
import type {
  CheckoutMcpToolResult,
  AddWatchlistCarToolInput,
  CreateInvoiceToolInput,
  GetInvoiceToolInput,
  GetWatchlistSourceInput,
  WatchlistReportingInput,
} from './server.types.js';
import type {
  WatchlistClient,
  WatchlistNetWorth,
  WatchlistSource,
} from './watchlist-client.types.js';

const CHECKOUT_NOT_CONFIGURED =
  'FinCobra MCP is not signed in. Run `npx -y fincobra-mcp login`. Checkout can also use FINCOBRA_CHECKOUT_API_KEY.';
const WATCHLIST_NOT_CONFIGURED =
  'FinCobra MCP is not signed in. Run `npx -y fincobra-mcp login`.';

export async function handleCreateInvoice(
  client: CheckoutClient | undefined,
  input: CreateInvoiceToolInput,
): Promise<CheckoutMcpToolResult> {
  if (!client) {
    return errorResult(CHECKOUT_NOT_CONFIGURED);
  }

  try {
    const invoice = await client.createInvoice({
      amountUsd: input.amountUsd,
      description: input.description,
      merchantReference: input.merchantReference,
      customerEmail: input.customerEmail,
    });
    return successResult(invoice);
  } catch (err: unknown) {
    return errorResult(err);
  }
}

export async function handleGetInvoice(
  client: CheckoutClient | undefined,
  input: GetInvoiceToolInput,
): Promise<CheckoutMcpToolResult> {
  if (!client) {
    return errorResult(CHECKOUT_NOT_CONFIGURED);
  }

  try {
    const invoice = await client.getInvoice(input.invoiceId);
    return successResult(invoice);
  } catch (err: unknown) {
    return errorResult(err);
  }
}

export async function handleGetNetWorth(
  client: WatchlistClient | undefined,
  input: WatchlistReportingInput = {},
): Promise<CheckoutMcpToolResult> {
  if (!client) {
    return errorResult(WATCHLIST_NOT_CONFIGURED);
  }

  try {
    return successResult(await client.getNetWorth(input.currency));
  } catch (err: unknown) {
    return errorResult(err);
  }
}

export async function handleListSources(
  client: WatchlistClient | undefined,
  input: WatchlistReportingInput = {},
): Promise<CheckoutMcpToolResult> {
  if (!client) {
    return errorResult(WATCHLIST_NOT_CONFIGURED);
  }

  try {
    return successResult({ sources: await client.listSources(input.currency) });
  } catch (err: unknown) {
    return errorResult(err);
  }
}

export async function handleGetSource(
  client: WatchlistClient | undefined,
  input: GetWatchlistSourceInput,
): Promise<CheckoutMcpToolResult> {
  if (!client) {
    return errorResult(WATCHLIST_NOT_CONFIGURED);
  }

  try {
    return successResult(
      await client.getSource(input.sourceId, input.currency),
    );
  } catch (err: unknown) {
    return errorResult(err);
  }
}

export async function handleAddCar(
  client: WatchlistClient | undefined,
  input: AddWatchlistCarToolInput,
): Promise<CheckoutMcpToolResult> {
  if (!client) {
    return errorResult(WATCHLIST_NOT_CONFIGURED);
  }

  try {
    return successResult(await client.addCar(input));
  } catch (err: unknown) {
    return errorResult(err);
  }
}

function successResult(
  payload:
    | CheckoutInvoiceSummary
    | WatchlistNetWorth
    | WatchlistSource
    | { sources: WatchlistSource[] },
): CheckoutMcpToolResult {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(payload, null, 2) },
    ],
    structuredContent: payload,
  };
}

function errorResult(err: unknown): CheckoutMcpToolResult {
  const message =
    err instanceof CheckoutApiError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);

  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}
