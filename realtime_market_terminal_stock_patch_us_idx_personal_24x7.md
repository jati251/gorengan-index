# PATCH — US & Indonesia Equities Module
## For: `Realtime Market Terminal — Serious Self-Hosted Architecture (Crypto + Forex), 128 GB Profile`

> **Patch type:** additive architecture patch.  
> **Do not replace the existing Crypto + Forex implementation.** Apply this document on top of the current architecture.
>
> **Primary goal:** add personal-use US equities and Indonesia/IDX equities to the existing Rust/NATS/QuestDB/Valkey market terminal while preserving the 128 GB storage budget.
>
> **Operating model:** the server and market engine run **24/7**, but stock prices are only treated as live when the corresponding market/provider is active. Outside trading sessions the API must serve the last-known market state and explicitly report the market as `CLOSED`, `PRE_MARKET`, `AFTER_HOURS`, `BREAK`, or `HOLIDAY`. Never synthesize fake price movement during closed periods.

---

# 1. Scope

This patch adds:

- US stocks and ETFs.
- Indonesian/IDX stocks.
- US and Indonesian market-session awareness.
- Delayed/realtime provider capability metadata.
- Stock-specific trade/quote normalization.
- 1-minute persisted stock candles.
- Optional live UI refresh faster than 1 minute when the provider supports it.
- Corporate-action support.
- Exchange holiday/calendar support.
- Session-aware reconnect/backfill.
- Personal-use datasource policy.
- 24/7 service operation with closed-market handling.
- Storage constraints suitable for the existing 128 GB deployment.

This patch **does not** require:

- 1-second historical candles for stocks.
- permanent raw trade storage.
- permanent raw quote storage.
- full exchange order books.
- Level 2 data.
- a commercial consolidated SIP feed.
- official IDX real-time ITCH data.
- stock execution/trading functionality.

---

# 2. Source Policy

The stock subsystem must distinguish between:

```text
SOFTWARE AVAILABILITY
vs
MARKET DATA RIGHTS
```

The market engine remains fully self-hosted.

Upstream stock data may still come from providers because centralized stock exchanges control real-time market-data rights.

The implementation MUST expose the source and quality of every stock quote.

Canonical quality levels:

```rust
pub enum MarketDataQuality {
    RealtimeVenue,       // realtime but venue-specific, e.g. IEX
    RealtimeConsolidated,
    NearRealtime,
    Delayed,
    EndOfDay,
    LastKnown,
}
```

Each quote must include:

```rust
pub struct DataProvenance {
    pub provider: ProviderId,
    pub venue: Option<VenueId>,
    pub quality: MarketDataQuality,
    pub delay_seconds: Option<u32>,
    pub is_consolidated: bool,
}
```

The frontend must never label venue-specific or delayed data as consolidated real-time data.

---

# 3. Recommended Personal-Use Providers

## 3.1 US equities — primary

Use:

```text
Alpaca Basic
└── IEX real-time WebSocket feed
```

Purpose:

- live US stock/ETF ticker for a personal watchlist;
- trade events;
- quote events where available;
- bar updates;
- realtime chart feel.

Important constraints to encode in configuration:

```yaml
us_equities:
  primary_provider: alpaca_iex
  quality: realtime_venue
  consolidated: false

  max_live_symbols: 30

  persist_timeframes:
    - 1m
    - 1h
    - 1d

  persist_raw_ticks: false
```

The implementation MUST assume that the free IEX feed is **venue-specific**, not a complete consolidated view of all US exchanges.

Do not compare IEX-only volume directly with full-market SIP volume without explicitly marking the difference.

### Optional US source

Support an optional provider capability for:

```text
15-minute delayed SIP
```

Use this only when available to the configured account/provider.

This is useful for:

- wider market representation;
- delayed comparison;
- backfill fallback;
- symbols not selected in the live IEX watchlist.

Never merge delayed SIP ticks into the same live IEX stream without provenance.

---

## 3.2 Indonesian equities — primary personal-use adapter

Initial adapter:

```text
Yahoo Finance-style IDX delayed data
symbols:
BBCA.JK
BBRI.JK
BMRI.JK
TLKM.JK
...
```

This source is treated as:

```text
BEST-EFFORT
DELAYED
UNOFFICIAL PROGRAMMATIC INTEGRATION
PERSONAL USE ONLY
```

Therefore the provider abstraction MUST make replacement easy.

The IDX provider must live behind:

```rust
trait EquityProvider
```

so later it can be replaced by:

```text
broker feed
licensed IDX feed
official vendor
other personal datasource
```

without touching:

- candle engine;
- QuestDB schema;
- gateway;
- WebSocket protocol;
- frontend chart components.

Default config:

```yaml
idx_equities:
  primary_provider: yahoo_delayed

  quote_poll_seconds_open: 30
  quote_poll_seconds_break: 300
  quote_poll_seconds_closed: 900

  persist_timeframes:
    - 1m
    - 1h
    - 1d

  persist_raw_ticks: false
```

If the source does not provide sufficiently granular 1-minute data for a period, the system MUST NOT fabricate candles.

Return a gap instead.

---

# 4. Final Stock Architecture

Apply this beside the existing Crypto + Forex providers:

```text
                                MARKET TERMINAL

     CRYPTO                   FOREX                     EQUITIES
        │                       │                          │
        │                       │               ┌──────────┴──────────┐
        │                       │               │                     │
 Binance / OKX /         MT5 / Dukascopy     US Stocks             IDX Stocks
 Kraken / etc.                                  │                     │
                                                │                     │
                                          Alpaca IEX           IDX delayed adapter
                                                │                     │
                                                └──────────┬──────────┘
                                                           │
                                                           ▼
                                                 Rust Equity Providers
                                                           │
                                                           ▼
                                                  Equity Normalizer
                                                           │
                                     ┌─────────────────────┴──────────────────────┐
                                     │                                            │
                                     ▼                                            ▼
                              EquityTradeTick                              EquityQuoteTick
                                     │                                            │
                                     └──────────────────────┬─────────────────────┘
                                                            │
                                                            ▼
                                                       NATS Subjects
                                                            │
                                  ┌─────────────────────────┼─────────────────────────┐
                                  │                         │                         │
                                  ▼                         ▼                         ▼
                              Aggregator                Gateway                  Metrics
                                  │                         │
                                  ▼                         │
                         1m / 1h / 1d                       │
                                  │                         │
                           ┌──────┴──────┐                  │
                           ▼             ▼                  │
                        Valkey        QuestDB                │
                           │             │                  │
                           └─────────────┴──────────┬───────┘
                                                  ▼
                                               Next.js
```

