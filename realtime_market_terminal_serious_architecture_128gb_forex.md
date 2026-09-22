# Realtime Market Terminal — Serious Self-Hosted Architecture (Crypto + Forex)

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
- Crypto + **realtime FX currencies**.
- Architecture remains ready for metals/gold later.
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
│   │       │   ├── bybit/
│   │       │   ├── fx_mt5_bridge/
│   │       │   ├── fx_dukascopy/
│   │       │   └── fx_oanda_optional/
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

pub enum MarketDataKind {
    Trade,      // crypto/exchange trade print
    Quote,      // FX bid/ask update
    Reference,  // slow official/reference rate
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



---

# 48. Forex / Currency Realtime Extension

This section upgrades the 128 GB architecture from a crypto-first terminal into a **multi-asset realtime market terminal with native FX support**.

The implementation goal is:

```text
EUR/USD
GBP/USD
USD/JPY
AUD/USD
USD/CAD
USD/CHF
NZD/USD
EUR/JPY
EUR/GBP
GBP/JPY
USD/SGD
USD/IDR (reference/fallback when no streaming broker venue is configured)
```

with:

- sub-second live quote updates when the upstream venue provides them;
- 1-second historical candles for configured hot FX pairs;
- bid / ask / mid visibility;
- spread tracking;
- 1m / 5m / 15m / 30m / 1h / 4h / 1d charting;
- automatic reconnect and session-state handling;
- no dependency on metered SaaS market-data products;
- no fake assumption that FX has a single universal exchange price.

## 48.1 Important FX model difference

Crypto exchange feeds commonly emit **trades**:

```text
price + quantity + aggressor side
```

Retail/interbank FX feeds commonly emit **quotes**:

```text
bid + ask + timestamp
```

Therefore DO NOT reuse the crypto trade event as the canonical FX event.

Add a dedicated normalized quote event.

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QuoteTick {
    pub instrument_id: InstrumentId,    // EUR-USD
    pub provider: ProviderId,
    pub provider_symbol: String,        // EURUSD / EUR_USD

    pub bid: Decimal,
    pub ask: Decimal,
    pub mid: Decimal,

    pub provider_ts_ns: i64,
    pub ingest_ts_ns: i64,

    pub sequence: Option<u64>,
    pub tradeable: Option<bool>,

    pub bid_size: Option<Decimal>,
    pub ask_size: Option<Decimal>,
}
```

Calculate:

```text
mid = (bid + ask) / 2
spread = ask - bid
spread_bps = ((ask - bid) / mid) * 10,000
```

Never manufacture a last-trade price if the provider only gives bid/ask.

---

# 49. FX Upstream Strategy — No Freemium Market-Data Dependency

There is no single Binance-like universal public exchange for spot FX. Realtime FX must come from a **broker / venue / trading terminal feed**.

The system therefore uses provider adapters and clearly records provenance.

## 49.1 Provider priority

### Tier A — preferred: broker-native MetaTrader 5 feed via local bridge

Use when a broker account or demo terminal provides the desired FX symbols.

```text
Broker FX Server
      ↓
MetaTrader 5 Terminal
      ↓
MQL5 Tick Bridge
      ↓ TCP localhost/private LAN
Rust FX Bridge Receiver
      ↓
Normalized QuoteTick
      ↓
NATS → Aggregator → QuestDB → Gateway
```

This is not a SaaS market-data free tier. The market data is the broker's native terminal feed.

Constraints:

- requires MetaTrader 5 + a broker connection;
- data quality and symbol names depend on the broker;
- the broker may have its own account / market-data terms;
- the broker quote is a **venue/broker price**, not a universal consolidated FX price.

### Tier B — Dukascopy JForex adapter

Use a small Java sidecar using the JForex SDK.

```text
Dukascopy trade servers
       ↓
JForex SDK sidecar
       ↓
NATS / local TCP
       ↓
Rust normalizer
```

Use this as an alternate FX source and for historical tick/bar repair where permitted by the account/session.

### Tier C — OANDA v20 adapter (optional fallback)

OANDA is acceptable as an account-backed direct pricing stream, but it is **not the preferred high-frequency source** for this project.

Important implementation behavior:

```text
OANDA stream
→ at most 4 price updates/sec/instrument
→ not every raw underlying price is delivered
```

Use it for:

- backup realtime pricing;
- pair coverage;
- gap validation;
- slower personal charting.

Do not label it as raw-tick-complete.

### Tier D — official reference rates

ECB/reference rates are validation/reference sources only.

```text
EUR reference rates
→ daily / working-day reference
→ NOT realtime trading data
```

They may be used for:

- sanity checking;
- previous-day reference;
- slow currency converter views;
- detecting a broken broker feed.

They MUST NOT drive the live FX chart.

---

# 50. Forex Provider Trait

Extend `provider-core` with a quote-oriented trait.

```rust
#[async_trait]
pub trait FxQuoteProvider: Send + Sync {
    fn id(&self) -> ProviderId;

