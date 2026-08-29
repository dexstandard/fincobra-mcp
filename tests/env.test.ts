import { describe, expect, it } from 'vitest';
import {
  CheckoutMcpEnvError,
  readCheckoutMcpEnv,
  readFincobraMcpEnv,
} from '../src/env.js';

const credential = {
  version: 1 as const,
  authBaseUrl: 'https://watch.fincobra.com',
  accessToken: 'fcm_test',
  expiresAt: '2026-12-01T00:00:00.000Z',
  accountLabel: 'user@example.com',
};

describe('readFincobraMcpEnv', () => {
  it('accepts an API key, a browser login, or both', () => {
    expect(
      readFincobraMcpEnv({
        FINCOBRA_CHECKOUT_API_KEY: 'fc_live_checkout',
      }).watchlist,
    ).toBeNull();

    expect(readFincobraMcpEnv({}, credential).checkout).toEqual({
      accessToken: 'fcm_test',
      baseUrl: 'https://fincobra.com',
    });

    const both = readFincobraMcpEnv(
      {
        FINCOBRA_CHECKOUT_API_KEY: 'fc_live_checkout',
        FINCOBRA_WATCHLIST_BASE_URL: 'https://watch.dev.fincobra.com/',
      },
      credential,
    );
    expect(both.checkout).toEqual({
      apiKey: 'fc_live_checkout',
      baseUrl: 'https://fincobra.com',
    });
    expect(both.watchlist).toEqual({
      accessToken: 'fcm_test',
      baseUrl: 'https://watch.dev.fincobra.com',
    });
  });

  it('starts without credentials so MCP tools can explain how to sign in', () => {
    expect(readFincobraMcpEnv({})).toEqual({
      checkout: null,
      watchlist: null,
    });
  });
});

describe('readCheckoutMcpEnv', () => {
  it('reads the Checkout-specific API key and default base URL', () => {
    expect(
      readCheckoutMcpEnv({
        FINCOBRA_CHECKOUT_API_KEY: 'fc_live_checkout',
      }),
    ).toEqual({
      apiKey: 'fc_live_checkout',
      baseUrl: 'https://fincobra.com',
    });
  });

  it('accepts FINCOBRA_API_KEY and an explicit base URL', () => {
    expect(
      readCheckoutMcpEnv({
        FINCOBRA_API_KEY: ' fc_live_sdk ',
        FINCOBRA_CHECKOUT_BASE_URL: 'https://dev.fincobra.com/',
      }),
    ).toEqual({
      apiKey: 'fc_live_sdk',
      baseUrl: 'https://dev.fincobra.com',
    });
  });

  it('prefers FINCOBRA_CHECKOUT_API_KEY over FINCOBRA_API_KEY', () => {
    expect(
      readCheckoutMcpEnv({
        FINCOBRA_CHECKOUT_API_KEY: 'fc_live_checkout',
        FINCOBRA_API_KEY: 'fc_live_sdk',
      }).apiKey,
    ).toBe('fc_live_checkout');
  });

  it('prefers an API key over a browser login', () => {
    expect(
      readCheckoutMcpEnv(
        { FINCOBRA_CHECKOUT_API_KEY: 'fc_live_checkout' },
        credential,
      ),
    ).toEqual({
      apiKey: 'fc_live_checkout',
      baseUrl: 'https://fincobra.com',
    });
  });

  it('requires Checkout authentication', () => {
    expect(() => readCheckoutMcpEnv({})).toThrow(CheckoutMcpEnvError);
    expect(() => readCheckoutMcpEnv({})).toThrow('npx -y fincobra-mcp login');
  });
});