---

# 5. Rust Workspace Patch

Extend:

```text
apps/collector/src/providers/
```

with:

```text
providers/
├── equities/
│   ├── mod.rs
│   ├── provider.rs
│   │
│   ├── us/
│   │   ├── mod.rs
│   │   ├── alpaca/
│   │   │   ├── client.rs
│   │   │   ├── websocket.rs
│   │   │   ├── auth.rs
│   │   │   ├── mapper.rs
│   │   │   ├── reconnect.rs
│   │   │   └── symbols.rs
│   │   └── calendar.rs
│   │
│   └── id/
│       ├── mod.rs
│       ├── delayed/
│       │   ├── client.rs
│       │   ├── mapper.rs
│       │   ├── polling.rs
│       │   └── symbols.rs
│       └── calendar.rs
```

Extend domain crates:

```text
crates/market-domain/src/
├── equity.rs
├── corporate_action.rs
├── session.rs
├── provenance.rs
└── instrument.rs
```

Add stock-specific scheduled jobs:

```text
apps/equity-maintenance/
├── calendar_sync
├── corporate_action_sync
├── symbol_refresh
└── gap_repair
```

These may initially be subcommands of the existing backfill binary instead of separate containers.

---

# 6. Provider Interface

Do not reuse the crypto provider interface directly.

Create a stock-aware abstraction:

```rust
#[async_trait]
pub trait EquityProvider: Send + Sync {
    fn provider_id(&self) -> ProviderId;

    fn capabilities(&self) -> EquityProviderCapabilities;

    async fn discover_instruments(
        &self,
    ) -> Result<Vec<EquityInstrument>, ProviderError>;

    async fn subscribe(
        &self,
        instruments: &[InstrumentId],
        tx: MarketEventSender,
    ) -> Result<(), ProviderError>;

    async fn fetch_bars(
        &self,
        request: BarRequest,
    ) -> Result<Vec<Candle>, ProviderError>;

    async fn fetch_snapshot(
        &self,
        instrument: &InstrumentId,
    ) -> Result<Option<EquitySnapshot>, ProviderError>;

    async fn healthcheck(
        &self,
    ) -> ProviderHealth;
}
```

Capabilities:

```rust
pub struct EquityProviderCapabilities {
    pub realtime_trades: bool,
    pub realtime_quotes: bool,
    pub delayed_quotes: bool,

    pub bars_1m: bool,
    pub bars_1d: bool,

    pub pre_market: bool,
    pub after_hours: bool,
    pub overnight: bool,

    pub max_stream_symbols: Option<usize>,

    pub quality: MarketDataQuality,
}
```

The engine must make decisions from `capabilities()` instead of hardcoding assumptions for every provider.

---

# 7. Canonical Equity Instrument

Add:

```rust
pub struct EquityInstrument {
    pub id: InstrumentId,

    pub symbol: String,
    pub display_symbol: String,

    pub asset_class: AssetClass,

    pub exchange: ExchangeId,
    pub country: CountryCode,
    pub currency: CurrencyCode,

    pub timezone: String,

    pub isin: Option<String>,
    pub figi: Option<String>,

    pub tick_size: Decimal,

    pub active: bool,
}
```

Asset class:

```rust
pub enum AssetClass {
    Crypto,
    Forex,
    Equity,
    Etf,
    Index,
    Metal,
}
```

Examples:

```text
US:AAPL
US:NVDA
US:SPY

ID:BBCA
ID:BBRI
ID:TLKM
```

Do NOT expose provider-specific names such as:

```text
BBCA.JK
```

as the canonical internal identifier.

Map them:

```text
canonical:
ID:BBCA

provider symbol:
yahoo → BBCA.JK
```

---

# 8. Canonical Stock Events

## 8.1 Trade tick

```rust
pub struct EquityTradeTick {
    pub instrument_id: InstrumentId,

    pub provider: ProviderId,
    pub venue: Option<VenueId>,

    pub price: Decimal,
    pub quantity: Decimal,

    pub exchange_timestamp_ns: i64,
    pub received_timestamp_ns: i64,

    pub conditions: Vec<String>,

    pub provenance: DataProvenance,
}
```

---

## 8.2 Quote tick

```rust
pub struct EquityQuoteTick {
    pub instrument_id: InstrumentId,

    pub provider: ProviderId,
    pub venue: Option<VenueId>,

    pub bid: Option<Decimal>,
    pub bid_size: Option<Decimal>,

    pub ask: Option<Decimal>,
    pub ask_size: Option<Decimal>,

    pub last: Option<Decimal>,

    pub timestamp_ns: i64,

    pub provenance: DataProvenance,
}
```

---

## 8.3 Snapshot

```rust
pub struct EquitySnapshot {
    pub instrument_id: InstrumentId,

    pub last: Option<Decimal>,

    pub open: Option<Decimal>,
    pub high: Option<Decimal>,
    pub low: Option<Decimal>,
    pub previous_close: Option<Decimal>,

    pub volume: Option<Decimal>,

    pub bid: Option<Decimal>,
    pub ask: Option<Decimal>,

    pub change: Option<Decimal>,
    pub change_pct: Option<Decimal>,

    pub market_state: MarketSessionState,

    pub timestamp_ns: i64,

    pub provenance: DataProvenance,
}
```

---

# 9. Session State Machine

The equity module must run continuously even when markets are closed.

Canonical states:

```rust
pub enum MarketSessionState {
    PreMarket,
    Regular,
    Break,
    AfterHours,
    Overnight,
    Closed,
    Holiday,
    Halted,
    Unknown,
}
```

