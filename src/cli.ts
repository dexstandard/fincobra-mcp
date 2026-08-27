#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createCheckoutClient } from './checkout-client.js';
import { CheckoutMcpEnvError, readFincobraMcpEnv } from './env.js';
import { createFincobraMcpServer } from './server.js';
import { createWatchlistClient } from './watchlist-client.js';

function main(): void {
  const env = readFincobraMcpEnv();
  const checkoutClient = env.checkout
    ? createCheckoutClient({
        apiKey: env.checkout.apiKey,
        baseUrl: env.checkout.baseUrl,
      })
    : undefined;
  const watchlistClient = env.watchlist
    ? createWatchlistClient({
        sessionToken: env.watchlist.sessionToken,
        baseUrl: env.watchlist.baseUrl,
      })
    : undefined;

  serveStdio(
    () =>
      createFincobraMcpServer({
        checkoutClient,
        watchlistClient,
      }),
    {
      onerror(error) {
        process.stderr.write(`${error.message}\n`);
      },
    },
  );
}

try {
  main();
} catch (err: unknown) {
  const message =
    err instanceof CheckoutMcpEnvError || err instanceof Error
      ? err.message
      : String(err);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
