import { describe, expect, it } from 'vitest';
import {
  CheckoutMcpEnvError,
  readCheckoutMcpEnv,
  readFincobraMcpEnv,
} from '../src/env.js';

describe('readFincobraMcpEnv', () => {
  it('accepts checkout only, watchlist only, or both', () => {
    expect(
      readFincobraMcpEnv({
        FINCOBRA_CHECKOUT_API_KEY: 'fc_live_checkout',
      }).watchlist,
    ).toBeNull();

    expect(
      readFincobraMcpEnv({
        FINCOBRA_WATCHLIST_SESSION_TOKEN: 'session-token',
      }).checkout,
    ).toBeNull();

    const both = readFincobraMcpEnv({
      FINCOBRA_CHECKOUT_API_KEY: 'fc_live_checkout',
      FINCOBRA_WATCHLIST_SESSION_TOKEN: 'session-token',
      FINCOBRA_WATCHLIST_BASE_URL: 'https://watch.dev.fincobra.com/',
    });
    expect(both.watchlist).toEqual({
      sessionToken: 'session-token',
      baseUrl: 'https://watch.dev.fincobra.com',
    });
  });

  it('accepts a Checkout session and shares the generic session token', () => {
    expect(
      readFincobraMcpEnv({
        FINCOBRA_CHECKOUT_SESSION_TOKEN: 'checkout-session',
      }).checkout,
    ).toEqual({
      sessionToken: 'checkout-session',
      baseUrl: 'https://fincobra.com',
    });

    const shared = readFincobraMcpEnv({
      FINCOBRA_SESSION_TOKEN: 'shared-session',
    });
    expect(shared.checkout?.sessionToken).toBe('shared-session');
    expect(shared.watchlist?.sessionToken).toBe('shared-session');
  });

  it('requires at least one surface', () => {
    expect(() => readFincobraMcpEnv({})).toThrow(CheckoutMcpEnvError);
    expect(() => readFincobraMcpEnv({})).toThrow(
      'FinCobra MCP is installed, but it is not connected to a FinCobra account.',
    );
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

  it('prefers an API key over a Checkout session', () => {
    expect(
      readCheckoutMcpEnv({
        FINCOBRA_CHECKOUT_API_KEY: 'fc_live_checkout',
        FINCOBRA_CHECKOUT_SESSION_TOKEN: 'checkout-session',
      }),
    ).toEqual({
      apiKey: 'fc_live_checkout',
      baseUrl: 'https://fincobra.com',
    });
  });

  it('requires Checkout authentication', () => {
    expect(() => readCheckoutMcpEnv({})).toThrow(CheckoutMcpEnvError);
    expect(() => readCheckoutMcpEnv({})).toThrow(
      'FINCOBRA_CHECKOUT_API_KEY or FINCOBRA_CHECKOUT_SESSION_TOKEN is required',
    );
  });
});