    async fn discover_instruments(&self) -> Result<Vec<Instrument>>;

    async fn run_quotes(
        &self,
        instruments: &[InstrumentId],
        out: QuoteSender,
        shutdown: CancellationToken,
    ) -> Result<()>;

    async fn historical_bars(
        &self,
        instrument: &InstrumentId,
        timeframe: Timeframe,
        from_ns: i64,
        to_ns: i64,
    ) -> Result<Vec<Candle>>;

    async fn health(&self) -> ProviderHealth;
}
```

Provider-specific details remain inside adapters.

```text
MT5 symbol:      EURUSD.a
OANDA symbol:    EUR_USD
Dukascopy:       EUR/USD
Canonical:       EUR-USD
```

Never expose provider symbol naming to the frontend.

---

# 51. Instrument Registry Changes

Extend `Instrument`:

```rust
pub struct Instrument {
    pub id: InstrumentId,
    pub base: String,
    pub quote: String,
    pub asset_class: AssetClass,

    pub provider: ProviderId,
    pub provider_symbol: String,

    pub price_scale: u32,
    pub quantity_scale: u32,

    pub market_data_kind: MarketDataKind,
    pub session_kind: SessionKind,
    pub candle_price_basis: CandlePriceBasis,
    pub enabled: bool,
}
```

Add:

```rust
pub enum CandlePriceBasis {
    Trade,
    Mid,
    Bid,
    Ask,
}

pub enum VolumeKind {
    RealTradeVolume,
    ProviderVolume,
    TickCount,
    None,
}

pub enum SessionKind {
    TwentyFourSeven,
    FxTwentyFourFive,
    ProviderControlled,
}
```

Defaults:

```text
Crypto spot:
price basis = Trade
volume      = RealTradeVolume
session     = TwentyFourSeven

FX:
price basis = Mid
volume      = TickCount
session     = ProviderControlled
```

---

# 52. MT5 Realtime Bridge — Recommended Primary Personal FX Adapter

The MT5 bridge consists of two parts.

```text
apps/
├── mt5-bridge-ea/
│   └── MarketBridge.mq5
│
└── fx-bridge-receiver/
    └── Rust
```

## 52.1 MQL5 bridge responsibilities

The EA runs in MetaTrader 5 and forwards quote changes to a local TCP receiver.

Use the terminal's native socket API:

```text
SocketCreate
SocketConnect
SocketSend
SocketIsConnected
SocketClose
```

The receiver address must be explicitly allowed/configured in the terminal.

Do NOT send HTTP requests per tick.

Use one persistent TCP connection.

### Wire payload

Prefer compact NDJSON initially:

```json
{"v":1,"type":"quote","symbol":"EURUSD","bid":"1.18123","ask":"1.18131","ts_ms":1780000000123}
```

Future optimization:

```text
NDJSON
  ↓ if profiling proves necessary
MessagePack / custom binary framing
```

Do not optimize the transport prematurely.

## 52.2 Multiple FX symbols

An MQL5 `OnTick()` event applies to the symbol of the chart where the EA is attached. Do not assume one chart's `OnTick()` gives events for every FX symbol.

Implementation options:

1. attach one bridge EA instance per watched symbol; or
2. implement a controlled polling/timer bridge using `SymbolInfoTick()` for a configured symbol list; or
3. use broker/platform events available for the required market-depth path.

For this personal deployment, preferred rollout:

```text
Phase 1:
10–20 hot FX pairs
one EA instance per chart/symbol

Phase 2:
benchmark centralized timer polling if maintaining many chart instances becomes annoying
```

The Rust receiver deduplicates unchanged ticks.

## 52.3 Rust bridge receiver

Create:

```text
apps/fx-bridge-receiver/
```

Responsibilities:

```text
accept TCP
→ authenticate local bridge
→ frame NDJSON
→ validate timestamp
→ map provider symbol
→ Decimal parse
→ reject invalid crossed quote
→ calculate mid/spread
→ publish QuoteTick
```

Reject:

```text
bid <= 0
ask <= 0
ask < bid
unknown symbol
stale timestamp beyond configured tolerance
malformed decimals
```

Allow duplicate bid/ask values but deduplicate before publication when timestamp/value are identical.

---

# 53. NATS Subject Layout for FX

Add:

```text
market.fx.quote.<provider>.<instrument>
market.fx.status.<provider>.<instrument>
market.fx.session.<provider>.<instrument>
market.fx.spread.<provider>.<instrument>
```

Examples:

```text
market.fx.quote.mt5.EUR-USD
market.fx.quote.dukascopy.EUR-USD
market.fx.quote.oanda.GBP-USD
```

Normalized message:

```json
{
  "type": "quote",
  "instrument": "EUR-USD",
  "assetClass": "fx",
  "provider": "mt5",
  "bid": "1.18123",
  "ask": "1.18131",
  "mid": "1.18127",
  "spread": "0.00008",
  "providerTsNs": 1780000000123000000,
  "ingestTsNs": 1780000000125000000
}
```

JetStream remains short-lived under the 128 GB profile:

```text
FX quote replay target: 10 minutes
shared JetStream hard cap: 2 GB
```

Do not persist full FX ticks in QuestDB by default.

---

# 54. FX Candle Engine

The existing candle engine must support `QuoteTick` in addition to `TradeTick`.

## 54.1 Default price basis

Use mid-price:

```text
mid = (bid + ask) / 2
```

For each quote:

```text
open   = first mid in bucket
high   = max(mid)
low    = min(mid)
close  = last mid in bucket
volume = quote/tick count
```

Store the volume semantics explicitly.

```text
volume_kind = tick_count
```

Do NOT display FX tick count as if it were centralized traded notional volume.

## 54.2 1-second candles

Bucket by event time:

```text
bucket_start = floor(provider_ts / 1 second)
```

Each hot pair gets:

```text
1s mid OHLC
spread_open
spread_high
spread_low
spread_close
tick_count
```

Recommended extended model:

```rust
pub struct FxCandle {
    pub instrument_id: InstrumentId,
    pub provider: ProviderId,
    pub ts: i64,
    pub timeframe: Timeframe,

