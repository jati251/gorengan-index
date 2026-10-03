# Insider and market-data audit

Audit and implementation: 3 October 2026. Scope tested: Next.js web and TypeScript market-server. Existing local changes were preserved. The optional Rust collector/aggregator/gateway, Docker and Kubernetes deployments were not executed in this audit.

## Findings and changes

| Feature | Finding | Implemented behavior |
| --- | --- | --- |
| Insider disclosures | No real ownership filing feed in the radar | SEC EDGAR Form 4 search, date window, pagination, accession deduplication, original documents, CSV, local watched-search baselines and unseen badges |
| Transaction detail | Market flow cannot identify an insider | Separate SEC ownership XML parser: issuer, reporting owners, transaction codes, shares/price/value, derivatives, amendments, 10b5-1 checkbox and footnotes. Requires configured SEC contact identity and upstream access |
| ETF monitoring | Reserve amounts and net flows were inferred from price/volume | Official IBIT holdings CSV; five ETF quotes with provider timestamps. Unsupported aggregate AUM/net flows remain null |
| Bitcoin radar | Wallet identities and exchange flow labels were guessed | Real address balances and sampled unconfirmed transactions; no owner attribution; totals explicitly include change outputs |
| Public news | Simulated posts, engagement and fallback headlines | Actual CoinDesk RSS articles, dates and source links; search and asset filters; simple headline sentiment labeled as a heuristic |
| Crypto intelligence | Sample truncation, stale snapshots and overstated predictive labels | Sorted depth, complete sampled aggregate totals, taker-side interpretation, source-level errors, freshness gating and no invented win rate |
| Forecast | Heuristic weights presented like confidence; no honest held-out metric | Chronological rolling-origin evaluation, nonoverlapping outcomes, sample counts, MAPE against last-price baseline, observed envelope coverage; weights are explicitly uncalibrated |
| Candles | Interval mixing and incomplete candles treated as final | Cache keyed by native interval; real subminute Binance aggregation, Yahoo 4-hour rollups, provider-time finalization, late/future trade rejection |
| Equity/FX quotes | Generated trades and artificial order depth | Delayed Yahoo quotes with original timestamps; no fabricated ticks or book. Unavailable book is visibly unavailable |
| News/sentiment widgets | Called endpoints absent from standalone server | Same-origin RSS and Alternative.me routes; daily crypto-only sentiment with attribution and freshness checks |
| Provider access | Repeated requests and hidden failures | Coalescing, TTL caches, bounded queues, timeouts, provider cooldown and Retry-After; visible live/cached/stale/unavailable states |
| Persistence health | Health reported success without working storage | Database health reflects connectivity; disconnected writes are skipped. Memory operation remains possible |

## Data sources and limitations

“Free to access” does not mean unlimited, open licensed, real-time, or covered by an SLA. No rotating identities, proxy evasion or CAPTCHA bypass is implemented.

- **SEC EDGAR:** official public disclosures. Search refreshes every five minutes while the panel is mounted. Search uses full-text keywords, not exact ticker matching; 100 results/page, at most 1,000 accessible results per query. Narrow keywords and date windows. Filing dates and transaction dates differ. Form 4 may include awards, exercise, withholding, gifts and planned transactions. It does not establish illegality or a profitable strategy. Search endpoint is the public EDGAR search service, not a guaranteed versioned ownership API.
- **SEC XML:** set `SEC_USER_AGENT` to the real application name and operator contact email in `apps/web/.env.local`, then restart Next. XML parsing is tested with fixtures; live archive retrieval was blocked (HTTP 403) from this environment and is **not verified end to end**. Original SEC links remain available. A contact identity does not guarantee access.
- **Binance:** spot depth and 500 recent aggregate trades are anonymous, limited samples. The ten largest aggregates shown in the UI are not the entire market; aggregate events can contain several fills. Derivatives may be unavailable by network or instrument. A composite is withheld when required inputs are absent/stale. Funding intervals are not assumed to be eight hours. OI is a level, not evidence of an increase/decrease or long/short ownership.
- **BlackRock:** BTC quantity and holding value come from the official IBIT CSV. The disclosure date is retained in UTC. This is IBIT only, not all-ETF AUM. Net creations/redemptions and daily all-fund net flows are not provided by this implementation.
- **Yahoo Finance:** public chart service for delayed equity, FX, commodity and ETF observations; unofficial integration with no availability guarantee. Latest close can be old when the market is closed. Session change uses previous close, not the first close in the multi-day chart window. Yahoo cannot provide subsecond equity/FX history here.
- **Blockchain.com:** recent mempool response is sampled, not a full-chain scanner. Output totals include change and can overstate economic transfer. Address balance is a single address, not a wallet cluster. Configure comma-separated `BITCOIN_WATCH_ADDRESSES` (maximum 20). Default addresses have no verified owner attribution.
- **CoinDesk RSS:** headlines only; sentiment comes from keywords and is not a validated NLP model or X/social feed.
- **Alternative.me:** daily crypto sentiment, not per-stock sentiment or a live trading signal.
- **IDX/OJK:** manual official disclosure link only. Automated Indonesian ownership-disclosure ingestion is not implemented; US Form 4 coverage must not be presented as Indonesian insider coverage.

## Request budgets

Next routes share an in-process client (256 cached keys, up to 24 queued requests per provider, serialized provider access). Default spacing is 350 ms; SEC 500 ms; crypto 250 ms. SEC subdomains share a rate group. Timeouts are eight seconds. Negative results are briefly cached. HTTP 403/418/429/503 impose a provider cooldown and honor Retry-After. These measures reduce quota pressure but cannot guarantee providers never throttle.

