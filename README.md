# FinCobra MCP

FinCobra MCP **0.4.0** connects an AI client to your Checkout and Watchlist account. Use this Streamable HTTP server URL:

```text
https://watch.fincobra.com/api/mcp
```

## Connect

Add the URL as a remote MCP server in your client. Select **Connect** or **Sign in**, complete FinCobra sign-in in your browser, and approve the permissions shown. Return to your AI client when the browser finishes.

For Codex:

```sh
codex mcp add fincobra --url https://watch.fincobra.com/api/mcp
codex mcp login fincobra --scopes watchlist:read,checkout:read
```

Codex can start browser authorization during `mcp add` and request all supported permissions. For a read-only connection, close that initial prompt and use the explicit `mcp login --scopes` command above.

For Claude Code:

```sh
claude mcp add --transport http fincobra https://watch.fincobra.com/api/mcp
```

Then use `/mcp` in Claude Code to sign in. In clients with an MCP settings screen, use the same URL and their connection control. The client must support Streamable HTTP and MCP OAuth.

The client stores OAuth credentials and renews access automatically. Access tokens last one hour. A connection lasts up to 90 days. After expiry or revocation, the client opens browser authorization again. Revoke a connection in FinCobra **Settings → Security → Connected MCP clients**.

## Verify the connection

Ask your agent: “Check my FinCobra connection.” It should call `get_connection_status` and return the account ID, approved scopes, access expiry, and server version. To read your portfolio, ask it to call `get_net_worth`.

A saved server entry alone does not prove that the client loaded its tools. If tools are absent, check the MCP server status in the client, sign in if required, and use its reload control. Clients that load tool definitions only when a conversation starts require a new conversation after setup.

## Tools and permissions

When a client omits scopes, FinCobra uses `watchlist:read` and `checkout:read`. Some clients request all advertised scopes. Check the permissions on the consent page. Only tools covered by the approved scopes are listed. To enable writes, request the additional scope in your MCP client's OAuth settings and approve it in the browser. In Codex, use:

```sh
codex mcp login fincobra --scopes watchlist:read,checkout:read,watchlist:write,checkout:write
```

| Tool | Required scope | Result |
| --- | --- | --- |
| `get_connection_status` | Any valid connection | Account, scopes, access expiry, and version |
| `get_net_worth` | `watchlist:read` | Portfolio totals and all sources |
| `list_sources` | `watchlist:read` | Wallets, exchanges, bank/cash entries, property, and cars |
| `get_source` | `watchlist:read` | One source selected by its ID |
| `get_invoice` | `checkout:read` | One Checkout invoice selected by its ID |
| `add_car` | `watchlist:write` | Add a manual car valuation |
| `create_invoice` | `checkout:write` | Create an invoice and return its payment URL |

## Portfolio values

`get_net_worth`, `list_sources`, and `get_source` accept an optional `currency`. USD is the default. Original amounts and USD values remain in the response when another reporting currency is selected. `sourceBalances` keeps available, staked, Spot, Funding, and Earn amounts separate where the source provides them. `lockedBalance` is separate from these available source amounts.

Supported reporting currencies are USD, VND, EUR, GBP, JPY, SGD, AUD, CAD, CHF, CNY, RUB, GEL, THB, BTC, and XAU. XAU means one troy ounce of gold.

Responses include tracked wallets, exchanges (including Hyperliquid), and manual assets. Property values use net equity after the recorded mortgage. Manual entries are estimates that you maintain in Watchlist.

Unsupported tokens hidden by Watchlist have `includedInTotal: false`, `exclusionReason: "unsupported_token"`, and no invented price. They do not block portfolio totals. If a supported asset or source cannot be valued, the response marks its status and leaves affected totals unavailable. Check `valuationStatus` and `notes` before using an incomplete total.

## OAuth protocol

FinCobra Identity provides authorization-code OAuth with S256 PKCE, resource binding, dynamic client registration, public client metadata documents, rotating refresh tokens, and revocation. Browser consent uses your FinCobra account and applies only to the listed permissions.

- Protected resource metadata: `https://watch.fincobra.com/.well-known/oauth-protected-resource/api/mcp`
- Authorization server metadata: `https://watch.fincobra.com/.well-known/oauth-authorization-server`
- MCP resource: `https://watch.fincobra.com/api/mcp`

An unauthenticated MCP request returns HTTP 401 with the protected resource metadata URL in `WWW-Authenticate`. OAuth clients discover the endpoints from these documents. Authorization codes and tokens are bound to their client and resource. Refresh token reuse revokes the connection. Account security changes also invalidate access.

## Server package

The `fincobra-mcp` npm package contains the hosted MCP handler and typed FinCobra clients. FinCobra Identity uses version 0.4.0. Client setup uses the hosted URL above.

`createFincobraMcpHandler` takes trusted service URLs and a `resolveAccessToken` callback. The callback must validate the bearer token against the authorization server and return its account, client, scopes, resource, and expiry. The handler checks the resource, expiry, and browser origin before it creates the MCP context for that request.

Development checks:

```sh
npm ci
npm run build
npm run lint
npm test
```