    pub open: Decimal,
    pub high: Decimal,
    pub low: Decimal,
    pub close: Decimal,

    pub tick_count: u32,

    pub spread_open: Decimal,
    pub spread_high: Decimal,
    pub spread_low: Decimal,
    pub spread_close: Decimal,

    pub price_basis: CandlePriceBasis,
}
```

## 54.3 Missing seconds

Do not blindly fill every missing second.

Rules:

```text
market open + connection healthy + no quote:
→ optionally carry-forward close only for chart continuity
→ mark candle synthetic=true

provider disconnected:
→ DO NOT fabricate candle

market closed:
→ DO NOT fabricate candle
```

Synthetic candles must be distinguishable from observed candles.

---

# 55. FX Session Handling

FX is not 24/7.

Do not hard-code one universal weekend-open/weekend-close timestamp because provider/broker sessions and DST may differ.

Priority:

```text
1. provider's tradeable/session status
2. provider instrument metadata
3. configured fallback calendar
```

Maintain:

```rust
pub enum MarketSessionState {
    Open,
    Closed,
    PreOpen,
    Halted,
    Unknown,
}
```

Gateway response:

```json
{
  "instrument": "EUR-USD",
  "session": "open",
  "provider": "mt5",
  "lastQuoteAt": 1780000000123
}
```

Frontend must visually distinguish:

```text
LIVE
MARKET CLOSED
FEED STALE
RECONNECTING
```

---

# 56. Stale Feed Detection

FX providers can stop sending quotes because:

```text
market quiet
market closed
network failure
terminal disconnected
broker disconnected
provider failure
```

Track independently:

```text
last_network_message
last_quote_change
last_provider_heartbeat
provider_session_state
```

Suggested thresholds while market is expected open:

```text
warning stale:   5 seconds
hard stale:     15 seconds
reconnect:      provider-specific
```

These are configuration values, not hardcoded constants.

Never reconnect aggressively solely because the price did not change.

---

# 57. Provider Failover

Multiple providers can quote different prices. Do not silently stitch them into one candle without recording source changes.

Recommended strategy:

```text
EUR-USD
primary:   mt5-broker-A
secondary: dukascopy
tertiary:  oanda
```

Failover rules:

```text
primary healthy
→ use primary

primary stale
→ mark source degraded
→ switch to secondary
→ emit provider_switch event

primary recovers
→ require stable grace window
→ switch back only after validation
```

Before switching, sanity-check:

```text
abs(new_mid - old_mid) / old_mid < configurable threshold
```

Persist provider ID with every candle.

Never pretend data from multiple venues is one continuous authoritative tape.

---

# 58. Synthetic Cross Rates

The engine MAY calculate cross rates when direct pairs are unavailable.

Examples:

```text
EUR-USD × USD-JPY = EUR-JPY
GBP-USD / EUR-USD = GBP-EUR
```

Represent synthetic instruments explicitly:

```rust
pub enum InstrumentOrigin {
    Direct,
    Synthetic,
    Reference,
}
```

For bid/ask cross calculations, use direction-aware math, not simply mid × mid.

Example for `EUR/JPY` from `EUR/USD` and `USD/JPY`:

```text
EURJPY bid = EURUSD bid × USDJPY bid
EURJPY ask = EURUSD ask × USDJPY ask
```

Only publish synthetic rates if both legs are fresh.

Default maximum leg age:

```text
<= 2 seconds
```

Frontend must label synthetic rates.

Prefer direct venue pair when available.

---

# 59. QuestDB FX Schema

Do NOT store every normalized quote indefinitely.

Persist primarily candles.

## 59.1 1-second FX table

Conceptual schema:

```sql
CREATE TABLE fx_candles_1s (
    ts TIMESTAMP,
    instrument SYMBOL,
    provider SYMBOL,

    open DOUBLE,
    high DOUBLE,
    low DOUBLE,
    close DOUBLE,

    spread_open DOUBLE,
    spread_high DOUBLE,
    spread_low DOUBLE,
    spread_close DOUBLE,

    tick_count INT,
    synthetic BOOLEAN,
    price_basis SYMBOL
) TIMESTAMP(ts) PARTITION BY DAY WAL;
```

## 59.2 lower resolution

```text
fx_candles_1m
fx_candles_1h
fx_candles_1d
```

Do not create physical 5m / 15m / 30m / 4h / 1w tables initially.

Generate:

```text
5m/15m/30m ← 1m
4h          ← 1h
1w          ← 1d
```

---

# 60. FX Storage Policy for the 128 GB Server

The existing global disk budget remains unchanged.

Recommended FX profile:

```text
hot FX pairs:             10–20
1s FX retention:          14 days default
1s max target:            21 days
1m FX retention:          365 days
1h FX retention:          permanent
1d FX retention:          permanent
raw quotes in QuestDB:    disabled
NATS quote replay:        10 minutes
```

Approximate effect is intentionally bounded by the same disk guard used for crypto.

When filesystem usage rises:

```text
>=70% warn
>=75% prune oldest 1s FX + crypto candles
>=80% reduce 1s retention target to 7–14d
>=85% stop non-essential high-resolution persistence
```

Realtime quote delivery continues even when high-resolution persistence is degraded.

---

# 61. FX Backfill Strategy

Realtime and history are separate concerns.

On startup:

```text
1. load last stored candle
2. inspect provider availability
3. request historical bars for the gap when provider supports it
4. normalize historical bars
5. store missing 1m/1h/1d
6. begin realtime quote stream
7. start new 1s candles from live data
```

Do not attempt to recreate historical 1-second candles from 1-minute bars.

Historical 1-second data is best-effort unless the configured provider exposes historical ticks.

If tick history exists:

```text
historical ticks
→ replay through same candle engine
→ deterministic 1s reconstruction
```

This is preferred to writing provider-specific candle conversion code.

---

# 62. FX REST API

Add endpoints:

```text
GET /api/v1/fx/instruments
GET /api/v1/fx/markets
GET /api/v1/fx/ticker/EUR-USD
GET /api/v1/fx/candles/EUR-USD?tf=1s&from=...&to=...
GET /api/v1/fx/candles/EUR-USD?tf=1m&from=...&to=...
GET /api/v1/fx/providers/EUR-USD
GET /api/v1/fx/session/EUR-USD
```

Example ticker:

```json
{
  "instrument": "EUR-USD",
  "assetClass": "fx",
  "provider": "mt5",
  "bid": 1.18123,
  "ask": 1.18131,
  "mid": 1.18127,
  "spread": 0.00008,
  "spreadBps": 0.6772,
  "change24hPct": -0.12,
  "session": "open",
  "timestamp": 1780000000123
}
```

---

# 63. Browser WebSocket Protocol

Reuse the existing gateway.

Subscribe:

```json
{
  "op": "subscribe",
  "channels": [
    "ticker:EUR-USD",
    "candle:EUR-USD:1s"
  ]
}
```

Quote message:

```json
{
  "type": "fx_quote",
  "instrument": "EUR-USD",
  "provider": "mt5",
  "bid": 1.18123,
  "ask": 1.18131,
  "mid": 1.18127,
  "ts": 1780000000123
}
```

Candle update:

```json
{
  "type": "candle_update",
  "instrument": "EUR-USD",
  "tf": "1s",
  "priceBasis": "mid",
  "t": 1780000000000,
  "o": 1.18125,
  "h": 1.18128,
  "l": 1.18124,
  "c": 1.18127,
  "ticks": 7,
  "spreadClose": 0.00008
}
```

---

# 64. Frontend FX UX

Instrument switcher:

```text
CRYPTO
BTC/USDT
ETH/USDT
SOL/USDT

FOREX
EUR/USD
GBP/USD
USD/JPY
EUR/JPY
GBP/JPY
```

FX header:

```text
EUR / USD
1.18127
-0.12%

BID 1.18123
ASK 1.18131
SPREAD 0.8 pip

Provider: Broker A / MT5
● LIVE
```

The UI must show source/provider because FX quotes are venue-specific.

For FX chart:

```text
price basis: MID
```

Optionally allow:

```text
MID | BID | ASK
```

Do not show fake centralized volume bars.

Instead show one of:

```text
Tick activity
Tick count
Spread
```

---

# 65. Pip / Precision Handling

Never calculate display precision using JS floating-point assumptions alone.

Metadata per pair:

```rust
pub struct FxMetadata {
    pub pip_size: Decimal,
    pub display_decimals: u8,
    pub contract_size: Option<Decimal>,
}
```

Typical examples:

```text
EUR/USD pip: 0.0001
GBP/USD pip: 0.0001
USD/JPY pip: 0.01
```

But use provider instrument metadata where available.

Spread pips:

```text
spread_pips = spread / pip_size
```

Use Rust decimal/fixed-point handling internally where practical.

---

# 66. 24h Change Semantics for FX

Crypto uses continuous 24/7 time naturally.

FX has weekends and session boundaries.

Expose both:

```text
rolling24hChangePct
sessionChangePct
```

Do not calculate weekend 24h change using fabricated candles.

If no quote existed exactly 24h ago:

```text
find last valid observed candle <= target timestamp
```

and label metric semantics internally.

---

# 67. Observability Additions

Prometheus metrics:

```text
fx_quotes_total{provider,instrument}
fx_quote_lag_ms{provider,instrument}
fx_spread{provider,instrument}
fx_provider_connected{provider}
fx_provider_reconnects_total{provider}
fx_stale_feed{provider,instrument}
fx_provider_switch_total{instrument,from,to}
fx_candles_created_total{timeframe}
fx_synthetic_candles_total{instrument}
fx_bridge_parse_errors_total{provider}
```

Grafana dashboard:

```text
FX Provider Health
├── connected providers
├── quote rate/sec
├── event latency
├── stale symbols
├── reconnects
└── source switches

FX Market Quality
├── spread by pair
├── tick rate
├── provider divergence
└── synthetic/direct status
```

Prometheus storage remains under the existing 3 GB cap.

---

# 68. Secrets and Security

Do not expose broker credentials to:

```text
browser
Next.js client bundle
NATS public interface
logs
Grafana labels
```

Secrets:

```text
MT5 login → terminal secret storage / deployment secret
OANDA token → server environment secret
Dukascopy credentials → sidecar secret
```

The MT5 TCP bridge should bind to:

```text
127.0.0.1
```

when terminal and receiver are on the same host.

If bridging across LAN/VM boundaries:

```text
private VLAN only
+ firewall allowlist
+ application token/HMAC
+ optional TLS
```

Never expose the raw bridge listener to the public Internet.

---

# 69. Docker / Runtime Topology

Linux market server:

```text
market-server
│
├── collector-crypto (Rust)
├── fx-bridge-receiver (Rust)
├── aggregator (Rust)
├── gateway (Rust)
├── backfill (Rust)
├── nats
├── valkey
├── questdb
├── prometheus
├── grafana
└── web
```

MT5 may run:

```text
Option A
Windows machine/VM
→ TCP bridge to market-server private IP

Option B
same Windows host as receiver

Option C
Wine environment
→ only after stability testing
```

Do not make Wine a mandatory core dependency.

JForex can run as a Java sidecar directly on Linux if selected as the FX source.

---

# 70. Configuration

Example:

```yaml
fx:
  enabled: true

