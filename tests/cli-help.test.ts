import { describe, expect, it } from 'vitest';
import { getCliHelp, getMissingAuthMessage } from '../src/cli-help.js';

describe('CLI setup guidance', () => {
  it('explains install, account, authentication, and client restart steps', () => {
    const help = getCliHelp();

    expect(help).toContain('npx installs the server on first use');
    expect(help).toContain('npx -y fincobra-mcp login');
    expect(help).toContain('FINCOBRA_CHECKOUT_API_KEY');
    expect(help).toContain('You do not copy browser cookies or tokens');
    expect(help).toContain('Restart your MCP client');
  });

  it('makes missing authentication distinct from installation failure', () => {
    const message = getMissingAuthMessage();

    expect(message).toContain('not signed in');
    expect(message).toContain('npx -y fincobra-mcp login');
  });
});
