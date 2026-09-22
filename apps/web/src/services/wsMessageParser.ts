import type {
  MarketTicker,
  Candle,
  Timeframe,
  ProviderStatusLevel,
  FxQuoteTick,
  CandlePriceBasis,
  MarketSessionState,
  AssetClass,
} from "@gorengan/shared";

/* ─── Raw WebSocket Server Message ────────────────────────────────── */

export interface WsServerMessage {
  type:
    | "ticker"
    | "fx_quote"
    | "candle"
    | "status"
    | "snapshot"
    | "pong"
    | "subscribed"
    | "unsubscribed"
    | "error";
  ticker?: Record<string, unknown>;
  quote?: Record<string, unknown>;
  candle?: Record<string, unknown>;
  status?: Record<string, unknown> | string;
  tickers?: Record<string, MarketTicker>;
  candles?: Record<string, Candle>;
  lastEventAt?: number;
}

/* ─── Parsers ─────────────────────────────────────────────────────── */

export function parseTicker(raw: Record<string, unknown>): MarketTicker {
  const symbol = String(raw.instrument ?? raw.symbol ?? "");
  const bid = raw.bid != null ? Number(raw.bid) : undefined;
  const ask = raw.ask != null ? Number(raw.ask) : undefined;
  const mid = raw.mid != null ? Number(raw.mid) : undefined;
  const spread = raw.spread != null ? Number(raw.spread) : undefined;
  const spreadPips =
    raw.spreadPips != null
      ? Number(raw.spreadPips)
      : raw.spread_pips != null
        ? Number(raw.spread_pips)
        : undefined;
  const sessionState =
    raw.sessionState != null
      ? (String(raw.sessionState) as MarketSessionState)
      : raw.session_state != null
        ? (String(raw.session_state) as MarketSessionState)
        : undefined;
  const assetClass =
    raw.assetClass != null
      ? (String(raw.assetClass) as AssetClass)
      : raw.asset_class != null
        ? (String(raw.asset_class) as AssetClass)
        : undefined;

  return {
    symbol,
    price: Number(raw.price ?? mid ?? 0),
    change24h: Number(raw.change_24h ?? raw.change24h ?? 0),
    changePercent24h: Number(raw.change_percent_24h ?? raw.changePercent24h ?? 0),
    high24h: Number(raw.high_24h ?? raw.high24h ?? raw.price ?? 0),
    low24h: Number(raw.low_24h ?? raw.low24h ?? raw.price ?? 0),
    volume24h: Number(raw.volume_24h ?? raw.volume24h ?? 0),
    quoteVolume24h: Number(raw.quote_volume_24h ?? raw.quoteVolume24h ?? 0),
    timestamp: raw.updated_at_ns
      ? Math.floor(Number(raw.updated_at_ns) / 1_000_000)
      : Number(raw.timestamp ?? Date.now()),
    provider: String(raw.provider ?? "interbank"),
    bid,
    ask,
    mid,
    spread,
    spreadPips,
    sessionState,
    assetClass,
  };
}

export function parseFxQuote(raw: Record<string, unknown>): FxQuoteTick {
  const instrument = String(raw.instrument ?? raw.symbol ?? "");
  const bid = Number(raw.bid ?? 0);
  const ask = Number(raw.ask ?? 0);
  const mid = Number(raw.mid ?? (bid + ask) / 2);
  const spread = Number(raw.spread ?? (ask - bid));
  const spreadBps = Number(
    raw.spread_bps ?? raw.spreadBps ?? (mid > 0 ? (spread / mid) * 10000 : 0)
  );
  const providerTs = raw.provider_ts_ns
    ? Math.floor(Number(raw.provider_ts_ns) / 1_000_000)
    : Number(raw.ts ?? Date.now());

  return {
    instrument,
    provider: String(raw.provider ?? "interbank"),
    providerSymbol: String(raw.provider_symbol ?? raw.providerSymbol ?? instrument),
    bid,
    ask,
    mid,
    spread,
    spreadBps,
    providerTs,
    ingestTs: raw.ingest_ts_ns
      ? Math.floor(Number(raw.ingest_ts_ns) / 1_000_000)
      : Date.now(),
  };
}

export function parseCandle(raw: Record<string, unknown>): Candle {
  const symbol = String(raw.instrument ?? raw.symbol ?? "");
  const timeframe = (raw.interval ?? raw.timeframe ?? "1m") as Timeframe;
  const openTime = raw.open_time_ns
    ? Math.floor(Number(raw.open_time_ns) / 1_000_000)
    : Number(raw.openTime ?? Date.now());
  const closeTime = raw.close_time_ns
    ? Math.floor(Number(raw.close_time_ns) / 1_000_000)
    : Number(raw.closeTime ?? Date.now());

  const priceBasis = (raw.priceBasis ?? raw.price_basis) as CandlePriceBasis | undefined;
  const spreadClose = raw.spreadClose != null ? Number(raw.spreadClose) : raw.spread_close != null ? Number(raw.spread_close) : undefined;

  return {
    symbol,
    timeframe,
    openTime,
    closeTime,
    open: Number(raw.open ?? 0),
    high: Number(raw.high ?? 0),
    low: Number(raw.low ?? 0),
    close: Number(raw.close ?? 0),
    volume: Number(raw.volume ?? 0),
    trades: Number(raw.trade_count ?? raw.trades ?? 0),
    finalized: Boolean(raw.finalized),
    provider: String(raw.provider ?? "interbank"),
    priceBasis,
    spreadClose,
  };
}

export function parseStatus(
  raw: WsServerMessage
): { status: ProviderStatusLevel; lastEventAt: number } | null {
  const s = raw.status;

  if (typeof s === "object" && s !== null) {
    const statusStr = String(
      (s as Record<string, unknown>).status ?? "LIVE"
    ) as ProviderStatusLevel;
    const lastEventNs = (s as Record<string, unknown>).last_event_at_ns;
    const lastEventAt = lastEventNs
      ? Math.floor(Number(lastEventNs) / 1_000_000)
      : Date.now();
    return { status: statusStr, lastEventAt };
  }

  if (typeof s === "string") {
    return {
      status: s as ProviderStatusLevel,
      lastEventAt: Number(raw.lastEventAt ?? Date.now()),
    };
  }

  return null;
}
