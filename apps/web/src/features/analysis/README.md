# Terminal analysis

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
