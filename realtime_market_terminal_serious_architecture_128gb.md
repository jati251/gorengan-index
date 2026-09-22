# Realtime Market Terminal — Serious Self-Hosted Architecture

> Goal: build a production-style personal market terminal that behaves like a compact CoinMarketCap + TradingView: realtime price/ticker, live candlestick charts down to **1 second**, historical OHLCV, multi-provider support, and no dependency on metered SaaS market-data products such as CoinGecko, CoinMarketCap, TwelveData, Polygon, Alpha Vantage, or Metals-API.

> **Deployment profile:** optimized for a **128 GB SSD/NVMe single-server deployment**. Realtime processing remains per-event/sub-second; storage pressure is controlled by hot-symbol-only 1-second persistence, short JetStream replay, bounded metrics/log retention, and automatic disk-pressure cleanup.

---

## 0. Non-Negotiable Requirements

### Functional

- Realtime price/ticker updates.
- Live chart updates from incoming market events.
- First-class **1-second OHLCV candles**.
- 1m / 5m / 15m / 30m / 1h / 4h / 1d / 1w chart intervals.
- Historical chart queries.
- Crypto first.
- Architecture ready for FX and metals/gold later.
- Multi-exchange/provider normalization.
- Reconnect and gap recovery automatically.
- Can run continuously on one dedicated server.
- Frontend never talks directly to upstream exchanges.

### Cost / dependency

The system must NOT depend on:

- monthly request credits;
- SaaS market-data free tiers;
- paid API keys for the core crypto path;
- browser-side calls to third-party exchanges;
- proprietary cloud databases or message brokers.

The system MAY consume **native public market feeds from exchanges**. Those feeds still have technical connection/subscription/rate rules. The architecture must handle those automatically. "No free-tier quota" does not mean "no upstream protocol limits."

---

# 1. Final Recommended Stack

| Layer | Technology | Role |
|---|---|---|
| Web UI | Next.js + TypeScript | Dashboard, market overview, watchlist, charts |
| Chart | Lightweight Charts or KLineChart | Candlesticks and realtime chart rendering |
| Core runtime | **Rust** | All market-data hot paths |
| Async runtime | **Tokio** | Networking, tasks, timers, concurrency |
| Upstream WebSocket | fastwebsockets or tokio-tungstenite | Native exchange feeds |
| HTTP client | reqwest + rustls | Symbol discovery and REST backfill |
| REST / browser WS | Axum + WebSocket | Public application API |
| Serialization | serde / serde_json | Exchange payload parsing |
| Internal bus | **NATS + JetStream** | Decouple collector, aggregator and gateway; short retention/replay |
| Hot state | **Valkey** | Latest ticker, current market state, fast shared cache |
| Time-series DB | **QuestDB OSS** | 1s / 1m OHLCV and historical time series |
| Metrics | Prometheus | Runtime metrics |
| Dashboards | Grafana | Feed/database/server observability |
| Logs | tracing + optional Loki | Structured logs |
| Reverse proxy | Caddy or Nginx | TLS, routing, compression |
| Deployment | Docker Compose | Single-server production deployment |
| Clock sync | chrony/systemd-timesyncd | Accurate timestamps |

### Why Rust

This workload is mostly:

```text
receive bytes
    ↓
parse JSON
    ↓
normalize
    ↓
update market state
    ↓
aggregate candles
    ↓
publish events
    ↓
persist
    ↓
broadcast
```

Rust gives a high performance ceiling for the entire pipeline, not just WebSocket fan-out. It also allows precise control over allocations, bounded queues, backpressure and failure isolation.

---

# 2. High-Level Architecture

```text
                         UPSTREAM MARKET VENUES

       Binance WS       Kraken WS       Coinbase WS       OKX / Bybit
            │                │                │                │
            └────────────────┴────────────────┴────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │  Rust Feed Collectors  │
                         │                        │
                         │ connect / reconnect    │
                         │ parse venue payloads   │
                         │ sequence validation    │
                         │ normalize symbols      │
                         └────────────┬───────────┘
                                      │
                                      ▼
                              Normalized Events
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │      NATS / JetStream  │
                         │                        │
                         │ market.trade.*         │
                         │ market.ticker.*        │
                         │ market.status.*        │
                         └────────────┬───────────┘
                                      │
               ┌──────────────────────┼──────────────────────┐
               │                      │                      │
               ▼                      ▼                      ▼
      ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
      │ Rust Aggregator│     │ Rust Gateway   │     │ Observability  │
      │                │     │                │     │                │
      │ 1s OHLCV       │     │ REST           │     │ Prometheus     │
      │ ticker stats   │     │ WebSocket      │     │ Grafana        │
      │ rollups        │     │ subscriptions  │     │ logs           │
      └───────┬────────┘     └───────┬────────┘     └────────────────┘
              │                      │
       ┌──────┴───────┐              │
       ▼              ▼              │
   Valkey          QuestDB            │
 latest state      history            │
       │              │              │
       └──────────────┴───────┬──────┘
                              ▼
                         Next.js Web
                              │
                    Trading / Market UI
```

---

# 3. Service Topology

Use a Rust workspace rather than unrelated repositories.