Every instrument snapshot returned to clients must include this state.

---

# 10. US Market Sessions

Use:

```text
timezone:
America/New_York
```

Regular session:

```text
09:30 ET
→
16:00 ET
```

Do not hardcode UTC offsets because DST changes.

Use an IANA timezone implementation.

State flow:

```text
CLOSED
  ↓
PRE_MARKET
  ↓
REGULAR
  ↓
AFTER_HOURS
  ↓
CLOSED
```

The exact availability of pre/after/overnight updates is determined by provider capabilities.

If the active provider only supplies a certain session:

```text
market calendar says PRE_MARKET
provider does not support PRE_MARKET
```

then report:

```text
session = PRE_MARKET
feed_state = INACTIVE_FOR_SESSION
```

Do not report provider failure.

---

# 11. IDX Market Sessions

Use:

```text
timezone:
Asia/Jakarta
```

IDX has session-based trading and a midday break.

Do not scatter session constants across the codebase.

Represent the schedule through configuration/calendar records:

```rust
pub struct SessionWindow {
    pub state: MarketSessionState,
    pub open: NaiveTime,
    pub close: NaiveTime,
}
```

Example state flow:

```text
CLOSED
  ↓
SESSION_1 / REGULAR
  ↓
BREAK
  ↓
SESSION_2 / REGULAR
  ↓
CLOSED
```

Public API may normalize both trading sessions to:

```text
REGULAR
```

while separately returning:

```json
{
  "session_segment": "SESSION_1"
}
```

or:

```json
{
  "session_segment": "SESSION_2"
}
```

The break MUST NOT be considered a provider outage.

---

# 12. 24/7 Supervisor

Add a dedicated supervisor task:

```rust
EquityMarketSupervisor
```

Responsibilities:

```text
market calendar
      ↓
desired provider state
      ↓
connect / subscribe / idle
      ↓
health checking
      ↓
session transition
      ↓
backfill
```

Pseudo lifecycle:

```text
SERVER BOOT
    │
    ▼
load calendars
load instruments
load last persisted candles
load latest snapshot cache
    │
    ▼
calculate current market state
    │
    ├── OPEN
    │     └── start/verify provider feed
    │
    └── CLOSED
          └── stay alive, serve cached data
```

The process NEVER exits simply because the stock market closes.

---

# 13. Session Transition Behaviour

## Before market open

Example:

```text
T - 10 minutes
```

Perform:

```text
provider authentication
symbol validation
connection warm-up
historical gap check
subscribe/watchlist preparation
```

Do not wait until the exact opening second to initialize everything.

---

## At open

```text
state → REGULAR
```

Actions:

```text
enable live ingestion
mark stale cached quote
receive first valid event
replace last-known quote
start current 1m candle
broadcast market state
```

---

## During session

Perform:

```text
health check
feed freshness check
candle aggregation
ticker calculation
1m persistence
WS broadcast
```

---

## At session break (IDX)

```text
state → BREAK
```

Actions:

```text
finalize active candle if appropriate
keep provider process alive when cheap
reduce polling frequency
do not generate synthetic flat candles
mark quote as last-known
```

---

## At close

```text
state → CLOSED
```

Actions:

```text
finalize final 1m candle
flush QuestDB writer
persist closing snapshot
run gap check
update daily candle
reduce/stop quote polling
broadcast CLOSED
```

---

## Overnight

Keep:

```text
API
QuestDB
Valkey
Gateway
Next.js
Prometheus
Grafana
```

online.

Provider connection policy may become:

```text
US:
keep WebSocket if provider supports useful extended/overnight data
otherwise reconnect before next session

IDX:
disconnect or very low frequency health check
```

---

# 14. No Fake Candles

Do NOT generate:

```text
09:31
09:32
09:33
...
```

when no underlying stock event exists simply to keep the chart moving.

During:

```text
weekend
holiday
IDX lunch break
market halt
closed session
provider outage
```

gaps are legitimate.

The frontend chart must understand gaps.

---

# 15. Stock Candle Policy

Stocks do not need the crypto/FX 1-second persistence policy.

Use:

```text
LIVE EVENT
    ↓
current quote / current 1m candle
    ↓
1m finalized candle
    ↓
QuestDB
```

Persist:

```text
1m
1h
1d
```

Derived on demand:

```text
5m
15m
30m
2h
4h
1w
1M
```

Recommended:

```yaml
equity_retention:
  candle_1m_days: 365
  candle_1h_days: 0      # 0 = permanent
  candle_1d_days: 0      # 0 = permanent

  raw_trade_seconds: 0
  raw_quote_seconds: 0
```

Raw stock events are processed in memory and discarded after aggregation/broadcast.

---

# 16. Candle Construction Rules

## US real-time/IEX

When trade events are available:

```text
OHLC:
trade price

volume:
sum of received trade quantities

trade_count:
count trade events
```

Remember:

```text
IEX-only volume != total US consolidated volume
```

Therefore store:

```rust
pub enum VolumeScope {
    VenueOnly,
    Consolidated,
    ProviderReported,
    Unknown,
}
```

---

## IDX delayed provider

If the upstream source provides authoritative 1-minute bars:

```text
persist provider bar
```

after normalization.

If only snapshots are available:

```text
snapshot polling
    ↓
update current best-effort 1m candle
```

but set:

```text
candle_quality = SnapshotDerived
```

Do not claim trade-level OHLCV fidelity.

Recommended:

```rust
pub enum CandleQuality {
    TradeDerived,
    ProviderBar,
    QuoteDerived,
    SnapshotDerived,
}
```

---

# 17. NATS Subjects

Extend existing subjects.

```text
equity.trade.us.<symbol>
equity.quote.us.<symbol>
equity.snapshot.us.<symbol>

equity.trade.id.<symbol>
equity.quote.id.<symbol>
equity.snapshot.id.<symbol>

equity.session.us
equity.session.id

equity.candle.1m.us.<symbol>
equity.candle.1m.id.<symbol>

equity.provider.status.<provider>
```

Examples:

