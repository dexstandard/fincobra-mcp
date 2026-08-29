import { describe, expect, it } from 'vitest';
import { getCliHelp, getMissingAuthMessage } from '../src/cli-help.js';

describe('CLI setup guidance', () => {
  it('explains install, account, authentication, and client restart steps', () => {
    const help = getCliHelp();

    expect(help).toContain('npx installs the server on first use');
    expect(help).toContain('https://fincobra.com/checkout/settings');
    expect(help).toContain('FINCOBRA_CHECKOUT_API_KEY');
    expect(help).toContain('FINCOBRA_CHECKOUT_SESSION_TOKEN');
    expect(help).toContain('FINCOBRA_WATCHLIST_SESSION_TOKEN');
    expect(help).toContain('FINCOBRA_SESSION_TOKEN');
    expect(help).toContain('Restart your MCP client');
  });

  it('makes missing authentication distinct from installation failure', () => {
    const message = getMissingAuthMessage();

    expect(message).toContain('is installed');
    expect(message).toContain('not connected to a FinCobra account');
    expect(message).toContain('npx -y fincobra-mcp --help');
  });
});