```text
market-terminal/
│
├── apps/
│   ├── web/                         # Next.js
│   │
│   ├── collector/                   # Rust binary
│   │   └── src/
│   │       ├── providers/
│   │       │   ├── binance/
│   │       │   ├── kraken/
│   │       │   ├── coinbase/
│   │       │   ├── okx/
│   │       │   └── bybit/
│   │       ├── reconnect/
│   │       ├── subscriptions/
│   │       └── main.rs
│   │
│   ├── aggregator/                  # Rust binary
│   │   └── src/
│   │       ├── ticker/
│   │       ├── candles/
│   │       ├── rollups/
│   │       ├── persistence/
│   │       └── main.rs
│   │
│   ├── gateway/                     # Rust Axum binary
│   │   └── src/
│   │       ├── rest/
│   │       ├── websocket/
│   │       ├── subscriptions/
│   │       ├── queries/
│   │       └── main.rs
│   │
│   └── backfill/                    # Rust binary / scheduled job
│       └── src/
│           ├── providers/
│           ├── gaps/
│           └── main.rs
│
├── crates/
│   ├── market-domain/
│   ├── market-protocol/
│   ├── provider-core/
│   ├── storage-core/
│   ├── telemetry/
│   └── config/
│
├── infra/
│   ├── nats/
│   ├── questdb/
│   ├── valkey/
│   ├── prometheus/
│   ├── grafana/
│   ├── caddy/
│   └── docker-compose.yml
│
└── docs/
```

For development, all Rust services may initially live inside one process behind feature flags. Keep boundaries clean enough that each module can become its own binary without rewriting the domain layer.

---

# 4. Core Domain Model

Never let exchange-specific JSON escape the provider adapter.

## 4.1 Canonical instrument

```rust
pub enum AssetClass {
    Crypto,
    Fx,
    Metal,
}

pub struct Instrument {
    pub id: InstrumentId,          // e.g. BTC-USDT
    pub base: String,              // BTC
    pub quote: String,             // USDT
    pub asset_class: AssetClass,
    pub provider: ProviderId,      // binance
    pub provider_symbol: String,   // BTCUSDT
    pub price_scale: u32,
    pub quantity_scale: u32,
    pub enabled: bool,
}
```

Canonical IDs:

```text
BTC-USDT
ETH-USDT
SOL-USDT
EUR-USD
GBP-USD
XAU-USD
PAXG-USDT
```

Provider symbol conversion must stay inside adapters.

---

## 4.2 Normalized trade

```rust
pub struct TradeEvent {
    pub event_id: EventId,
    pub provider: ProviderId,
    pub instrument: InstrumentId,
    pub event_time_ns: i64,
    pub ingest_time_ns: i64,
    pub price: Decimal,
    pub quantity: Decimal,
    pub side: Option<TradeSide>,
}
```

Always preserve both:

- `event_time`: timestamp from venue;
- `ingest_time`: timestamp when our collector received/normalized it.

This lets the system measure feed latency and handle late events correctly.

---

## 4.3 Ticker state

```rust
pub struct TickerState {
    pub instrument: InstrumentId,
    pub last: Decimal,
    pub bid: Option<Decimal>,
    pub ask: Option<Decimal>,
    pub high_24h: Option<Decimal>,
    pub low_24h: Option<Decimal>,
    pub volume_24h: Option<Decimal>,
    pub change_24h: Option<Decimal>,
    pub updated_at_ns: i64,
}
```

---

## 4.4 Candle

```rust
pub struct Candle {
    pub instrument: InstrumentId,
    pub interval: Interval,
    pub open_time_ns: i64,
    pub close_time_ns: i64,
    pub open: Decimal,
    pub high: Decimal,
    pub low: Decimal,
    pub close: Decimal,
    pub volume: Decimal,
    pub trade_count: u64,
    pub finalized: bool,
}
```

Intervals:

```text
1s
5s
15s
30s
1m
5m
15m
30m
1h
4h
1d
1w
```

`1s` is the canonical high-resolution persisted candle.

---

# 5. Precision Strategy

Do not use `f64` as the canonical internal representation for money.

Use decimal or fixed-point values inside the engine.

Recommended:

```text
rust_decimal::Decimal
```

For storage, two safe options are allowed:

### Option A — scaled integer

```text
price_i64
price_scale
quantity_i64
quantity_scale
```

This gives deterministic exact arithmetic.

### Option B — DOUBLE only for derived/chart storage

If QuestDB ingestion ergonomics matter more than exact round-trip representation, store derived OHLCV as `DOUBLE`, but keep exchange parsing and candle aggregation in decimal/fixed-point form until persistence.

Never repeatedly convert JSON string → f64 → string → f64 across services.

---

# 6. Provider Adapter Contract

```rust
#[async_trait]
pub trait MarketProvider: Send + Sync {
    async fn connect(&self) -> Result<()>;
    async fn discover_instruments(&self) -> Result<Vec<Instrument>>;
    async fn subscribe(&self, subscriptions: Vec<Subscription>) -> Result<()>;
    async fn unsubscribe(&self, subscriptions: Vec<Subscription>) -> Result<()>;
    async fn backfill(&self, request: BackfillRequest) -> Result<Vec<Candle>>;
}
```

Provider responsibilities:

- endpoint discovery;
- symbol translation;
- WebSocket handshake;
- ping/pong;
- reconnect;
- subscription batching;
- venue rate limits;
- sequence IDs if available;
- provider payload parsing;
- normalization;
- REST backfill for supported intervals.

Core services must not contain conditions like:

```rust
if exchange == "binance" { ... }
```

outside the provider layer.

---

# 7. Crypto Provider Strategy

Start with these adapters:

1. Binance
2. Kraken
3. Coinbase
4. OKX
5. Bybit

Do not connect to every venue simultaneously on day one. Implement provider interfaces first, then enable providers incrementally.

### Initial primary path

```text
Binance → primary crypto realtime source
Kraken  → secondary / validation source
```

Later:

```text
Coinbase
OKX
Bybit
```

The system should support provider priority:

```yaml
providers:
  BTC-USDT:
    primary: binance
    fallback:
      - kraken
      - coinbase
```

Failover should be visible in the UI and metrics.

---

# 8. Realtime Subscription Model