  hot_symbols:
    - EUR-USD
    - GBP-USD
    - USD-JPY
    - EUR-JPY
    - GBP-JPY
    - AUD-USD
    - USD-CAD
    - USD-CHF

  candle_price_basis: mid

  retention:
    candle_1s_days: 14
    candle_1m_days: 365
    candle_1h_days: 0   # 0 = permanent
    candle_1d_days: 0

  stale:
    warning_seconds: 5
    hard_seconds: 15

  providers:
    mt5:
      enabled: true
      priority: 10
      listen: "127.0.0.1:9101"

    dukascopy:
      enabled: false
      priority: 20

    oanda:
      enabled: false
      priority: 30

  synthetic_crosses:
    enabled: true
    max_leg_age_ms: 2000
```

Provider credentials are not stored in this YAML file when committed to git.

---

# 71. Implementation Phases — Forex

## Phase FX-0 — domain changes

- [ ] Add `QuoteTick`.
- [ ] Add `MarketDataKind::Quote`.
- [ ] Add `CandlePriceBasis`.
- [ ] Add `VolumeKind`.
- [ ] Add FX instrument metadata.
- [ ] Add provider provenance to candle rows.
- [ ] Add session-state model.
- [ ] Unit tests for spread / pips / midpoint.

Acceptance:

```text
crypto TradeTick path remains unchanged
FX QuoteTick compiles through shared domain
```

## Phase FX-1 — MT5 local bridge

- [ ] Implement `MarketBridge.mq5`.
- [ ] Persistent TCP connection.
- [ ] Reconnect to local Rust receiver.
- [ ] Send bid/ask + broker timestamp.
- [ ] Implement receiver framing.
- [ ] Map broker symbols to canonical instruments.
- [ ] Reject malformed/crossed quotes.
- [ ] Publish normalized quote events.
- [ ] Add bridge health metrics.

Acceptance:

```text
EUR/USD changes in MT5
→ normalized QuoteTick visible in Rust within sub-second latency
```

## Phase FX-2 — candle integration

- [ ] Feed QuoteTick into aggregator.
- [ ] Build 1s MID OHLC.
- [ ] Track spread OHLC.
- [ ] Persist tick_count.
- [ ] Persist provider ID.
- [ ] Add 1m rollup.
- [ ] Add 1h / 1d rollup.
- [ ] Implement synthetic flag for gap-filled continuity candles.

Acceptance:

```text
live 1s EUR/USD candle matches incoming quote sequence
```

## Phase FX-3 — QuestDB and retention

- [ ] Create FX 1s table.
- [ ] Create FX 1m table.
- [ ] Create FX 1h table.
- [ ] Create FX 1d table.
- [ ] Add 14-day 1s cleanup job.
- [ ] Integrate global disk-pressure guard.
- [ ] Validate QuestDB stays under global 60 GB target.

## Phase FX-4 — gateway

- [ ] `/fx/instruments`.
- [ ] `/fx/ticker/:instrument`.
- [ ] `/fx/candles/:instrument`.
- [ ] WebSocket FX quote subscriptions.
- [ ] WebSocket FX candle subscriptions.
- [ ] session/provider metadata.
- [ ] stale status.

## Phase FX-5 — frontend

- [ ] Add FOREX category.
- [ ] Bid/ask/mid header.
- [ ] Spread in pips.
- [ ] Provider/source badge.
- [ ] Market session state.
- [ ] 1s timeframe.
- [ ] Tick activity instead of fake volume.
- [ ] Handle source switching without chart reset.

## Phase FX-6 — provider redundancy

- [ ] Dukascopy adapter.
- [ ] Provider health scoring.
- [ ] Controlled failover.
- [ ] Provider divergence checks.
- [ ] Provider switch events.

## Phase FX-7 — optional OANDA

- [ ] account-backed connector.
- [ ] pricing stream parser.
- [ ] heartbeat handling.
- [ ] 4-updates/sec semantics documented in metadata.
- [ ] use as fallback, not raw-tick truth source.

## Phase FX-8 — historical repair

- [ ] historical bar backfill.
- [ ] optional historical tick replay when provider permits.
- [ ] startup gap detector.
- [ ] deterministic candle replay tests.

## Phase FX-9 — synthetic crosses

- [ ] cross-rate graph.
- [ ] bid/ask correct arithmetic.
- [ ] freshness validation.
- [ ] direct pair precedence.
- [ ] synthetic labeling.

## Phase FX-10 — soak test

Run for at least one full weekday session window.

Verify:

- [ ] no unbounded queues;
- [ ] reconnects recover automatically;
- [ ] candle boundaries remain UTC-correct;
- [ ] weekend close does not fabricate data;
- [ ] provider reconnect does not duplicate candles;
- [ ] browser resumes after gateway restart;
- [ ] disk retention works;
- [ ] sub-second ticker stays responsive;
- [ ] 1s candles remain consistent;
- [ ] provider source is always visible.

---

# 72. Forex Testing Matrix

Unit tests:

```text
mid calculation
spread calculation
pip conversion
quote validation
canonical symbol mapping
1s bucket boundaries
late quote handling
synthetic candle marking
cross-rate bid/ask math
session state transitions
```

Integration tests:

```text
fake FX provider
→ QuoteTick
→ NATS
→ aggregator
→ QuestDB
→ gateway
→ WebSocket client
```

Fault injection:

```text
kill MT5 bridge connection
freeze quote stream
send malformed quote
send timestamp backward
send crossed market ask < bid
restart NATS
restart aggregator
restart gateway
fill disk to warning threshold
```

Expected behavior:

```text
no process crash
no corrupted candle
no silent provider switch
no fake quote persistence
```

---

# 73. Initial Pair Set

Start with majors and high-liquidity crosses.

```text
EUR-USD
GBP-USD
USD-JPY
USD-CHF
USD-CAD
AUD-USD
NZD-USD
EUR-JPY
EUR-GBP
GBP-JPY
AUD-JPY
EUR-CHF
```

Keep 1-second persistence limited to the pairs actually watched frequently.

A reasonable 128 GB default:

```text
12 FX pairs @ 1s / 14d
20–30 crypto hot symbols @ 1s / 21d
broader market universe @ 1m
```

This remains compatible with the existing global QuestDB storage target.

---

# 74. Source Quality Rules

Every live FX value must carry:

```text
provider
provider timestamp
ingest timestamp
quote type
session state
stale state
synthetic/direct state
```

The frontend must never represent:

```text
MT5 broker quote
Dukascopy quote
OANDA quote
ECB reference rate
```

as though they were identical datasets.

This is a core correctness requirement.

---

# 75. FX Architecture Decision

Final recommended personal-serious topology:

```text
                            FX PROVIDERS

