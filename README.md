# FinCobra MCP — crypto checkout for Claude, Cursor, and Codex

[Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for FinCobra crypto checkout and payments. Create hosted invoices for BTC, USDT, and USDC (settlement assets come from dashboard payment methods; amounts are USD). Works with Claude Code, Cursor, and Codex. Watchlist access is read-only.

Docs: [FinCobra Checkout MCP](https://fincobra.com/docs/checkout/mcp.html)

```bash
npx -y fincobra-mcp
```

Pin a release with `npx -y fincobra-mcp@0.1.0`. Requires Node.js 20+.

From GitHub:

```bash
npx -y github:dexstandard/fincobra-mcp
```

Pin a source release with `npx -y github:dexstandard/fincobra-mcp#v0.1.0`.

- Checkout: create a hosted payment invoice and read its status
- Watchlist: read-only source list and manual net-worth breakdown

This is not a payments platform and not a Watchlist write API.

## Tools (v0)

### Checkout

| Tool | What it does |
| --- | --- |
| `create_invoice` | Create a USD invoice. Returns `id` and hosted `paymentUrl` (`/pay/:id`). |
| `get_invoice` | Look up a known invoice by `id`. Returns status, `paymentUrl`, and amounts. |

There is no `list_invoices` tool. Checkout API keys cannot list invoices.

Invoice amounts are USD. Settlement assets come from dashboard payment methods:

| Network | Assets |
| --- | --- |
| Bitcoin (xpub) | BTC |
| Ethereum mainnet | USDT, USDC |
| Solana | USDT, USDC |
| Arbitrum One | USDC |
| Base | USDC |

### Watchlist (read-only)

| Tool | What it does |
| --- | --- |
| `get_net_worth` | Manual banks / cash / property totals in USD. `cryptoUsd` is null. |
| `list_sources` | Wallets, exchanges, and manual assets from existing list APIs. |
| `get_source` | One source by id (`wallet:12`, `exchange:binance`, `manual:3`). |

Watchlist has no public API key. Auth is the Identity `session` cookie used by the Watchlist web app.

Banks, cash, and property are manual product entries, not live bank or title feeds. Live crypto USD balances are computed in the Watchlist UI and are not on the list API. The server does not invent a `cryptoUsd` total.

Watchlist tools do not add wallets, edit banks, change billing, or export taxes.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `FINCOBRA_CHECKOUT_API_KEY` or `FINCOBRA_API_KEY` | One of the two surfaces | Checkout dashboard API key (`fc_live_...`). The Checkout-specific name is preferred when both are set. |
| `FINCOBRA_CHECKOUT_BASE_URL` | No | Checkout origin. Defaults to `https://fincobra.com`. |
| `FINCOBRA_WATCHLIST_SESSION_TOKEN` or `FINCOBRA_SESSION_TOKEN` | One of the two surfaces | Identity `session` cookie value. The Watchlist-specific name is preferred when both are set. |
| `FINCOBRA_WATCHLIST_BASE_URL` | No | Watchlist origin. Defaults to `https://watch.fincobra.com`. |

Configure Checkout, Watchlist, or both. Tools for a missing surface return a configuration error.

Development origins: `https://dev.fincobra.com` and `https://watch.dev.fincobra.com`.

## Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (user):

```json
{
  "mcpServers": {
    "fincobra": {
      "command": "npx",
      "args": ["-y", "fincobra-mcp"],
      "env": {
        "FINCOBRA_CHECKOUT_API_KEY": "fc_live_...",
        "FINCOBRA_CHECKOUT_BASE_URL": "https://fincobra.com",
        "FINCOBRA_WATCHLIST_SESSION_TOKEN": "<session-cookie-value>",
        "FINCOBRA_WATCHLIST_BASE_URL": "https://watch.fincobra.com"
      }
    }
  }
}
```

GitHub alternative: `["-y", "github:dexstandard/fincobra-mcp"]`.

## Claude Code

```bash
claude mcp add fincobra \
  --env FINCOBRA_CHECKOUT_API_KEY=fc_live_... \
  --env FINCOBRA_WATCHLIST_SESSION_TOKEN=<session-cookie-value> \
  -- npx -y fincobra-mcp
```

Or add the same `mcpServers` object to `.mcp.json` / `~/.claude.json`.

## Codex

```bash
codex mcp add fincobra \
  --env FINCOBRA_CHECKOUT_API_KEY=fc_live_... \
  --env FINCOBRA_WATCHLIST_SESSION_TOKEN=<session-cookie-value> \
  -- npx -y fincobra-mcp
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.fincobra]
command = "npx"
args = ["-y", "fincobra-mcp"]

[mcp_servers.fincobra.env]
FINCOBRA_CHECKOUT_API_KEY = "fc_live_..."
FINCOBRA_WATCHLIST_SESSION_TOKEN = "<session-cookie-value>"
```

## Run locally

```bash
npm install
FINCOBRA_CHECKOUT_API_KEY=fc_live_... \
FINCOBRA_WATCHLIST_SESSION_TOKEN=... \
npm start
```

The process speaks MCP over stdio. Do not write application logs to stdout.

## Smoke test

```bash
FINCOBRA_CHECKOUT_API_KEY=fc_live_... \
FINCOBRA_WATCHLIST_SESSION_TOKEN=... \
npm run smoke
```

Unit tests mock the APIs and do not need credentials:

```bash
npm test
```

## Auth

| Surface | Credential | Header / cookie |
| --- | --- | --- |
| Checkout | Dashboard API key (`fc_live_...`) | `X-Api-Key` |
| Watchlist | Identity session cookie (`session`) | `Cookie: session=...` |

Copy the Watchlist `session` cookie from a signed-in browser (DevTools → Application → Cookies). Keep keys and session tokens in MCP server env, not in chat.

## API

Checkout:

- `POST /api/checkout/invoices`
- `GET /api/checkout/invoices/:id`
- Auth: `X-Api-Key`

Watchlist:

- `GET /api/watchlist/wallets`
- `GET /api/watchlist/exchanges`
- `GET /api/watchlist/manual-assets`
- `GET /api/watchlist/fx-rates`
- Auth: `Cookie: session=...`

Send the payer to `paymentUrl`. Treat `confirmed` and `paid_out_of_band` as paid. Treat `payment_detected` as pending unless you accept unconfirmed crypto payments.

## License

[MIT](LICENSE)
