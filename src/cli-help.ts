import { FINCOBRA_MCP_VERSION } from './version.js';

const CHECKOUT_SETTINGS_URL = 'https://fincobra.com/checkout/settings';
const WATCHLIST_URL = 'https://watch.fincobra.com';
const DOCS_URL = 'https://fincobra.com/docs/checkout/mcp.html';

export function getCliHelp(): string {
  return [
    `FinCobra MCP ${FINCOBRA_MCP_VERSION}`,
    '',
    'Run FinCobra Checkout and read-only Watchlist tools in an MCP client.',
    'npx installs the server on first use. A global install is not required.',
    '',
    'Setup',
    `1. Create or sign in to your FinCobra account: ${CHECKOUT_SETTINGS_URL}`,
    '2. Configure at least one credential in your MCP client environment:',
    '   FINCOBRA_CHECKOUT_API_KEY - Checkout dashboard API key (recommended)',
    '   FINCOBRA_CHECKOUT_SESSION_TOKEN - Checkout Identity session cookie',
    '   FINCOBRA_WATCHLIST_SESSION_TOKEN - Watchlist Identity session cookie',
    '   FINCOBRA_SESSION_TOKEN - Shared Checkout and Watchlist session cookie',
    '3. Set the MCP command to: npx -y fincobra-mcp',
    '4. Restart your MCP client.',
    '',
    `Watchlist sign-in: ${WATCHLIST_URL}`,
    `Documentation: ${DOCS_URL}`,
    '',
    'Keep credentials in your MCP client environment. Do not put them in chat.',
    '',
    'Options',
    '  -h, --help     Show this setup guide',
    '  -v, --version  Show the installed version',
    '',
  ].join('\n');
}

export function getMissingAuthMessage(): string {
  return [
    'FinCobra MCP is installed, but it is not connected to a FinCobra account.',
    `Sign in or create an account at ${CHECKOUT_SETTINGS_URL}.`,
    'Then set FINCOBRA_CHECKOUT_API_KEY or a FinCobra session-token variable in your MCP client environment.',
    'Run `npx -y fincobra-mcp --help` for the setup guide.',
  ].join('\n');
}