```text
equity.trade.us.AAPL
equity.quote.us.NVDA

equity.snapshot.id.BBCA
equity.snapshot.id.BBRI

equity.session.us
equity.session.id
```

Stock raw-event JetStream retention should remain tiny.

Recommended:

```yaml
jetstream:
  equity_raw:
    retention_minutes: 5
    max_bytes: 512MB
```

The entire stock subsystem does NOT need multi-hour raw replay.

---

# 18. Valkey Keys

Add:

```text
equity:snapshot:US:AAPL
equity:snapshot:US:NVDA

equity:snapshot:ID:BBCA
equity:snapshot:ID:BBRI

equity:session:US
equity:session:ID

equity:provider:alpaca_iex:health
equity:provider:idx_delayed:health
```

TTL policy:

```text
latest snapshots:
no short TTL deletion;
store timestamp and stale state instead.

provider health:
30–60 seconds TTL.
```

Do not delete the last quote when the market closes.

A user opening the terminal at 03:00 WIB should still see:

```text
AAPL
last: ...
market: CLOSED
last_update: ...
```

---

# 19. QuestDB Schema

Add a separate table from crypto/FX candles.

```sql
CREATE TABLE equity_candles (
    ts TIMESTAMP,
    instrument SYMBOL,
    market SYMBOL,
    provider SYMBOL,
    venue SYMBOL,
    timeframe SYMBOL,

    open DOUBLE,
    high DOUBLE,
    low DOUBLE,
    close DOUBLE,

    volume DOUBLE,
    trade_count LONG,

    volume_scope SYMBOL,
    candle_quality SYMBOL,
    session SYMBOL
)
TIMESTAMP(ts)
PARTITION BY DAY
WAL;
```

Recommended partitioning:

```text
1m → DAY
1h → MONTH or DAY
1d → YEAR or MONTH
```

depending on final QuestDB benchmark results.

---

# 20. Daily Stock Metadata

Add:

```sql
CREATE TABLE equity_daily_stats (
    ts TIMESTAMP,
    instrument SYMBOL,
    provider SYMBOL,

    previous_close DOUBLE,
    open DOUBLE,
    high DOUBLE,
    low DOUBLE,
    close DOUBLE,

    volume DOUBLE,

    change DOUBLE,
    change_pct DOUBLE
)
TIMESTAMP(ts)
PARTITION BY YEAR
WAL;
```

---

# 21. Corporate Actions

Stocks require corporate actions even for a personal chart.

Add:

```rust
pub enum CorporateActionType {
    Split,
    ReverseSplit,
    Dividend,
    SymbolChange,
    Delisting,
}
```

Table:

```sql
CREATE TABLE corporate_actions (
    effective_ts TIMESTAMP,
    instrument SYMBOL,
    action_type SYMBOL,

    ratio_from DOUBLE,
    ratio_to DOUBLE,

    cash_amount DOUBLE,
    currency SYMBOL,

    source SYMBOL
)
TIMESTAMP(effective_ts)
PARTITION BY YEAR
WAL;
```

Minimum V1 requirement:

```text
stock split support
```

Without it, historical charts can show fake crashes/jumps.

---

# 22. Raw vs Adjusted Prices

Store **raw market candles** as canonical historical facts.

Do not permanently rewrite raw OHLC.

Expose API option:

```text
adjusted=false
adjusted=true
```

Adjustment layer:

```text
raw candle
    +
corporate actions
    ↓
adjustment service
    ↓
adjusted candle response
```

V1 may support:

```text
split adjustment only
```

Dividends may be added later.

---

# 23. Historical Backfill

## US

Use the configured provider's available historical bars.

Process:

```text
startup
  ↓
read last persisted timestamp
  ↓
market calendar
  ↓
determine missing expected bars
  ↓
request missing range
  ↓
normalize
  ↓
dedupe
  ↓
QuestDB
```

The system must tolerate the provider's free-account historical restrictions.

Never hammer the REST API.

Implement a token bucket:

```rust
struct RateLimiter {
    capacity: u32,
    refill_per_second: f64,
}
```

---

## IDX

Treat historical retrieval separately from live polling.

Priority:

```text
provider historical chart data
    ↓
daily official/public historical datasets when appropriate
    ↓
existing local DB
```

The backfill system MUST be idempotent.

---

# 24. Deduplication

Canonical key:

```text
instrument
provider
timestamp
timeframe
```

For trade events, use provider event IDs where available.

For generated bars:

```text
US:AAPL
alpaca_iex
2026-09-22T14:31:00Z
1m
```

must be idempotent.

QuestDB inserts or repair jobs must not create duplicate chart bars.

---

# 25. Feed Freshness

Add:

```rust
pub enum FeedFreshness {
    Fresh,
    Slow,
    Stale,
    ClosedMarket,
    ProviderDown,
}
```

Do not flag:

```text
no events for 3 hours
```

as stale if the market is closed.

Freshness logic must consider:

```text
market state
provider capabilities
last message
expected activity
```

Example:

```text
AAPL
market = REGULAR
last event = 45 seconds ago
→ maybe STALE

AAPL
market = CLOSED
last event = 4 hours ago
→ CLOSED_MARKET, not STALE
```

---

# 26. Provider Failure Behaviour

## US

If Alpaca IEX disconnects during an expected active session:

```text
disconnect
  ↓
mark provider DEGRADED
  ↓
keep last quote
  ↓
exponential backoff + jitter
  ↓
re-authenticate
  ↓
resubscribe symbols
  ↓
backfill missing 1m bars
  ↓
LIVE
```

Do not erase the chart or replace values with zero.

---

## IDX

Polling failure:

```text
request failed
   ↓
retain last known snapshot
   ↓
provider_state = DEGRADED
   ↓
increase backoff
   ↓
retry
```

Recommended:

```text
30s
60s
120s
300s max
```

during the session.

Do not run aggressive retry loops against unofficial sources.

---

# 27. Symbol Watchlist Strategy

Because the free US live source has a finite live-symbol allowance, treat the live list as a resource.

Config example:

