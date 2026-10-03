# Gorengan Index

A multi-asset market terminal with SEC ownership-disclosure search, public crypto market intelligence, Bitcoin transfer samples and issuer-reported IBIT holdings. Built with Next.js, React and a standalone TypeScript market-server. An optional Rust service stack is also present in the repository.

The terminal uses live upstream requests and provider caches. Missing data is shown as unavailable. Public market anomalies do not establish insider identity, illegal trading or future profit. See the [data audit and research](docs/insider-data-audit.md) for coverage, validation and remaining limitations.

## Local development

Use Node.js 22+ and pnpm 11. Install dependencies and build shared types before starting the stack:

```sh
pnpm install
pnpm --filter @gorengan/shared build
pnpm dev
```

Open [the terminal](http://localhost:3000/terminal). `pnpm dev:web` and `pnpm dev:server` run its two services separately.

The web app uses `apps/web/.env.local`; start with `apps/web/.env.example` if needed. The market-server reads root `.env` or its local `.env`. Do not overwrite existing credentials. Defaults are web port 3000 and market-server port 9000.

```dotenv
# apps/web/.env.local — standalone TypeScript server
NEXT_PUBLIC_API_URL=http://localhost:9000/v1
NEXT_PUBLIC_WS_URL=ws://localhost:9000/v1/stream
# Optional SEC XML retrieval; use your real application/contact identity:
# SEC_USER_AGENT=YourApp contact@your-domain.example
# Optional, comma-separated public Bitcoin addresses, maximum 20:
# BITCOIN_WATCH_ADDRESSES=...
```

`DATABASE_URL` supplies the instrument catalog when available. Without it, the server uses 40 default instruments. `QUESTDB_HTTP_URL` points at an optional QuestDB instance; use a separate port from the market-server. Without QuestDB, live operation uses memory and health reports degraded storage. Configure the existing Google OAuth/Auth.js variables for production. Any development auth bypass is development-only.

## Features

- Market tables, watchlist, chart intervals, technical analysis, market composition, currency reference and spot/risk calculators.
- Forecast scenarios with rolling historical evaluation, recent-outcome checks, baseline comparison and cost-aware evidence screening. Scenario weights are heuristic, not measured win probabilities.
- **Insider & Whale Radar:** SEC Form 4 full-text search, filing date windows, pagination, original documents, CSV exports, local watched searches and classified transaction XML details when the source permits access. Downloaded XML can also be analyzed locally with issuer/period checks.
- **Crypto Intel:** Binance depth, sampled taker flow, funding and open interest with independent source status and stale-data suppression.
- **ETF and macro radar:** issuer-reported IBIT BTC holdings, ETF/commodity quotes, sampled Bitcoin transfers and real RSS news. No fabricated ETF flows, wallet owners or social engagement.
- Cached, coalesced public requests, provider cooldowns and honest unavailable states. Free sources can still throttle or restrict access.

Add panels with **Add widget** in the terminal. Insider coverage is US SEC; Indonesian IDX/OJK disclosures currently have a manual official link only. Watched searches run while their panel is open and are stored in this browser; background alerts are not implemented.

## API

The standalone market-server accepts `/v1` and `/api` prefixes:

| Endpoint | Purpose |
| --- | --- |
| `/v1/health` | Provider and database health |
| `/v1/symbols` | Configured instrument catalog |
| `/v1/markets` | Latest market snapshots |
| `/v1/markets/BTC-USDT` | Instrument details |
| `/v1/candles/BTC-USDT?timeframe=1h&limit=200` | Native-interval historical candles |

Web routes include `/api/insider-filings`, `/api/insider-filings/detail`, `/api/crypto-intel`, `/api/whale-radar`, `/api/news`, `/api/sentiment` and `/api/exchange-rate`. Data freshness varies by source. Yahoo equity/FX data is delayed or last-close, not a subsecond exchange feed.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm smoke:live  # requires both services running and upstream network access
```

See [analysis methodology](apps/web/src/features/analysis/README.md), [audit/research](docs/insider-data-audit.md) and [verification evidence](docs/verification.md).

## Repository

- `apps/web`: terminal UI and public-data routes.
- `apps/market-server`: standalone market ingestion, historical data, HTTP and WebSocket distribution.
- `packages/shared`: TypeScript domain types and default instrument catalog.
- `apps/collector`, `apps/aggregator`, `apps/gateway`, `crates`: optional Rust stack.
- `infra`, `k8s`, Docker Compose files: deployment scaffolding; not validated by the current local data audit. Configure backend URLs and port assignments explicitly when using these instead of the standalone stack.
