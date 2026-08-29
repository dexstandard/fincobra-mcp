import { CheckoutApiError, createCheckoutClient } from './checkout-client.js';
import { CheckoutMcpEnvError, readFincobraMcpEnv } from './env.js';
import { createWatchlistClient } from './watchlist-client.js';

async function main(): Promise<void> {
  const env = readFincobraMcpEnv();
  const result: Record<string, unknown> = {};

  if (env.checkout) {
    const client = createCheckoutClient({
      apiKey: env.checkout.apiKey,
      accessToken: env.checkout.accessToken,
      baseUrl: env.checkout.baseUrl,
    });
    const created = await client.createInvoice({
      amountUsd: 1,
      description: 'MCP smoke test',
      merchantReference: 'mcp-smoke',
    });
    result.checkout = {
      baseUrl: env.checkout.baseUrl,
      created,
      fetched: await client.getInvoice(created.id),
    };
  }

  if (env.watchlist) {
    const client = createWatchlistClient({
      accessToken: env.watchlist.accessToken,
      baseUrl: env.watchlist.baseUrl,
    });
    const sources = await client.listSources();
    result.watchlist = {
      baseUrl: env.watchlist.baseUrl,
      netWorth: await client.getNetWorth(),
      sourceCount: sources.length,
      firstSource: sources[0] ?? null,
    };
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

void main().catch((err: unknown) => {
  const message =
    err instanceof CheckoutMcpEnvError ||
    err instanceof CheckoutApiError ||
    err instanceof Error
      ? err.message
      : String(err);
  process.stderr.write(`${message}\n`);
  process.stderr.write(
    'Run `npx -y fincobra-mcp login` or set FINCOBRA_CHECKOUT_API_KEY, then rerun npm run smoke.\n',
  );
  process.exitCode = 1;
});