```yaml
stocks:
  us:
    live_watchlist:
      - AAPL
      - MSFT
      - NVDA
      - AMD
      - TSLA
      - META
      - GOOGL
      - AMZN
      - AVGO
      - NFLX
      - PLTR
      - COIN
      - MSTR
      - SPY
      - QQQ

  id:
    watchlist:
      - BBCA
      - BBRI
      - BMRI
      - BBNI
      - TLKM
      - ASII
      - ANTM
      - ADRO
      - GOTO
      - UNVR
```

Support dynamic subscription management.

When user adds:

```text
US:ORCL
```

and the provider limit is reached:

```text
return:
LIVE_SYMBOL_LIMIT_REACHED
```

or evict the least-recently-used dynamic symbol if explicitly configured.

Do not silently stop another symbol.

---

# 28. Live Subscription Manager

Add:

```rust
pub struct EquitySubscriptionManager {
    desired: HashSet<InstrumentId>,
    active: HashSet<InstrumentId>,
    pinned: HashSet<InstrumentId>,
}
```

Priorities:

```text
1. pinned/watchlist
2. currently open chart
3. recently viewed
4. background symbols
```

For US:

```text
max live subscriptions
→ provider capability
```

For delayed IDX polling:

```text
batch requests when possible
avoid one request per symbol per second
```

---

# 29. Browser WebSocket Protocol

Keep one unified application WS.

Client:

```json
{
  "op": "subscribe",
  "channel": "ticker",
  "instrument": "US:AAPL"
}
```

or:

```json
{
  "op": "subscribe",
  "channel": "ticker",
  "instrument": "ID:BBCA"
}
```

Server:

```json
{
  "type": "ticker",
  "instrument": "US:AAPL",
  "asset_class": "equity",
  "market": "US",
  "last": 0,
  "bid": 0,
  "ask": 0,
  "market_state": "REGULAR",
  "quality": "REALTIME_VENUE",
  "provider": "ALPACA_IEX",
  "is_consolidated": false,
  "timestamp": 0
}
```

IDX:

```json
{
  "type": "ticker",
  "instrument": "ID:BBCA",
  "asset_class": "equity",
  "market": "ID",
  "last": 0,
  "market_state": "REGULAR",
  "quality": "DELAYED",
  "provider": "IDX_DELAYED",
  "delay_seconds": null,
  "timestamp": 0
}
```

Do not claim a precise delay if the upstream source does not guarantee one.

---

# 30. REST API Patch

Add:

```text
GET /v1/equities
GET /v1/equities/:instrument

GET /v1/equities/:instrument/candles
GET /v1/equities/:instrument/snapshot

GET /v1/markets/us/session
GET /v1/markets/id/session

GET /v1/providers/equities/status
```

Example:

```text
GET /v1/equities/US:AAPL/candles
    ?interval=1m
    &from=...
    &to=...
    &adjusted=true
```

---

# 31. Frontend Patch

Add categories:

```text
Markets
├── Crypto
├── Forex
├── US Stocks
└── Indonesia
```

Ticker card must show a data-quality badge.

Examples:

```text
AAPL
$...
LIVE · IEX
```

```text
BBCA
Rp ...
DELAYED
```

Closed:

```text
AAPL
$...
CLOSED
Last updated ...
```

Do not animate a fake ticker while closed.

---

# 32. Chart Behaviour

Chart toolbar:

```text
1D
5D
1M
3M
6M
1Y
5Y
MAX
```

Timeframes:

```text
1m
5m
15m
30m
1h
4h
1d
1w
1M
```

No stock `1s` historical interval in V1.

When a user opens a live stock chart:

```text
historical 1m
       ↓
render
       ↓
current live quote/trade
       ↓
update active 1m candle in browser
       ↓
server finalizes candle
       ↓
replace/finalize bar
```

This provides a realtime feel without persisting 1-second stock bars.

---

# 33. Closed-Market UX

When market is closed:

```text
US:AAPL
Market closed

Last
$...

Previous close
$...

Next session
...
```

When IDX is on midday break:

```text
ID:BBCA
Market break

Last
Rp ...

Session resumes
...
```

The API should provide:

```json
{
  "state": "CLOSED",
  "next_transition_at": "...",
  "last_market_event_at": "..."
}
```

---

# 34. Holidays

Do not assume:

```text
Monday-Friday = always open
```

Each market needs a holiday calendar.

Implement:

```rust
trait MarketCalendar {
    fn state_at(
        &self,
        timestamp: DateTime<Utc>,
    ) -> MarketSessionState;

    fn next_transition(
        &self,
        timestamp: DateTime<Utc>,
    ) -> Option<DateTime<Utc>>;
}
```

Store overrides:

```text
market
date
is_closed
early_close
special_sessions
source
```

QuestDB is not required for the calendar.

A lightweight configuration/SQLite file or application metadata table is enough.

---

# 35. Clock and DST

US equities:

```text
America/New_York
```

IDX:

```text
Asia/Jakarta
```

Internally store timestamps as:

```text
UTC
```

Convert only at boundaries.

Never configure US stock sessions as fixed Jakarta times.

DST means their Jakarta-time schedule moves during the year.

---

# 36. Storage Budget — 128 GB Patch

Stocks should remain a small addition.

Recommended total stock budget:

```text
equity candles:
10–20 GB target

corporate actions:
<100 MB

symbol metadata:
<100 MB

NATS stock replay:
<=512 MB

stock logs:
included in global log cap
```

Keep the existing overall target:

```text
QuestDB total:
~55–65 GB preferred ceiling

NATS total:
<=2 GB

Prometheus:
<=3 GB

logs:
<=2 GB

minimum free:
20 GB
```

---

# 37. Approximate Stock Storage

For 1-minute bars:

```text
US trading day:
~390 regular-session minutes

IDX:
fewer active trading minutes due to session structure/break
```

Even hundreds of stocks are manageable when only finalized 1m candles are persisted.

Do NOT persist:

```text
every poll
every quote
every IEX trade
```

permanently.

---

# 38. Disk Pressure Policy

Extend the existing disk guard.

At:

```text
70%
→ warning

75%
→ prune optional backfill caches

80%
→ shorten 1m stock retention for non-watchlist instruments

85%
→ stop nonessential stock historical ingestion
   but keep current watchlist live

90%
→ emergency read-mostly mode
```

Never delete:

```text
latest snapshot
1h canonical history
1d canonical history
corporate action metadata
```

before expendable high-resolution history.

---

# 39. Configuration

Example:

```yaml
equities:
  enabled: true

  us:
    enabled: true
    timezone: America/New_York

    provider:
      type: alpaca_iex

    max_live_symbols: 30

    live_watchlist:
      - AAPL
      - MSFT
      - NVDA
      - TSLA
      - META
      - AMZN
      - GOOGL
      - AMD
      - SPY
      - QQQ

    persistence:
      candle_1m_days: 365
      candle_1h_days: 0
      candle_1d_days: 0
      raw_ticks: false

  id:
    enabled: true
    timezone: Asia/Jakarta

    provider:
      type: idx_delayed_personal

    polling:
      open_seconds: 30
      break_seconds: 300
      closed_seconds: 900

    watchlist:
      - BBCA
      - BBRI
      - BMRI
      - BBNI
      - TLKM
      - ASII
      - ANTM
      - GOTO

    persistence:
      candle_1m_days: 365
      candle_1h_days: 0
      candle_1d_days: 0
      raw_ticks: false
```

---

# 40. Secrets

Do not store provider secrets in git.

Example:

```text
ALPACA_API_KEY
ALPACA_API_SECRET
```

Use:

```text
.env
Docker secret
system environment
```

Restrict file permissions.

The frontend must never receive provider credentials.

Only the Rust collector talks to the upstream provider.

---

# 41. Prometheus Metrics

Add:

```text
equity_provider_connected{provider=""}

equity_events_total{
    market="",
    provider="",
    type=""
}

equity_event_lag_ms{
    market="",
    provider=""
}

equity_feed_freshness_seconds{
    market="",
    provider=""
}

equity_market_state{
    market="",
    state=""
}

equity_live_symbols{
    provider=""
}

equity_poll_requests_total{
    provider="",
    status=""
}

equity_candles_written_total{
    market="",
    timeframe=""
}

equity_gap_repairs_total{
    market=""
}

equity_provider_reconnects_total{
    provider=""
}
```

---

# 42. Grafana

Add dashboard:

```text
Equity Market Overview
```

Panels:

```text
US market state
IDX market state

Alpaca connection
IDX delayed provider health

active symbols
events/sec
event lag
poll latency

latest candle persistence time
gap repairs

QuestDB equity rows/day
stock storage usage
```

---

# 43. Alerting

Useful personal alerts:

```text
US market active but Alpaca disconnected > 60s

IDX session active but no successful refresh > 5m

event timestamp lag > threshold

QuestDB writer failing

disk > 75%

calendar missing upcoming trading day

symbol subscription rejected

US live symbol limit reached
```

Do not alert on:

```text
normal weekend closure
normal IDX break
scheduled holiday
```

---

# 44. Docker Compose Patch

No new database required.

Add only the stock provider functionality to the existing collector.

Preferred:

```text
collector
├── crypto providers
├── forex providers
└── equity providers
```

Do not create:

```text
stock-db
stock-redis
stock-nats
```

Reuse:

```text
QuestDB
Valkey
NATS
Prometheus
Grafana
```

If isolation becomes useful later, split:

```text
collector-equity
```

into its own Rust binary/container without changing protocols.

---

# 45. 24/7 Restart Policy

Docker:

```yaml
restart: unless-stopped
```

All stateful infrastructure:

```text
QuestDB
Valkey
NATS
```

must use persistent volumes.

Collectors should be stateless enough to restart safely.

On restart:

```text
read calendar
read last stored candle
read watchlist
connect provider if needed
repair recent gap
resume
```

---

# 46. Boot Sequence

```text
1. start NATS
2. start QuestDB
3. start Valkey

4. start market services

5. load instrument metadata
6. load market calendars
7. determine US/IDX state

8. warm snapshots from Valkey/QuestDB

9. if active:
      connect upstream
   else:
      schedule next wake-up

10. expose REST + WS

11. start health checks
12. start retention guard
```

Gateway availability should not depend on the exchanges being open.

---

# 47. Market Closed Restart Example

Server restarts Sunday.

Expected:

```text
US stock provider:
not treated as failing

IDX stock provider:
not treated as failing

Gateway:
ONLINE

Historical API:
ONLINE

Latest ticker:
AVAILABLE as last-known

market state:
CLOSED

next transition:
calculated from calendar
```

This is the required definition of **24/7 stock handling**.

---

# 48. Market Open Restart Example

Server restarts during NYSE regular session.

Expected:

```text
boot
↓
calendar says REGULAR
↓
connect Alpaca
↓
authenticate
↓
subscribe watchlist
↓
fetch/check missing bars
↓
receive event
↓
mark feed LIVE
↓
continue chart
```

Target recovery should be measured, not assumed.

---

# 49. API Data Contract

Every equity payload should expose:

```text
instrument
market
currency

last
bid
ask

market_state

data_quality
provider
venue
is_consolidated

source_timestamp
server_timestamp

stale
```

This is critical because the US and IDX sources do not have identical quality.

---

# 50. Source Labels

Frontend mapping:

```text
REALTIME_VENUE
→ LIVE · IEX

REALTIME_CONSOLIDATED
→ LIVE

NEAR_REALTIME
→ NEAR REALTIME

DELAYED
→ DELAYED

END_OF_DAY
→ EOD

LAST_KNOWN
→ CLOSED
```

Do not hide the provenance behind a generic green dot.

---

# 51. Phase STK-0 — Domain Preparation

- [ ] Add `Equity` and `ETF` asset classes.
- [ ] Add `EquityInstrument`.
- [ ] Add `EquityTradeTick`.
- [ ] Add `EquityQuoteTick`.
- [ ] Add `EquitySnapshot`.
- [ ] Add `DataProvenance`.
- [ ] Add `MarketDataQuality`.
- [ ] Add `CandleQuality`.
- [ ] Add `VolumeScope`.
- [ ] Add `MarketSessionState`.
- [ ] Add serialization tests.
- [ ] Ensure existing crypto/FX schemas remain backward compatible.