Do not subscribe to every possible trade stream permanently.

Separate data into two sets.

## 8.1 Universe set

Large list used for market overview.

Needs:

- latest ticker;
- 24h statistics;
- lower-frequency history such as 1m.

Example:

```text
500–2000 instruments
```

Use efficient venue ticker streams where possible.

## 8.2 Hot chart set

Symbols that require second-level chart history.

Examples:

```text
BTC-USDT
ETH-USDT
SOL-USDT
PAXG-USDT
```

Needs:

- trade stream;
- realtime price;
- 1-second OHLCV;
- optional bid/ask;
- longer retention.

This distinction prevents 1-second data from exploding for thousands of markets.

Configuration:

```yaml
hot_symbols:
  - BTC-USDT
  - ETH-USDT
  - SOL-USDT
  - PAXG-USDT
```

The gateway may additionally request temporary hot subscriptions while a chart is open.

---

# 9. Event Bus — NATS

Use NATS to separate ingestion from processing and browser fan-out.

Subjects:

```text
market.trade.binance.BTC-USDT
market.trade.kraken.BTC-USD
market.ticker.binance.BTC-USDT
market.status.binance

market.candle.1s.BTC-USDT
market.candle.1m.BTC-USDT
market.ticker.composite.BTC-USDT
```

### Core NATS

Use Core NATS for ultra-low-latency transient fan-out.

### JetStream

Use JetStream only where replay/durability is useful.

Suggested **128 GB profile** retention:

```text
normalized trades     5–15 min
provider status       12–24 h
critical system evt   1–3 d
```

Hard-cap JetStream disk usage. Default target: **1 GB**, hard maximum: **2 GB**. Prefer Core NATS for transient fan-out and JetStream only for the minimal replay window needed to recover an aggregator after a short restart.

Do NOT use JetStream as permanent tick storage.

Why it exists:

```text
collector crashes?        aggregator can catch up
aggregator restarts?      short replay available
gateway restarts?         no effect on ingestion
```

Use bounded retention so NATS cannot silently eat the disk.

---

# 10. Candle Engine

The candle engine consumes normalized trades.

For every hot instrument maintain current buckets in memory.

```text
Trade 12:30:04.120
        ↓
1-second bucket 12:30:04
        ↓
update O/H/L/C/V/count
        ↓
broadcast partial 1s candle
        ↓
12:30:05 begins
        ↓
finalize 12:30:04
        ↓
persist
```

## 10.1 Bucket rule

```text
bucket_start = floor(event_time / interval) * interval
```

Candles must use **event time**, not browser arrival time.

## 10.2 Late events

Allow a small grace window, for example:

```text
1s candles: 250–1000 ms configurable grace
```

If an event arrives after candle finalization:

- update the candle if within permitted late-arrival window;
- record `late_event_total` metric;
- do not silently corrupt ordering.

## 10.3 Missing seconds

Choose one explicit chart policy:

### Default

Do not write an empty candle when no trades happened.

At query/render time, optionally fill gaps with:

```text
O = previous close
H = previous close
L = previous close
C = previous close
V = 0
```

Keep real stored data distinct from UI synthetic gap-fill.

---

# 11. Rollup Strategy

Persist:

```text
1s
1m
1h
1d
```

Recommended derived intervals:

```text
5s   ← 1s
15s  ← 1s
30s  ← 1s
5m   ← 1m
15m  ← 1m
30m  ← 1m
4h   ← 1h
1w   ← 1d
```

Do not persist every possible interval unless profiling proves it beneficial.

The API should make the existence of precomputed vs derived intervals invisible to the frontend.

---

# 12. QuestDB Storage Design

QuestDB stores time-series history.

Suggested tables:

```text
candles_1s
candles_1m
candles_1h
candles_1d
```

Example logical schema:

```sql
CREATE TABLE candles_1s (
    ts TIMESTAMP,
    instrument SYMBOL,
    provider SYMBOL,
    open DOUBLE,
    high DOUBLE,
    low DOUBLE,
    close DOUBLE,
    volume DOUBLE,
    trade_count LONG
) TIMESTAMP(ts)
PARTITION BY DAY;
```

For higher intervals use the same logical columns.

Use:

- designated timestamp;
- time partitioning;
- SYMBOL columns for repeated dimensions;
- batch/ILP ingestion;
- TTL/partition lifecycle where appropriate.

### Important

Do not insert a database row for every incoming ticker event unless there is a concrete use case.

Persist candles, not every UI movement.

---

# 13. Retention Policy — 128 GB Profile

The 128 GB deployment must prioritize **realtime fidelity over archival depth**. Realtime tick processing is not reduced; only historical high-resolution persistence is bounded.

Recommended policy:

| Data | Retention / Limit |
|---|---|
| raw exchange payload | none |
| normalized trade in JetStream | **5–15 minutes** |
| raw trade DB persistence | **disabled** |
| 1s candle — configured hot symbols only | **14–30 days** |
| 1m candle — broad universe | **180–365 days** |
| 1h candle | permanent |
| 1d candle | permanent |
| latest ticker | RAM / Valkey only |
| provider health/events | 1–3 days |
| Prometheus metrics | **7–14 days or 2–3 GB max** |
| application logs | **3–7 days and size capped** |

Default hot-symbol target: **10–30 instruments**. A temporary chart-open subscription may still process other instruments at full realtime speed without persisting their 1-second candles.

Example:

```yaml
retention:
  candle_1s_days: 21
  candle_1m_days: 365
  candle_1h_days: 0
  candle_1d_days: 0

  jetstream_trade_minutes: 10
  provider_status_hours: 24
  logs_days: 5
  prometheus_days: 10
```

`0` means permanent.

