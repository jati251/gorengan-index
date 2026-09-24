# Terminal analysis

## Crypto Intel

Open **Widget → Crypto Intel** in the terminal and select a `*-USDT` crypto pair.
This is public market intelligence, not insider identification or a validated
profit strategy. Existing non-crypto workspaces are unchanged.

- `/api/crypto-intel` reads Binance public spot depth (20 levels per side),
  the latest 500 aggregate trades, and USD-M perpetual funding/open interest.
  Spot uses the official `data-api.binance.vision` market-data endpoint.
  No API key or trading permission is required. Requests time out at 8 seconds,
  independent failures produce null fields, and a bounded per-process 15-second
  cache coalesces requests. No synthetic fallback is used.
- The panel polls every 20 seconds while mounted. Snapshots older than 60 seconds,
  trades older than 60 seconds, and derivative timestamps older than 120 seconds
  are withheld. Unsupported contracts, API restrictions, and network failures
  show an unavailable state. The market-server must run for historical candles.
- Taker buy share and net flow use quote notional within the displayed sample
  window. Buyer-is-maker means the taker sold. Trade IDs are deduplicated.
  The radar shows at most the ten largest sampled aggregates above a configurable
  USDT threshold. Aggregates are not identities, wallets, or a full trade history.
- Book imbalance is `(bidNotional - askNotional) / totalNotional`; it is a
  cancellable order snapshot, not executed flow. OI is in base-asset units,
  not USD, and the funding rate is not annualized or assumed to be every 8 hours.
- Technical confirmation requires 50 closed, nonsynthetic candles. Breakout and
  relative volume compare the last bar with the **preceding** 20 bars. Trend is
  close > EMA20 > EMA50; volume confirmation is RVOL >= 2. Extension is RSI >= 70
  or close > EMA20 + 2 ATR. All four conditions must pass for the breakout label.
  The count is not a win probability. Signals are suppressed after two candle
  intervals without a closed bar or on refresh failure. Future bars are excluded.
- Spot/long sizing caps quantity by both available cash and the selected risk
  budget. Entry includes adverse slippage and buy fee; exit includes adverse
  slippage and sell fee. Quantity rounds down to a user-supplied step. The ATR
  button fills an illustrative 2 ATR stop and 4 ATR target. Stops can slip beyond
  the modeled amount. Leverage, taxes, funding costs and minimum notional are
  not modeled; the default quantity step is not exchange metadata.

On-chain wallet attribution, exchange wallet flows, liquidation feeds, push
alerts and profitability backtests are not implemented. They need separate
data coverage and validation; the panel does not invent them.

Crypto calculation checks:

```sh
pnpm --filter @gorengan/market-server exec tsx --test ../web/src/features/analysis/utils/cryptoSignals.test.ts
```

Sources: [Binance public market data](https://developers.binance.com/en/docs/products/spot/rest-api)
and [USD-M market data](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data).

## Existing analysis

The terminal reads the selected instrument and interval from the market store.
Historical candles share the chart query cache and refresh every 30 seconds.
Analysis rejects mismatched instruments or intervals, invalid OHLC values,
unfinished candles, and synthetic candles. Duplicate timestamps are removed.

- **Technical analysis:** requires 50 closed candles. EMA 20/50 use SMA seeds;
  RSI 14 and ATR 14 use Wilder smoothing. Support and resistance are the low
  and high of the last 20 valid candles.
- **Projection:** requires 60 closed candles. The central path is
  `lastClose × exp(meanLogReturn × horizon)`. The scenario envelope adds or
  subtracts `sampleStdDev × sqrt(horizon)` in log space. Horizons are 5, 10,
  or 20 observed candles, not calendar-time targets. This is an uncalibrated
  statistical scenario, not a trained predictive model or trade signal.
- **Composition:** counts unique instruments by asset class or 24-hour price
  direction. Missing returns remain a separate category. It does not combine
  volumes or portfolio values denominated in different currencies.

Run calculation checks from the repository root:

```sh
pnpm --filter @gorengan/market-server exec tsx --test ../web/src/features/analysis/utils/analysis.test.ts ../web/src/features/analysis/utils/calculator.test.ts
```

## Currency and calculator

USD/IDR is fetched through the same-origin `/api/exchange-rate` route from
https://api.frankfurter.dev/v2/rate/USD/IDR. There is no fixed fallback rate.
The route validates the pair, date and positive finite rate, times out after
8 seconds, and permits five minutes of HTTP caching. The client refreshes
every five minutes and shows the source date and fetch time. Cached data on
refetch failure is marked as stale. This is a daily reference rate, not an
executable bank quote; USDT is not silently treated as USD.

The spot calculator uses capital inclusive of the buy fee:
`quantity = capital / (entry × (1 + fee))`.
Net proceeds are `quantity × exit × (1 - fee)`; net profit subtracts capital.
Break-even includes both fees. Inputs use one selected currency and allow
fractional units. Taxes, minimum lots, spread, leverage and funding are excluded.

## Loading and unavailable data

Route boundaries and data panels use pixel loading/error/empty states.
API requests have a 12-second timeout. Missing/nonfinite prices, percentages
and volumes render as a dash, while actual zero remains zero.
Charts clear old series on missing history; switching intervals no longer
uses another interval's placeholder candles. Retry preserves the layout.
