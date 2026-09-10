import { createMcpHandler } from '@modelcontextprotocol/server';
import { createCheckoutClient } from './checkout-client.js';
import { createWatchlistClient } from './watchlist-client.js';
import { createFincobraMcpServer } from './server.js';
import type { FincobraMcpHttpOptions } from './http.types.js';

export function createFincobraMcpHandler(options: FincobraMcpHttpOptions) {
  const metadataUrl = new URL(
    `/.well-known/oauth-protected-resource${new URL(options.resourceUrl).pathname}`,
    options.resourceUrl,
  ).href;
  const allowedOrigins = new Set(
    options.allowedOrigins ?? [new URL(options.resourceUrl).origin],
  );
  const handler = createMcpHandler(
    ({ authInfo }) => {
      if (
        !authInfo ||
        typeof authInfo.extra?.accountId !== 'string' ||
        !authInfo.expiresAt
      )
        throw new Error('Authenticated MCP context is required.');
      return createFincobraMcpServer({
        connection: {
          accountId: authInfo.extra.accountId,
          clientId: authInfo.clientId,
          scopes: authInfo.scopes,
          expiresAt: new Date(authInfo.expiresAt * 1000).toISOString(),
        },
        watchlistClient: createWatchlistClient({
          accessToken: authInfo.token,
          baseUrl: options.watchlistBaseUrl,
          fetchImpl: options.fetchImpl,
        }),
        checkoutClient: createCheckoutClient({
          accessToken: authInfo.token,
          baseUrl: options.checkoutBaseUrl,
          fetchImpl: options.fetchImpl,
        }),
      });
    },
    { responseMode: 'json' },
  );

  return {
    async fetch(request: Request): Promise<Response> {
      const origin = request.headers.get('origin');
      if (origin && !allowedOrigins.has(origin))
        return Response.json(
          { error: 'Origin is not allowed.' },
          { status: 403 },
        );
      const match = /^Bearer ([^\s]+)$/i.exec(
        request.headers.get('authorization') ?? '',
      );
      const connection = match
        ? await options.resolveAccessToken(match[1])
        : null;
      if (
        !match ||
        !connection ||
        connection.resource !== options.resourceUrl ||
        Date.parse(connection.expiresAt) <= Date.now()
      ) {
        return Response.json(
          {
            error:
              'Connect FinCobra in your MCP client to sign in through the browser.',
          },
          {
            status: 401,
            headers: {
              'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}", scope="watchlist:read checkout:read"`,
              'Cache-Control': 'no-store',
            },
          },
        );
      }
      const response = await handler.fetch(request, {
        authInfo: {
          token: match[1],
          clientId: connection.clientId,
          scopes: connection.scopes,
          expiresAt: Date.parse(connection.expiresAt) / 1000,
          resource: new URL(connection.resource),
          extra: { accountId: connection.accountId },
        },
      });
      response.headers.set('Cache-Control', 'no-store');
      return response;
    },
    close: () => handler.close(),
  };
}
