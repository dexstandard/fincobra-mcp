#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { getCliHelp } from './cli-help.js';
import { createCheckoutClient } from './checkout-client.js';
import { CheckoutMcpEnvError, readFincobraMcpEnv } from './env.js';
import { createFincobraMcpServer } from './server.js';
import { FINCOBRA_MCP_VERSION } from './version.js';
import { createWatchlistClient } from './watchlist-client.js';

function main(): void {
  const command = process.argv[2];
  if (command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(getCliHelp());
    return;
  }
  if (command === '--version' || command === '-v' || command === 'version') {
    process.stdout.write(`${FINCOBRA_MCP_VERSION}\n`);
    return;
  }
  if (command !== undefined) {
    throw new Error(
      `Unknown option: ${command}. Run \`npx -y fincobra-mcp --help\` for usage.`,
    );
  }

  const env = readFincobraMcpEnv();
  const checkoutClient = env.checkout
    ? createCheckoutClient({
        apiKey: env.checkout.apiKey,
        sessionToken: env.checkout.sessionToken,
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