Do not configure per-symbol 1-second retention overrides above 30 days on the 128 GB profile unless disk telemetry proves sufficient headroom.

---

# 14. Storage Sizing Guidance — 128 GB Hard Budget

Second-level storage is the dominant database cost. One continuously traded instrument can produce up to:

```text
86,400 possible 1-second candles / day
2,592,000 / 30 days
31,536,000 / year
```

Therefore:

```text
Full universe        → realtime ticker + 1m history
Hot/favorite symbols → persisted 1s history
Currently opened     → realtime per-event updates even if not 1s-persisted
```

### 14.1 Target disk allocation

Treat 128 GB as a hard ceiling, not usable database capacity. Maintain **20–30 GB free headroom** for filesystem safety, WAL, backfill, temporary files and emergency recovery.

Recommended budget:

```text
128 GB disk
│
├── OS + Docker images/volumes      15–20 GB
├── QuestDB                          50–60 GB target
│   ├── 1s hot-symbol candles
│   ├── 1m broad-universe candles
│   ├── 1h permanent history
│   └── 1d permanent history
├── NATS / JetStream                  1–2 GB hard cap
├── Valkey                            <1 GB typical
├── Prometheus                        2–3 GB hard cap
├── Grafana                           <1 GB
├── application / proxy logs          1–2 GB hard cap
├── WAL / backfill / temp reserve      5–10 GB
└── REQUIRED FREE HEADROOM            20–30 GB
```

Operational target: keep normal usage below **70–75%** of the filesystem.

### 14.2 Automatic disk-pressure guard

Implement a storage guard in the market engine or a dedicated maintenance task.

```yaml
storage_guard:
  warning_percent: 70
  prune_1s_percent: 75
  aggressive_cleanup_percent: 80
  emergency_percent: 85
  minimum_free_gb: 20
```

Required behavior:

```text
>= 70%  → warning metric + alert
>= 75%  → prune oldest 1s partitions toward 14-day floor
>= 80%  → trim JetStream, logs and metrics aggressively; suspend optional backfill
>= 85%  → stop non-essential persistence before filesystem exhaustion
< 70%   → resume normal retention/backfill policy
```

Never delete 1h/1d history automatically unless explicitly configured.

### 14.3 Expected capacity

For a practical personal deployment:

```text
10–30 hot symbols
14–30 days of 1s OHLCV
500–1000 symbols with 6–12 months of 1m OHLCV
permanent 1h + 1d OHLCV
no raw trade archive
5–15 minute JetStream replay
```

This profile is designed to fit inside **128 GB** while retaining full sub-second realtime processing. Historical retention should adapt before disk usage exceeds safe thresholds.

---

# 15. Valkey Responsibilities

Valkey is **hot state**, not the source of truth.

Keys may include:

```text
ticker:BTC-USDT
provider:binance:status
market:BTC-USDT:source
session:hot-symbols
```

Ticker object:

```json
{
  "last": "112431.21",
  "bid": "112431.20",
  "ask": "112431.22",
  "high24h": "114102.00",
  "low24h": "109843.10",
  "volume24h": "...",
  "updatedAt": 1780000123123456789
}
```

Valkey makes gateway restart/scaling easier but is not required for every intra-service event.

Hot data should also remain in process-local memory for the fastest path.

---

# 16. Browser Realtime Gateway

Use Rust + Axum WebSocket.

Endpoint:

```text
WS /v1/stream
```

Client subscribe:

```json
{
  "op": "subscribe",
  "channels": [
    "ticker:BTC-USDT",
    "candle:1s:BTC-USDT",
    "candle:1m:BTC-USDT"
  ]
}
```

Server event:

```json
{
  "type": "candle",
  "instrument": "BTC-USDT",
  "interval": "1s",
  "final": false,
  "time": 1780000123,
  "open": 112431.10,
  "high": 112431.80,
  "low": 112430.90,
  "close": 112431.55,
  "volume": 1.817
}
```

Unsubscribe:

```json
{
  "op": "unsubscribe",
  "channels": ["candle:1s:BTC-USDT"]
}
```

---

# 17. Browser Update Strategy

Do not blindly redraw the UI for every upstream trade.

The backend may process every event while the browser gets controlled updates.

Recommended:

```text
price ticker     10–20 Hz max to browser
1s candle        update as trades arrive, coalesced 10–20 Hz
market table     2–5 Hz
24h stats        1–2 Hz
```

This preserves realtime feel without wasting main-thread/rendering work.

The chart engine still computes exact candles from all received trades server-side.

---

# 18. REST API

```text
GET /v1/health
GET /v1/providers
GET /v1/instruments
GET /v1/markets
GET /v1/ticker/:instrument
GET /v1/candles/:instrument
GET /v1/provider-status
```

Candle query:

```text
GET /v1/candles/BTC-USDT
    ?interval=1s
    &from=1780000000
    &to=1780003600
```

Response:

```json
{
  "instrument": "BTC-USDT",
  "interval": "1s",
  "source": "binance",
  "items": [
    {
      "time": 1780000000,
      "open": 112400.1,
      "high": 112402.7,
      "low": 112399.8,
      "close": 112401.9,
      "volume": 0.83
    }
  ]
}
```

Paginate / cap maximum range for 1s queries.

Do not allow a browser to request years of 1s data in one response.

---

# 19. Historical Loading Strategy

Trading chart load sequence:

```text
open BTC-USDT / 1s chart
          │
          ├── REST → load historical viewport
          │
          └── WS   → subscribe realtime
                       │
                       ▼
                 merge by candle timestamp
```

Order:

1. Establish realtime subscription.
2. Record subscription watermark.
3. Fetch historical viewport.
4. Merge historical candles.
5. Apply buffered realtime updates newer than watermark.