          Broker / MT5        Dukascopy        OANDA(optional)
               │                  │                   │
               ▼                  ▼                   ▼
          MQL5 Bridge        JForex Sidecar       Rust Adapter
               │                  │                   │
               └──────────────┬───┴───────────────────┘
                              ▼
                       Normalized QuoteTick
                              │
                              ▼
                       NATS / JetStream
                              │
                  ┌───────────┴───────────┐
                  ▼                       ▼
            Rust Aggregator          Rust Gateway
                  │                       │
             1s MID OHLC             realtime WS
             spread OHLC                  │
                  │                       ▼
             QuestDB                 Next.js Chart
```

Primary implementation recommendation:

> **Use a broker-native MetaTrader 5 feed through a self-hosted local bridge for the first true realtime FX source; keep Dukascopy as the next provider adapter; keep OANDA optional because its streaming endpoint is intentionally sampled rather than a complete raw price stream.**

This preserves the main project rule: the application does not depend on metered market-data SaaS/free-tier credits, while still acknowledging that FX prices originate from a broker or venue rather than from a universal public exchange.

---

# 76. Official Documentation References for FX Integration

- MetaTrader 5 Python integration / symbol tick access: https://www.mql5.com/en/docs/python_metatrader5/mt5symbolinfotick_py
- MQL5 `OnTick`: https://www.mql5.com/en/docs/event_handlers/ontick
- MQL5 socket networking: https://www.mql5.com/en/docs/network
- MQL5 `SocketCreate`: https://www.mql5.com/en/docs/network/socketcreate
- MQL5 `SocketConnect`: https://www.mql5.com/en/docs/network/socketconnect
- MQL5 `SocketSend`: https://www.mql5.com/en/docs/network/socketsend
- Dukascopy JForex API: https://www.dukascopy.com/swiss/english/forex/api/jforex-api/
- Dukascopy JForex tick history: https://www.dukascopy.com/wiki/en/development/strategy-api/historical-data/history-ticks/
- OANDA v20 pricing stream: https://developer.oanda.com/rest-live-v20/pricing-ep/
- OANDA v20 development guide / connection limits: https://developer.oanda.com/rest-live-v20/development-guide/
- ECB reference rates: https://www.ecb.europa.eu/stats/exchange_rates/html/index.en.html