**Exit criteria:** stock domain objects compile and can be serialized without provider-specific fields leaking into core domain types.

---

# 52. Phase STK-1 — Market Calendar Engine

- [ ] Add `MarketCalendar` trait.
- [ ] Add US calendar implementation.
- [ ] Add IDX calendar implementation.
- [ ] Use IANA timezones.
- [ ] Handle DST for US.
- [ ] Add holiday overrides.
- [ ] Add early/special closure support.
- [ ] Add IDX break state.
- [ ] Add `next_transition()`.
- [ ] Test weekends.
- [ ] Test holidays.
- [ ] Test DST transitions.
- [ ] Test IDX break.

**Exit criteria:** engine can determine correct current session without an upstream market-data connection.

---

# 53. Phase STK-2 — US Alpaca IEX Adapter

- [ ] Add Alpaca configuration.
- [ ] Add secure credentials.
- [ ] Implement WebSocket connection.
- [ ] Authenticate.
- [ ] Subscribe trade/quote/bar channels needed.
- [ ] Enforce configured live-symbol ceiling.
- [ ] Map provider symbols to canonical IDs.
- [ ] Normalize trades.
- [ ] Normalize quotes.
- [ ] Parse timestamps.
- [ ] Add heartbeat/health logic.
- [ ] Add exponential reconnect.
- [ ] Add re-subscription.
- [ ] Add feed provenance.
- [ ] Add integration test against provider/test stream where possible.

**Exit criteria:** live US watchlist events reach NATS with canonical symbols and `RealtimeVenue` quality.

---

# 54. Phase STK-3 — US Candle Integration

- [ ] Feed stock trade events into candle aggregator.
- [ ] Create current 1m candle.
- [ ] Broadcast active candle.
- [ ] Finalize 1m bar.
- [ ] Persist to QuestDB.
- [ ] Roll up 1h.
- [ ] Roll up 1d.
- [ ] Record `VolumeScope::VenueOnly`.
- [ ] Prevent duplicate bars.
- [ ] Handle late events according to existing candle lateness policy.

**Exit criteria:** `US:AAPL` produces a live chart and persistent 1m history.

---

# 55. Phase STK-4 — US Session Supervisor

- [ ] Warm up before expected session.
- [ ] Detect regular session.
- [ ] Detect provider-supported extended sessions.
- [ ] Mark closed sessions correctly.
- [ ] Avoid false stale alerts while closed.
- [ ] Finalize session state on close.
- [ ] Trigger gap repair after reconnect.
- [ ] Persist close snapshot.

**Exit criteria:** leave the server running over a full open → close → overnight → next-open cycle without manual intervention.

---

# 56. Phase STK-5 — IDX Delayed Adapter

- [ ] Implement canonical `.JK` symbol mapper.
- [ ] Implement HTTP client.
- [ ] Add conservative request headers.
- [ ] Add configurable poll interval.
- [ ] Add batch requests where supported.
- [ ] Parse latest price.
- [ ] Parse OHLC/history if exposed.
- [ ] Normalize timestamps.
- [ ] Mark all output `Delayed`.
- [ ] Add source-health state.
- [ ] Add exponential backoff.
- [ ] Add circuit breaker.
- [ ] Never aggressively scrape on errors.
- [ ] Ensure provider can be replaced without touching domain code.

**Exit criteria:** configured IDX watchlist produces normalized delayed snapshots and chartable bars.

---

# 57. Phase STK-6 — IDX 24/7 Session Handling

- [ ] Integrate Asia/Jakarta calendar.
- [ ] Handle Session I.
- [ ] Handle midday break.
- [ ] Handle Session II.
- [ ] Handle weekends.
- [ ] Handle holidays.
- [ ] Reduce polling during break.
- [ ] Reduce/stop polling after close.
- [ ] Keep last snapshot.
- [ ] Restore active cadence automatically next session.

**Exit criteria:** IDX provider runs unattended across multiple session transitions.

---

# 58. Phase STK-7 — Historical & Gap Repair

- [ ] Add stock historical backfill jobs.
- [ ] Detect missing expected 1m bars.
- [ ] Understand legitimate session gaps.
- [ ] Do not fill lunch/weekend/holiday gaps.
- [ ] Add provider rate limiter.
- [ ] Add dedupe.
- [ ] Add idempotent repair.
- [ ] Add maintenance CLI.

CLI examples:

```bash
market-maintenance equity gaps US:AAPL
market-maintenance equity repair US:AAPL --days 5

market-maintenance equity gaps ID:BBCA
market-maintenance equity repair ID:BBCA --days 5
```

---

# 59. Phase STK-8 — Corporate Actions

- [ ] Add corporate-action table.
- [ ] Add split representation.
- [ ] Add reverse split.
- [ ] Add API adjustment flag.
- [ ] Add adjustment calculation.
- [ ] Test 2:1 split.
- [ ] Test 10:1 split.
- [ ] Keep raw candles untouched.

**Exit criteria:** historical split events no longer look like catastrophic price crashes on adjusted charts.

---

# 60. Phase STK-9 — Gateway & UI

- [ ] Add equity REST endpoints.
- [ ] Add equity WS subscription.
- [ ] Add US Stocks section.
- [ ] Add Indonesia section.
- [ ] Add `LIVE · IEX` badge.
- [ ] Add `DELAYED` badge.
- [ ] Add `CLOSED` state.
- [ ] Add `BREAK` state.
- [ ] Show last-update time.
- [ ] Show source.
- [ ] Show provider quality.
- [ ] Do not show fake live animation.

**Exit criteria:** stock user experience clearly distinguishes market/session/data quality.

---

# 61. Phase STK-10 — Observability

- [ ] Add equity metrics.
- [ ] Add provider connection panels.
- [ ] Add market-state panels.
- [ ] Add last-event age.
- [ ] Add poll latency.
- [ ] Add error count.
- [ ] Add symbol-subscription count.
- [ ] Add QuestDB stock storage.
- [ ] Add gap-repair metrics.
- [ ] Add sensible alerts.