This prevents a gap between REST history and live subscription.

---

# 20. Backfill and Gap Repair

The system must assume networks fail.

When a provider reconnects:

```text
disconnect detected
      ↓
mark provider degraded
      ↓
reconnect with backoff + jitter
      ↓
resubscribe
      ↓
detect missing candle range
      ↓
backfill provider-supported interval
      ↓
repair history
      ↓
mark healthy
```

### Important for 1-second history

Not every venue provides arbitrary historical 1-second candles.

Therefore:

- locally collected 1s history is authoritative;
- use provider REST backfill where supported;
- otherwise mark a genuine historical gap rather than fabricating trade data;
- larger intervals may be easier to repair from provider historical endpoints.

Expose gaps in metrics and optionally in chart metadata.

---

# 21. Reconnect Policy

Each provider needs:

- heartbeat monitoring;
- stale-feed timeout;
- exponential backoff;
- jitter;
- automatic planned reconnect before provider-enforced connection lifetime;
- subscription replay;
- connection generation ID;
- duplicate event protection.

Example backoff:

```text
500 ms
1 s
2 s
4 s
8 s
15 s
30 s max
```

Reset after stable connection.

Do not reconnect every symbol independently if a shared connection failed.

---

# 22. Backpressure Rules

Every channel must be bounded.

Never create an unbounded Tokio channel on a market-data hot path.

For every queue define:

```text
capacity
producer behavior
consumer behavior
drop policy
metric
```

Examples:

### Trade → candle aggregator

Must not silently drop.

If overwhelmed:

- record pressure metric;
- slow upstream processing where possible;
- shed optional/non-hot streams before core hot streams.

### Aggregator → browser ticker

Coalescing is allowed.

If 30 price updates arrive before broadcast:

```text
send latest price
```

There is no value in delivering stale intermediate UI ticks.

---

# 23. Event Ordering and Deduplication

Provider adapters should retain venue sequence/trade IDs when available.

Normalized events should carry:

```text
provider
instrument
provider_event_id
provider_sequence
connection_generation
```

Use those to detect:

- duplicates after reconnect;
- out-of-order events;
- missing sequence ranges.

Candle aggregation should be idempotent where feasible.

---

# 24. Time Synchronization

For second-level charts this is mandatory.

Server clock must be synchronized via:

```text
chrony
```

Track:

```text
event_lag_ms = ingest_time - event_time
```

Expose p50 / p95 / p99 feed lag by provider.

Do not use frontend/browser clock for candle bucketing.

---

# 25. FX Architecture

FX is different from crypto.

There is no single decentralized public EUR/USD exchange equivalent to Binance BTC/USDT.

Therefore implement FX as a provider adapter class, not as a hard-coded source.

```text
Broker / venue stream
        ↓
FxProvider
        ↓
NormalizedQuote / Trade
        ↓
same NATS / candle / QuestDB pipeline
```

Possible future sources:

- a broker account's streaming pricing API;
- FIX/WebSocket feed provided by a broker;
- local bridge to a trading terminal if a broker already supplies data.

The architecture can remain free of SaaS market-data aggregators, but access terms of a broker feed are controlled by that broker.

Never label a slow reference FX rate as a realtime trading price.

Use quality metadata:

```text
REALTIME_BROKER
REFERENCE_RATE
DELAYED
```

---

# 26. Gold / Metals Architecture

Do not fake `XAU-USD` from an unrelated endpoint.

Support multiple source types:

### A. Direct/broker XAUUSD

```text
broker stream → XAU-USD
```

Best when available.

### B. Tokenized-gold proxy

Examples conceptually:

```text
PAXG-USDT
XAUT-USDT
```

These can use the normal crypto exchange path.

They are **proxies**, not literal institutional spot XAU/USD.

UI must display:

```text
PAXG/USDT
Asset type: tokenized gold
Source: exchange
```

Do not silently rename PAXG/USDT to XAU/USD.

---

# 27. Composite / Cross-Venue Prices

Later, support an optional composite ticker.

```text
Binance BTC-USDT ─┐
Kraken BTC-USD ───┼── normalization ──► composite
Coinbase BTC-USD ─┘
```

Possible algorithms:

- primary venue only;
- median of fresh venues;
- volume-weighted price;
- best bid/ask composite.

Every composite value must expose source metadata and staleness thresholds.

For V1, use one authoritative provider per instrument.

---

# 28. Provider Health State Machine

```text
DISCONNECTED
    ↓
CONNECTING
    ↓
SYNCING
    ↓
HEALTHY
    ↓
DEGRADED
    ↓
RECONNECTING
```

Health checks include:

- socket connected;
- heartbeat freshness;
- last market event age;
- subscription acknowledgement;
- event lag;
- sequence health;
- backfill status.

Frontend can display:

```text
BTC-USDT
● Live — Binance
```

or:

```text
BTC-USDT
● Degraded — reconnecting
```

---

# 29. Observability

Prometheus metrics should include at minimum:

```text
market_provider_connected
market_messages_total
market_parse_errors_total
market_reconnects_total
market_event_lag_ms
market_events_out_of_order_total
market_events_duplicate_total
market_late_events_total
market_candles_finalized_total
market_candle_persist_latency_ms
market_nats_publish_latency_ms
market_nats_consumer_lag
market_questdb_ingest_errors_total
market_ws_clients
market_ws_messages_total
market_ws_dropped_updates_total
process_cpu_seconds_total
process_resident_memory_bytes
```

Grafana dashboards:

### Feed dashboard

- provider connectivity;
- incoming msg/sec;
- lag p50/p95/p99;
- reconnects;
- parse errors.

### Aggregator dashboard

