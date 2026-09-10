# FinCobra MCP — crypto checkout for Claude, Cursor, and Codex

[Model Context Protocol](https://modelcontextprotocol.io) server for FinCobra Checkout and Watchlist. This guide covers release **0.3.0**. It creates hosted BTC, USDT, and USDC invoices, reads live Watchlist balances, and can add a car as a manual asset.

Docs: [FinCobra Checkout MCP](https://fincobra.com/docs/checkout/mcp.html)

## Quick start

You need Node.js 20 or later and a FinCobra account. `npx` installs the package when you run it. A global install is not required.

1. Install the package and sign in:

```bash
npx -y fincobra-mcp@0.3.0 login
```

The command opens FinCobra in your browser.

- If you are not signed in, complete the normal FinCobra sign-in window. The approval request appears immediately after sign-in.
- If you are already signed in, the approval request appears immediately.
- Confirm that the code in the browser matches the CLI code, review the requested access, and select **Approve FinCobra MCP**.
- Return to the terminal. The CLI confirms the FinCobra account and saves a separate revocable credential automatically.

You do not copy browser cookies, session tokens, or access tokens.

2. Add the MCP command to your client:

```bash
npx -y fincobra-mcp@0.3.0
```

3. Restart the MCP client.

Check or remove the saved login at any time:

```bash
npx -y fincobra-mcp@0.3.0 status
npx -y fincobra-mcp@0.3.0 logout
```

Pin this release with `npx -y fincobra-mcp@0.3.0`.

## Access model

Browser login gives the CLI a dedicated credential with only these approved scopes:

| Scope             | Access                                                                |
| ----------------- | --------------------------------------------------------------------- |
| `watchlist:read`  | Read Watchlist wallets, exchanges, manual assets, and exchange rates. |
| `watchlist:write` | Add a car as a manual Watchlist asset.                                |
| `checkout:read`   | Read a Checkout invoice by its invoice ID.                            |
| `checkout:write`  | Create a Checkout invoice.                                            |

The CLI never reads or stores the Identity browser session cookie. The saved CLI credential expires, can be revoked with `logout`, and cannot access general account settings.

A Checkout dashboard API key remains available for server automation. Set `FINCOBRA_CHECKOUT_API_KEY` or `FINCOBRA_API_KEY` in the MCP process. An API key takes priority over the browser login for Checkout tools. Watchlist uses browser login because it has no public API key.

## Tools

### Checkout

| Tool             | What it does                                                          |
| ---------------- | --------------------------------------------------------------------- |
| `create_invoice` | Create a USD invoice. Returns its ID and hosted payment URL.          |
| `get_invoice`    | Read a known invoice by ID. Returns status, payment URL, and amounts. |

Invoice settlement assets come from the merchant's Checkout payment methods:

| Network          | Assets     |
| ---------------- | ---------- |
| Bitcoin          | BTC        |
| Ethereum mainnet | USDT, USDC |
| Solana           | USDT, USDC |
| Arbitrum One     | USDC       |
| Base             | USDC       |

### Watchlist

| Tool            | What it does                                               |
| --------------- | ---------------------------------------------------------- |
| `get_net_worth` | Return live crypto and manual asset totals in USD.         |
| `list_sources`  | List wallets, exchanges, live balances, and manual assets. |
| `get_source`    | Read one source by the ID from `list_sources`.             |
| `add_car`       | Add a car with a name, currency, value, and optional note. |

Banks, cash, property, and cars are manual entries. `cryptoUsd` and `totalNetWorthUsd` are `null` when any live crypto source is temporarily unavailable. In that case, `pricedCryptoUsd` contains the sources that were valued successfully.

## Client examples

### Cursor

Add this to `.cursor/mcp.json` or `~/.cursor/mcp.json` after you run the login command:

```json
{
  "mcpServers": {
    "fincobra": {
      "command": "npx",
      "args": ["-y", "fincobra-mcp@0.3.0"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add fincobra -- npx -y fincobra-mcp@0.3.0
```

### Codex

```bash
codex mcp add fincobra -- npx -y fincobra-mcp@0.3.0
```

Or add this to `~/.codex/config.toml`:

```toml
[mcp_servers.fincobra]
command = "npx"
args = ["-y", "fincobra-mcp@0.3.0"]
```

## Environment variables

| Variable                                          | Required | Description                                                         |
| ------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| `FINCOBRA_CHECKOUT_API_KEY` or `FINCOBRA_API_KEY` | No       | Optional Checkout dashboard API key.                                |
| `FINCOBRA_CHECKOUT_BASE_URL`                      | No       | Checkout origin. Defaults to `https://fincobra.com`.                |
| `FINCOBRA_WATCHLIST_BASE_URL`                     | No       | Watchlist origin. Defaults to `https://watch.fincobra.com`.         |
| `FINCOBRA_AUTH_BASE_URL`                          | No       | Browser login API origin. Defaults to `https://watch.fincobra.com`. |
| `FINCOBRA_CONFIG_DIR`                             | No       | Override the local directory for the saved CLI credential.          |

## Development

```bash
npm install
npm test
npm run lint
npm run build
```

The process speaks MCP over stdio. It does not write application logs to stdout.

## License

[MIT](LICENSE)