---

# 62. Phase STK-11 — 128 GB Guardrails

- [ ] Verify no raw stock persistence.
- [ ] Verify 1m stock retention.
- [ ] Add stock table size monitoring.
- [ ] Include equities in disk-pruner.
- [ ] Enforce 20 GB free-space floor.
- [ ] Cap JetStream stock raw data to <=512 MB.
- [ ] Cap debug logging.
- [ ] Test disk-pressure transitions.

---

# 63. Phase STK-12 — Soak Test

Run at least:

```text
US market:
one complete trading session

IDX:
one complete Session I + break + Session II

combined:
crypto + forex + stocks concurrently
```

Validate:

```text
no memory leak
no duplicate candles
no runaway disk growth
no false outage during closed market
no missed reconnect after session transition
no invalid DST conversion
no stale-price mislabel
```

Then run:

```text
72-hour unattended test
```

with the engine kept online continuously.

---

# 64. Acceptance Criteria

The patch is complete when:

### US

```text
AAPL / selected symbols
→ live IEX updates during supported session
→ current 1m candle updates
→ finalized 1m persists
→ closed market handled automatically
→ no manual restart next day
```

### Indonesia

```text
BBCA / selected symbols
→ delayed personal-use updates
→ correct market/break/closed state
→ 1m history where datasource permits
→ no aggressive polling while closed
→ automatically resumes next session
```

### Entire terminal

```text
crypto realtime
+
forex realtime
+
US equities
+
IDX equities
```

share:

```text
canonical domain model
NATS
Valkey
QuestDB
Rust gateway
Next.js
Prometheus/Grafana
```

without requiring separate databases or duplicated infrastructure.

---

# 65. Explicit Non-Goals

Do not add these unless deliberately requested later:

```text
US consolidated SIP subscription
IDX ITCH licensed feed
Level 2 stock order books
options chains
stock order execution
portfolio accounting
tax reporting
fundamental-data warehouse
SEC filing ingestion
news sentiment
1-second stock historical retention
```

These are separate expansions.

---

# 66. Future Provider Upgrade Path

The architecture intentionally allows:

```text
US:
Alpaca IEX
   ↓ later
IBKR / licensed SIP / direct vendor

IDX:
best-effort delayed provider
   ↓ later
broker data feed / licensed IDX source
```

Only the provider implementation changes.

This must remain unchanged:

```text
domain
NATS event contract
candle aggregation
QuestDB schema
REST API
browser protocol
frontend chart
```

---

# 67. Reference Data-Source Notes

As of September 2026:

- Alpaca Basic provides free US equity market data from IEX, with a limited number of simultaneous WebSocket symbols. It is not consolidated US-market coverage.
- Alpaca also documents a delayed SIP WebSocket feed and separate real-time IEX/SIP feeds.
- NYSE regular core trading hours are 09:30–16:00 ET; exact extended-session availability depends on venue/provider.
- Yahoo Finance labels IDX `.JK` quotes such as `BBCA.JK` as delayed. Treat any integration with that source as best-effort and replaceable.
- Official IDX real-time/delayed feeds remain exchange-controlled products and should be treated as a future licensed-provider option rather than a free dependency.

Official/reference documentation used during architecture design:

```text
https://docs.alpaca.markets/us/docs/about-market-data-api
https://docs.alpaca.markets/us/docs/real-time-stock-pricing-data
https://docs.alpaca.markets/us/docs/market-data-faq

https://www.nyse.com/trade/trading-information
https://www.nyse.com/trade/hours-calendars

https://finance.yahoo.com/quote/BBCA.JK/
https://www.idx.co.id/
```

---

# 68. Final Applied Architecture

After applying this patch:

```text
                           ┌────────────────────┐
                           │    Next.js UI      │
                           └─────────┬──────────┘
                                     │
                            REST + WebSocket
                                     │
                           ┌─────────▼──────────┐
                           │    Rust Gateway    │
                           └─────────┬──────────┘
                                     │
                          NATS / Valkey / QuestDB
                                     │
             ┌───────────────────────┼───────────────────────┐
             │                       │                       │
             ▼                       ▼                       ▼
      Crypto Collectors       Forex Collectors       Equity Collectors
             │                       │                       │
      native exchange          FX provider           ┌──────┴──────┐
          WebSockets                                 │             │
                                                   US             IDX
                                                    │              │
                                               Alpaca IEX     delayed adapter
                                                    │              │
                                                    └──────┬───────┘
                                                           │
                                                session-aware 24/7
                                                    supervisor
```

The important operational rule is:

```text
SERVER: 24/7
GATEWAY: 24/7
HISTORY: 24/7 accessible
CRYPTO: continuous according to venue
FOREX: according to FX session/provider
US STOCK: according to US session/provider
IDX STOCK: according to IDX session/provider
```

**24/7 operation must never be implemented by inventing prices during market closure.**

---

# 69. Recommended Implementation Order

Implement exactly in this order:

```text
STK-0   Domain
STK-1   Calendar engine
STK-2   Alpaca IEX
STK-3   US 1m candles
STK-4   US session supervisor
STK-5   IDX delayed provider
STK-6   IDX session supervisor
STK-7   Gap repair
STK-8   Corporate actions
STK-9   Gateway/UI
STK-10  Observability
STK-11  Storage guardrails
STK-12  72h soak test
```

Do not begin with corporate actions or UI before the provider/session/candle pipeline is stable.

---

# 70. Definition of Done

The stock patch is production-ready for this personal terminal when the machine can be left running unattended and:

```text
Friday:
IDX closes
US continues later due timezone
↓
both eventually close

Saturday/Sunday:
services remain healthy
last-known stock prices remain available
history remains queryable
no false provider alerts

next trading day:
market supervisor wakes providers
connections/subscriptions recover
missing bars repaired
ticker updates resume
1m persistence resumes

without:
manual restart
manual reconnect
manual DB repair
manual cache reset
```

That is the desired **24/7 stock handling** for this system.