- candles/sec;
- late events;
- queue depth;
- persistence latency.

### Gateway dashboard

- connected clients;
- subscriptions;
- messages/sec;
- coalesced/dropped UI updates.

### Infrastructure dashboard

- CPU;
- RAM;
- disk usage;
- disk IO;
- QuestDB size;
- NATS storage;
- network throughput.

---

# 30. Logging

Use Rust `tracing` with structured JSON logs.

Every important log should include fields such as:

```text
provider
instrument
connection_id
subscription_id
event_id
latency_ms
```

Do not log every trade in production.

Use metrics for high-volume events.

Log:

- connection lifecycle;
- subscription changes;
- errors;
- gaps;
- backfill;
- stale feeds;
- persistence failures.

---

# 31. Frontend Architecture

```text
Next.js
│
├── Market overview
│   ├── symbol
│   ├── price
│   ├── 24h change
│   ├── volume
│   └── provider status
│
├── Trading chart
│   ├── 1s
│   ├── 5s
│   ├── 15s
│   ├── 30s
│   ├── 1m
│   ├── 5m
│   ├── 15m
│   ├── 1h
│   ├── 4h
│   └── 1d
│
├── Watchlist
│
└── Provider / latency indicator
```

Recommended frontend data pattern:

```text
REST = historical state
WS   = new state
```

Do not poll prices.

---

# 32. Chart Performance

For 1-second charts:

- request only visible time range + small preload;
- do not send hundreds of thousands of candles at once;
- use cursor/range pagination;
- aggregate server-side for zoomed-out views;
- subscribe to live candle after historical load;
- keep chart state incremental.

Example:

```text
1s chart initial viewport: last 15–60 min
```

When user scrolls left:

```text
fetch older 15–60 min window
```

Never load 90 days of 1s candles into the browser in one request.

---

# 33. REST Cache Rules

Historical candle responses can be cached because finalized candles do not change often.

Examples:

```text
old finalized range   cache aggressively
current active candle no-cache
instrument metadata  cache minutes/hours
```

The gateway may keep small recent query windows in memory.

Do not introduce Redis caching for every query until profiling shows a need.

---

# 34. Security

Only expose:

```text
443 → reverse proxy
```

Internal services stay on private Docker network:

```text
NATS
QuestDB
Valkey
Prometheus
Grafana
```

Do not expose QuestDB admin/web console to the public internet.

If remote personal access is needed, use one of:

- VPN;
- Cloudflare Access/Tunnel;
- reverse proxy authentication.

Apply WebSocket origin validation and connection limits even for personal deployments.

---

# 35. Docker Compose Topology

```text
services:

  web
    Next.js

  collector
    Rust

  aggregator
    Rust

  gateway
    Rust/Axum

  backfill
    Rust scheduled worker

  nats
    NATS + JetStream

  valkey
    latest shared state

  questdb
    OHLCV history

  prometheus
    metrics

  grafana
    dashboards

  caddy
    TLS / reverse proxy
```

Suggested Docker networks:

```text
edge
internal
observability
```

Only Caddy joins the public edge network.

---

# 36. Resource Isolation

Do not allow one service to kill the whole server.

Configure Compose limits/reservations where supported.

Priority:

```text
1. collector
2. aggregator
3. QuestDB
4. gateway
5. NATS
6. web
7. Grafana/Prometheus
```

QuestDB data directory must use SSD/NVMe storage.

Avoid running high-write QuestDB data on slow HDD if realtime 1s retention is enabled.

---

# 37. Failure Modes

## Upstream exchange down

```text
mark provider degraded
switch fallback if configured
continue serving stored history
show source state in UI
```

## NATS down

Collectors should reconnect and use bounded local queues.

Do not buffer unlimited data in RAM.

## QuestDB down

Realtime ticker/chart can continue temporarily from in-memory state.

Persist failure metrics and retry bounded batches.

## Valkey down

Gateway may continue using local live events.

Valkey should not be required to compute candles.

## Gateway down

Collectors and aggregator continue unaffected.

Browser reconnects with exponential backoff.

## Web frontend down

Market ingestion continues unaffected.

---

# 38. Graceful Shutdown

Every Rust service must handle SIGTERM/SIGINT.

Collector:

1. stop accepting new subscription changes;
2. unsubscribe/close connections cleanly when practical;
3. flush metrics/logs.

Aggregator:

1. stop pulling new events;
2. finalize safe completed candles;
3. flush persistence batch;
4. acknowledge JetStream messages;
5. exit.

Gateway:

1. stop new HTTP/WS connections;
2. close existing WS with restart code;
3. exit.

---

# 39. Configuration

Example:

```yaml
server:
  timezone: UTC

nats:
  url: nats://nats:4222

questdb:
  host: questdb
  ilp_port: 9009

providers:
  binance:
    enabled: true
    reconnect_before_venue_expiry: true

  kraken:
    enabled: true

universe:
  - BTC-USDT
  - ETH-USDT
  - SOL-USDT
  - BNB-USDT
  - PAXG-USDT

hot_symbols:
  - BTC-USDT
  - ETH-USDT
  - SOL-USDT
  - PAXG-USDT

candles:
  persist:
    - 1s
    - 1m
    - 1h
    - 1d

retention:
  candle_1s_days: 21
  candle_1m_days: 365
  candle_1h_days: 0
  candle_1d_days: 0
  jetstream_trade_minutes: 10
  logs_days: 5
  prometheus_days: 10

storage_limits:
  questdb_target_gb: 60
  jetstream_max_gb: 2
  prometheus_max_gb: 3
  logs_max_gb: 2
  minimum_free_gb: 20

storage_guard:
  warning_percent: 70
  prune_1s_percent: 75
  aggressive_cleanup_percent: 80
  emergency_percent: 85
```