| Dataset | Fresh cache TTL | Stale policy |
| --- | --- | --- |
| SEC search | 5 minutes | Up to 24 hours, visibly stale |
| SEC XML | 24 hours | Up to 7 days, visibly stale |
| Spot/funding/OI | 15 seconds | No stale data returned |
| Quotes | 5 minutes | Up to 24 hours, quote timestamp retained |
| IBIT holdings | 1 hour | Up to 24 hours; disclosure-date validation also applies |
| Mempool | 1 minute | Up to 3 minutes |
| Address balances | 5 minutes | Source status remains visible |
| News | 5 minutes | Up to 1 hour |
| Crypto sentiment | 1 hour | Observation must be no older than two days |

The TypeScript market-server also serializes public historical requests, coalesces history requests for 15 seconds and prevents overlapping Yahoo polling cycles. Caches and cooldowns are **per process**. For multiple replicas, use a shared ingestion service/cache and a distributed provider budget before scaling; otherwise each replica consumes its own quota. Current queues are bounded, so overload may produce explicit unavailable responses.

## Forecast validation

The central projection fits the mean of 59 log returns from 60 closed candles. At each historical origin, it forecasts the selected 5/10/20-candle horizon using only preceding data. Origins advance by the horizon to avoid overlapping evaluation outcomes. Displayed metrics measure this central projection only, not the bull/bear scenario weights, composite crypto score or a trade execution strategy. Small samples, structural changes, delayed input and unmodeled fees/slippage limit interpretation. No profitability, causal insider detection or calibrated confidence claim is made.

## Running and testing

Use the standalone stack described in the root README. The web app's default market endpoint is `http://localhost:9000/v1`; `/api` is also accepted by the standalone server. Configure explicit URLs for the optional Rust gateway. Production requires existing authentication configuration; development auth bypass is not a production setup.

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
# With web:3000 and market-server:9000 running:
pnpm smoke:live
```

`smoke:live` uses real network data, checks provider status, actual hourly bar duration, source links, explicit null metrics and invalid-parameter errors. Missing required provider coverage exits 2 rather than pretending an empty result passed. Fixtures are confined to tests, not runtime fallback data.

Local watched searches are saved in browser storage (20 queries, 2,000 seen accessions per query). Monitoring occurs only while the panel is mounted. There is no server-side alert worker, email delivery or push notification. The standalone server uses the catalog database when available, otherwise 40 default symbols; this is not verified coverage of 500 instruments. QuestDB was unavailable during this run, so durability/restart recovery is not verified.

## Research basis

1. [SEC developer resources and fair access](https://www.sec.gov/about/developer-resources): maximum ten requests/second across machines; identify automated clients and retrieve efficiently. This implementation uses a lower per-process budget.
2. [SEC EDGAR API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces): submissions/XBRL JSON and bulk data do not replace parsing individual ownership transactions.
3. [SEC public search](https://www.sec.gov/search-filings) and [Investor.gov Forms 3, 4 and 5 bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-69): disclose ownership events and distinguish transaction categories/timing.
4. [Binance Spot REST API](https://developers.binance.com/en/docs/products/spot/rest-api) and [Spot glossary](https://developers.binance.com/en/docs/products/spot/faqs/spot_glossary): public market-data endpoints, aggregated trades and rate-limit handling.
5. [Binance USD-M market data](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data): funding/OI semantics and adjustable funding intervals.
6. [Official IBIT page](https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf) and [issuer holdings CSV](https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf/latest-holdings.csv): use actual BTC quantity and preserve disclosure date.
7. [Forecasting: Principles and Practice, time-series cross-validation](https://otexts.com/fpp3/tscv.html): evaluate on future observations at rolling origins without training leakage.
8. [OJK POJK 4/2024](https://ojk.go.id/id/regulasi/Pages/POJK-4-Tahun-2024-Laporan-Kepemilikan-atau-Setiap-Perubahan-Kepemilikan-Saham-Perusahaan-Terbuka-dan-Aktivitas-Menjaminkan.aspx): Indonesian ownership reporting is a separate disclosure system; it cannot be inferred from US filings.
9. [Esplora API](https://github.com/Blockstream/esplora/blob/master/API.md): a self-hosted node/indexer is a possible future route to independent chain coverage; it is not installed by this change.

## Follow-up improvements

The forecast screen now withholds a supported direction when data is stale,
history is insufficient, recent results deteriorate, the last-price baseline
is stronger, or projected movement does not cover the editable cost estimate.
The 30-outcome minimum, 10% overall error improvement and ten-outcome recent
window are explicit screening rules, not calibrated confidence. See the
analysis methodology for the exact rules.

Insider details now summarize purchase/sale rows separately from grants,
exercise and derivatives; expose missing prices and incomplete coverage;
and show row-specific position changes only for eligible direct ownership.
Footnote references suppress that calculation, and amendments/joint owners
receive a reconciliation notice. A missing 10b5-1 XML flag stays unknown rather
than being treated as unchecked. Filing cards show calendar time from report
period to filing, without asserting legal lateness.

When the archive is unavailable, a user can select a downloaded SEC XML file
for local browser analysis. The file is not uploaded to the server and is not
persisted. Issuer CIK, report period and amendment type must match the selected
filing. XML typically does not embed its accession; the user must confirm it
against the original SEC document. This option does not claim the automatic
archive feed works. Saved searches are now directly selectable in the panel;
monitoring still runs only while the panel is open.

Transaction categories were checked against the [SEC insider transactions
bulletin](https://www.sec.gov/files/forms-3-4-5.pdf). Evaluation remains based on
[chronological rolling-origin tests](https://otexts.com/fpp3/tscv.html).
