#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import {
  createDeviceAuthorization,
  getAuthBaseUrl,
  getSessionStatus,
  pollDeviceAuthorization,
  revokeSession,
} from './auth-client.js';
import type { FincobraAccount } from './auth-client.types.js';
import { openBrowser } from './browser.js';
import { getCliHelp } from './cli-help.js';
import { createCheckoutClient } from './checkout-client.js';
import {
  deleteStoredCredential,
  readStoredCredential,
  writeStoredCredential,
} from './credentials.js';
import { readFincobraMcpEnv } from './env.js';
import { createFincobraMcpServer } from './server.js';
import { FINCOBRA_MCP_VERSION } from './version.js';
import { createWatchlistClient } from './watchlist-client.js';

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(getCliHelp());
    return;
  }
  if (command === '--version' || command === '-v' || command === 'version') {
    process.stdout.write(`${FINCOBRA_MCP_VERSION}\n`);
    return;
  }
  if (command === 'login') {
    await login();
    return;
  }
  if (command === 'status') {
    await status();
    return;
  }
  if (command === 'logout') {
    await logout();
    return;
  }
  if (command !== undefined) {
    throw new Error(
      `Unknown option: ${command}. Run \`npx -y fincobra-mcp --help\` for usage.`,
    );
  }

  const credential = await readStoredCredential();
  const env = readFincobraMcpEnv(process.env, credential);
  const checkoutClient = env.checkout
    ? createCheckoutClient({
        apiKey: env.checkout.apiKey,
        accessToken: env.checkout.accessToken,
        baseUrl: env.checkout.baseUrl,
      })
    : undefined;
  const watchlistClient = env.watchlist
    ? createWatchlistClient({
        accessToken: env.watchlist.accessToken,
        baseUrl: env.watchlist.baseUrl,
      })
    : undefined;

  serveStdio(
    () => createFincobraMcpServer({ checkoutClient, watchlistClient }),
    {
      onerror(error) {
        process.stderr.write(`${error.message}\n`);
      },
    },
  );
}

async function login(): Promise<void> {
  const existing = await readStoredCredential();
  if (existing) {
    try {
      const session = await getSessionStatus(
        existing.authBaseUrl,
        existing.accessToken,
      );
      process.stdout.write(
        `Already signed in to FinCobra as ${accountLabel(session.account)}.\n`,
      );
      return;
    } catch {
      await deleteStoredCredential();
    }
  }

  const authBaseUrl = getAuthBaseUrl();
  const authorization = await createDeviceAuthorization(authBaseUrl);
  process.stdout.write(
    [
      'Sign in to FinCobra in your browser, then approve the CLI request.',
      `CLI code: ${authorization.userCode}`,
      `Approval page: ${authorization.verificationUriComplete}`,
      '',
      'Waiting for browser approval…',
      '',
    ].join('\n'),
  );
  await openBrowser(authorization.verificationUriComplete);
  const session = await pollDeviceAuthorization(authBaseUrl, authorization);
  const label = accountLabel(session.account);
  await writeStoredCredential({
    version: 1,
    authBaseUrl,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    accountLabel: label,
  });
  process.stdout.write(
    `Signed in to FinCobra as ${label}. The MCP server can now access the approved account.\n`,
  );
}

async function status(): Promise<void> {
  const credential = await readStoredCredential();
  if (!credential) {
    process.stdout.write(
      'Not signed in to FinCobra. Run `npx -y fincobra-mcp login`.\n',
    );
    return;
  }
  try {
    const session = await getSessionStatus(
      credential.authBaseUrl,
      credential.accessToken,
    );
    process.stdout.write(
      `Signed in to FinCobra as ${accountLabel(session.account)}. Credential expires ${session.expiresAt}.\n`,
    );
  } catch {
    await deleteStoredCredential();
    process.stdout.write(
      'The saved FinCobra login is no longer valid. Run `npx -y fincobra-mcp login`.\n',
    );
  }
}

async function logout(): Promise<void> {
  const credential = await readStoredCredential();
  if (!credential) {
    process.stdout.write('Already signed out of FinCobra.\n');
    return;
  }
  try {
    await revokeSession(credential.authBaseUrl, credential.accessToken);
  } finally {
    await deleteStoredCredential();
  }
  process.stdout.write('Signed out of FinCobra.\n');
}

function accountLabel(account: FincobraAccount): string {
  return account.email ?? account.walletAddress ?? account.id;
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