`0` means permanent.

---

# 40. Testing Strategy

## Unit tests

- symbol mapping;
- JSON parser fixtures;
- candle bucketing;
- OHLCV calculations;
- late events;
- duplicate events;
- rollups;
- time boundaries;
- UTC day/week boundaries.

## Fixture tests

Save real sanitized exchange messages as fixtures.

```text
fixtures/binance/trades.jsonl
fixtures/kraken/ticker.jsonl
```

Replay them deterministically.

## Integration tests

```text
mock provider
    ↓
collector
    ↓
NATS
    ↓
aggregator
    ↓
QuestDB
    ↓
gateway
```

Assert chart data end-to-end.

## Chaos tests

Test:

- socket disconnect;
- malformed message;
- NATS restart;
- QuestDB restart;
- 5-second server pause;
- provider reconnect;
- duplicate batch;
- out-of-order events;
- clock offset warning.

---

# 41. Benchmark Targets

Do not optimize based on synthetic WebSocket echo benchmarks alone.

Benchmark the real pipeline:

```text
JSON feed
→ parse
→ normalize
→ NATS
→ candle
→ QuestDB
→ gateway
```

Initial acceptance targets for a personal serious server:

```text
steady-state event loss:        0 for hot-symbol trade pipeline
1s candle finalization delay:   < 250 ms target after grace window
browser ticker delivery p95:    < 250 ms from local ingestion
REST recent candle p95:         < 100 ms on warm DB
reconnect recovery:             automatic
unbounded queues:               0
```

These are engineering targets, not guarantees of upstream exchange latency.

---

# 42. Development Phases

## Phase 0 — Repository and infrastructure

- [ ] Create Rust workspace.
- [ ] Create Next.js app.
- [ ] Add Docker Compose.
- [ ] Add NATS JetStream.
- [ ] Add QuestDB.
- [ ] Add Valkey.
- [ ] Add Prometheus.
- [ ] Add Grafana.
- [ ] Add Caddy/Nginx.
- [ ] Configure chrony on host.
- [ ] Add `.env.example` and YAML config loader.
- [ ] Add health endpoints for every service.

---

## Phase 1 — Domain core

- [ ] Implement `Instrument`.
- [ ] Implement `TradeEvent`.
- [ ] Implement `TickerState`.
- [ ] Implement `Candle`.
- [ ] Implement interval/bucket utilities.
- [ ] Implement decimal/fixed-point strategy.
- [ ] Define normalized event protocol.
- [ ] Define NATS subject naming.
- [ ] Add serialization compatibility tests.

---

## Phase 2 — Binance collector

- [ ] Instrument discovery.
- [ ] WebSocket connection manager.
- [ ] Trade subscriptions.
- [ ] Ticker subscriptions.
- [ ] Ping/pong handling.
- [ ] Planned reconnect.
- [ ] Automatic resubscription.
- [ ] Message parser fixtures.
- [ ] Normalize provider timestamps.
- [ ] Publish normalized events to NATS.
- [ ] Metrics.

Acceptance:

```text
BTC-USDT trades flow continuously into NATS for 24+ hours
without manual intervention.
```

---

## Phase 3 — Candle engine

- [ ] Consume normalized trades.
- [ ] Implement 1s candle aggregation.
- [ ] Partial candle updates.
- [ ] Candle finalization.
- [ ] Late-event window.
- [ ] Duplicate protection.
- [ ] Generate 1m from 1s.
- [ ] Generate 1h from 1m.
- [ ] Generate 1d from 1h.
- [ ] Publish derived candles to NATS.
- [ ] Persist finalized candles to QuestDB.

Acceptance:

```text
1-second chart history and live candles remain correct
across minute/hour/day boundaries.
```

---

## Phase 4 — QuestDB

- [ ] Create candle schemas.
- [ ] Implement batched ILP ingestion.
- [ ] Query repository.
- [ ] Range queries.
- [ ] Interval aggregation.
- [ ] Retention jobs / TTL strategy.
- [ ] Disk size metrics.
- [ ] Query benchmarks.

---

## Phase 5 — Realtime gateway

- [ ] Axum REST server.
- [ ] WebSocket endpoint.
- [ ] Subscribe/unsubscribe protocol.
- [ ] NATS consumers.
- [ ] Per-client subscriptions.
- [ ] Ticker coalescing.
- [ ] Candle coalescing.
- [ ] Connection heartbeats.
- [ ] Client reconnect support.
- [ ] Range limits for 1s history.

---

## Phase 6 — Frontend

- [ ] Market table.
- [ ] Watchlist.
- [ ] Realtime price updates.
- [ ] Candlestick chart.
- [ ] 1s timeframe.
- [ ] 5s / 15s / 30s derived timeframes.
- [ ] 1m / 5m / 15m / 30m / 1h / 4h / 1d.
- [ ] Infinite-left historical loading.
- [ ] Provider health indicator.
- [ ] Feed latency indicator.
- [ ] Reconnecting state.
- [ ] Chart gap marker/debug mode.

---

## Phase 7 — Backfill / integrity

- [ ] Detect missing candle windows.
- [ ] Implement provider REST backfill.
- [ ] Repair supported historical ranges.
- [ ] Track unrecoverable 1s gaps.
- [ ] Data-integrity scheduled job.
- [ ] Compare rollups against provider candles for validation.

---

## Phase 8 — Multi-provider

- [ ] Kraken adapter.
- [ ] Coinbase adapter.
- [ ] OKX adapter.
- [ ] Bybit adapter.
- [ ] Provider priority.
- [ ] Automatic fallback.
- [ ] Cross-provider symbol mapping.
- [ ] Source metadata in API/UI.

