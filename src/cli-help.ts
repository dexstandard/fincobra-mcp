import { FINCOBRA_MCP_VERSION } from './version.js';

const DOCS_URL = 'https://fincobra.com/docs/checkout/mcp.html';

export function getCliHelp(): string {
  return [
    `FinCobra MCP ${FINCOBRA_MCP_VERSION}`,
    '',
    'Run FinCobra Checkout and Watchlist tools in an MCP client.',
    'npx installs the server on first use. A global install is not required.',
    '',
    'Setup',
    '1. Run: npx -y fincobra-mcp login',
    '2. Complete FinCobra sign-in in the browser if needed.',
    '3. Review the access request and select Approve.',
    '4. Set the MCP command to: npx -y fincobra-mcp',
    '5. Restart your MCP client.',
    '',
    'The CLI stores a separate revocable credential. You do not copy browser cookies or tokens.',
    'Checkout can alternatively use FINCOBRA_CHECKOUT_API_KEY.',
    '',
    'Commands',
    '  login          Sign in through the browser',
    '  status         Check the saved FinCobra login',
    '  logout         Revoke and remove the saved login',
    '  -h, --help     Show this setup guide',
    '  -v, --version  Show the installed version',
    '',
    `Documentation: ${DOCS_URL}`,
    '',
  ].join('\n');
}

export function getMissingAuthMessage(): string {
  return 'FinCobra MCP is not signed in. Run `npx -y fincobra-mcp login`. Checkout can also use FINCOBRA_CHECKOUT_API_KEY.';
}