---

## Phase 9 — Production hardening

- [ ] Bounded queues everywhere.
- [ ] Backpressure tests.
- [ ] Graceful shutdown.
- [ ] Docker restart policies.
- [ ] Resource limits.
- [ ] Structured logs.
- [ ] Grafana dashboards.
- [ ] Alert rules for feed stale / disk high / DB failure.
- [ ] Backup strategy.
- [ ] Restore test.
- [ ] Security review.

---

## Phase 10 — FX and gold

- [ ] Add `FxProvider` adapter interface.
- [ ] Add broker-stream integration when a suitable feed is available.
- [ ] Add quote-vs-trade semantics.
- [ ] Add provider quality labels.
- [ ] Add direct XAUUSD provider when available.
- [ ] Add tokenized-gold markets separately.
- [ ] Prevent proxy instruments from being mislabeled as spot gold.

---

# 43. What NOT to Build Initially

Even with a serious architecture, avoid pointless complexity.

Do NOT add yet:

- Kubernetes;
- Kafka/Redpanda in addition to NATS;
- Elasticsearch;
- service mesh;
- distributed tracing cluster;
- permanent raw order-book storage;
- permanent every-trade storage for all instruments;
- multi-region replication;
- custom consensus;
- dozens of microservices.

One strong server with Docker Compose is sufficient.

---

# 44. Initial Production Deployment

Recommended first serious deployment:

```text
1 physical server / VM host

Docker Compose
│
├── caddy
├── web
├── collector
├── aggregator
├── gateway
├── backfill
├── nats
├── valkey
├── questdb
├── prometheus
└── grafana
```

Preferred hardware characteristics:

```text
CPU:      modern 4+ strong cores
RAM:      16 GB minimum, 32 GB comfortable
Storage:  128 GB SSD/NVMe supported by this profile
           keep 20–30 GB free headroom
Network:  stable low-loss internet connection
Clock:    chrony synchronized
```

For a personal terminal, this provides enormous headroom while still keeping the architecture clean.

---

# 45. Recommended Data Policy

### Market overview

```text
all enabled symbols
→ ticker only
→ no raw trade persistence
```

### Favorite/hot symbols

```text
trade stream
→ exact realtime ticker
→ 1s candles
→ 14–30d 1s retention
→ 6–12mo 1m history
→ permanent 1h / 1d
```

### Open chart

```text
historical REST
+
live WS
```

This is the key balance between "serious" and "wasteful."

---

# 45.1 128 GB Non-Negotiable Storage Rules

- Never persist raw trades or raw order-book deltas long-term.
- Persist `1s` candles only for configured hot symbols.
- Keep hot-symbol defaults at 10–30 instruments.
- Keep `1s` retention at 14–30 days.
- Keep broad-universe `1m` retention at 6–12 months.
- Keep JetStream replay at 5–15 minutes and cap it at 2 GB.
- Cap Prometheus storage at roughly 2–3 GB and logs at roughly 1–2 GB.
- Maintain at least 20 GB free disk space.
- Automatically reduce high-resolution retention before the filesystem reaches 85% usage.
- Realtime browser updates remain per-event/sub-second regardless of persistence retention.

---

# 46. Final Architecture Decision

Use:

```text
Rust + Tokio
      │
      ├── native exchange WebSockets
      ├── provider normalization
      ├── candle engine
      ├── realtime gateway
      └── backfill

NATS + JetStream
      │
      └── event bus + short replay

Valkey
      │
      └── current shared state

QuestDB OSS
      │
      └── 1s / 1m / 1h / 1d OHLCV

Next.js
      │
      └── terminal UI

Prometheus + Grafana
      │
      └── observability
```

### Primary design rule

> **Process every realtime event that matters, but persist only the data you actually need.**

For the trading chart:

```text
upstream trade events      → processed realtime
browser price movement     → realtime
current candle             → realtime
1-second OHLCV             → 14–30d for hot symbols
1-minute OHLCV             → 6–12mo for broad universe
1-hour / 1-day OHLCV       → permanent history
raw payloads               → not permanently stored
```

This architecture has enough headroom to remain useful even if the project later expands from a private terminal into a much larger self-hosted market-data platform.

---

# 46.1 Default 128 GB Deployment Profile

```text
Realtime processing:       per event / sub-second
Persisted high resolution: 1s
Hot symbols:               10–30 default
1s retention:              21 days default, 30 max target
1m retention:              365 days default
1h retention:              permanent
1d retention:              permanent
Raw trade archive:         disabled
JetStream replay:          10 minutes default
QuestDB target:            <= 60 GB
JetStream hard cap:        2 GB
Prometheus hard cap:       3 GB
Logs hard cap:             2 GB
Minimum free disk:         20 GB
Emergency threshold:       85% filesystem usage
```

This is the default implementation target unless the deployment is explicitly moved to a larger disk profile.

---

# 47. Upstream / Infrastructure Notes (September 2026)

- Binance native WebSocket market streams have venue-level technical constraints including planned connection lifetime, incoming control-message limits and per-connection stream limits. Treat these as protocol rules and automate reconnect/subscription sharding.
- QuestDB OSS is designed specifically for high-throughput time-series ingestion and time-oriented SQL queries such as `SAMPLE BY`, making it appropriate for OHLCV history.
- NATS provides low-latency messaging; JetStream adds bounded replay/durability for crash recovery without turning the message broker into permanent market-history storage.

Reference documentation:

- Binance WebSocket Market Streams: https://developers.binance.com/en/docs/products/derivatives-trading-coin-futures/websocket-market-streams/Connect
- QuestDB docs: https://questdb.com/docs
- NATS docs: https://docs.nats.io

