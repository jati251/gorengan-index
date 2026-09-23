use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use anyhow::{Context, Result};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use axum::routing::get;
use axum::Router;
use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, RwLock};
use tokio::time::sleep;
use tower_http::cors::CorsLayer;
use tracing::{debug, info, warn, Level};
use tracing_subscriber::FmtSubscriber;

use market_config::AppConfig;
use market_domain::{
    AssetClass, Candle, IdxMarketCalendar, Instrument, InstrumentId, Interval, MarketCalendar,
    MarketSessionState, ProviderId, QuoteTick, TickerState, UsMarketCalendar,
};
use market_protocol::{
    ClientWsCommand, MarketMessage, NatsSubjects, ProviderStatusEvent, ServerWsEvent,
    SessionStateUpdate,
};

static ACTIVE_WS_CLIENTS: AtomicU64 = AtomicU64::new(0);

#[derive(Clone)]
struct AppState {
    config: AppConfig,
    instruments: Vec<Instrument>,
    latest_tickers: Arc<RwLock<HashMap<InstrumentId, TickerState>>>,
    latest_candles: Arc<RwLock<HashMap<String, Candle>>>, // key: "1s:BTC-USDT" or "1m:EUR-USD"
    provider_status: Arc<RwLock<HashMap<ProviderId, ProviderStatusEvent>>>,
    broadcast_tx: broadcast::Sender<ServerWsEvent>,
    http_client: reqwest::Client,
    cached_news: Arc<RwLock<(Option<tokio::time::Instant>, Vec<NewsArticle>)>>,
    cached_sentiment: Arc<RwLock<(Option<tokio::time::Instant>, SentimentData)>>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    let cfg = AppConfig::load().context("Failed to load application config")?;

    // Load dynamic instruments directly from PostgreSQL (SSOT)
    let all_instruments = if let Some(ref db_url) = cfg.database_url {
        match Instrument::load_from_connection_string(db_url).await {
            Ok(instruments) => {
                info!(count = instruments.len(), "Loaded dynamic market instruments directly from PostgreSQL");
                instruments
            }
            Err(e) => {
                warn!(err = %e, "Failed to load instruments from PostgreSQL; falling back to offline fixtures");
                Instrument::test_fixtures()
            }
        }
    } else {
        info!("No DATABASE_URL configured; using offline fixtures");
        Instrument::test_fixtures()
    };

    let active_instruments: Vec<Instrument> = if std::env::var("UNIVERSE").is_ok() || std::env::var("MARKET_UNIVERSE").is_ok() {
        let universe_set: HashSet<InstrumentId> =
            cfg.universe.iter().map(|s| InstrumentId::new(s.clone())).collect();
        all_instruments
            .into_iter()
            .filter(|inst| inst.enabled && universe_set.contains(&inst.id))
            .collect()
    } else {
        all_instruments
            .into_iter()
            .filter(|inst| inst.enabled)
            .collect()
    };

    let (broadcast_tx, _) = broadcast::channel(10_000);

    let state = AppState {
        config: cfg.clone(),
        instruments: active_instruments,
        latest_tickers: Arc::new(RwLock::new(HashMap::new())),
        latest_candles: Arc::new(RwLock::new(HashMap::new())),
        provider_status: Arc::new(RwLock::new(HashMap::new())),
        broadcast_tx,
        http_client: reqwest::Client::builder()
            .timeout(Duration::from_secs(6))
            .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
            .build()?,
        cached_news: Arc::new(RwLock::new((None, Vec::new()))),
        cached_sentiment: Arc::new(RwLock::new((None, SentimentData::default()))),
    };

    info!("===============================================");
    info!("Starting Rust Realtime Market Gateway Daemon");
    info!(gateway_port = cfg.gateway_port, "Gateway HTTP & WS listener");
    info!(nats_url = %cfg.nats_url, "NATS event bus endpoint");
    info!(questdb_url = %cfg.questdb_http_url, "QuestDB HTTP query endpoint");
    info!("===============================================");

    // Background NATS consumer
    let nats_state = state.clone();
    tokio::spawn(async move {
        run_nats_consumer(nats_state).await;
    });

    // Background real live Forex poller
    let fx_state = state.clone();
    tokio::spawn(async move {
        run_fx_poller(fx_state).await;
    });

    // Background 24/7 Equity Session Supervisor & Poller (US & IDX)
    let equity_state = state.clone();
    tokio::spawn(async move {
        run_equity_supervisor_and_poller(equity_state).await;
    });

    // Axum Router with CORS
    let app = Router::new()
        .route("/v1/health", get(handle_health))
        .route("/v1/symbols", get(handle_symbols))
        .route("/v1/markets", get(handle_markets))
        .route("/v1/candles", get(handle_candles))
        .route("/v1/candles/{instrument}", get(handle_candles_path))
        // Aliases for FX endpoints per architecture spec
        .route("/v1/fx/instruments", get(handle_fx_symbols))
        .route("/v1/fx/markets", get(handle_fx_markets))
        .route("/v1/fx/candles", get(handle_candles))
        .route("/v1/fx/candles/{instrument}", get(handle_candles_path))
        // Equities & Market Session routes per STK patch spec
        .route("/v1/equities", get(handle_equity_symbols))
        .route("/v1/equities/{instrument}", get(handle_candles_path))
        .route("/v1/markets/us/session", get(handle_us_session))
        .route("/v1/markets/id/session", get(handle_id_session))
        .route("/v1/news", get(handle_news))
        .route("/v1/sentiment", get(handle_sentiment))
        .route("/v1/stream", get(handle_ws_upgrade))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], cfg.gateway_port));
    info!(addr = %addr, "Gateway listening on HTTP and WebSocket");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await?;

    Ok(())
}

async fn run_nats_consumer(state: AppState) {
    let nats_url = state.config.nats_url.clone();

    loop {
        info!(nats_url = %nats_url, "Gateway connecting to NATS event bus...");
        let client = match async_nats::connect(&nats_url).await {
            Ok(c) => {
                info!("Gateway connected to NATS successfully");
                c
            }
            Err(e) => {
                warn!(error = %e, "Gateway failed to connect to NATS. Retrying in 2s...");
                sleep(Duration::from_secs(2)).await;
                continue;
            }
        };

        let mut ticker_sub = match client.subscribe(NatsSubjects::all_tickers()).await {
            Ok(s) => s,
            Err(e) => {
                warn!(error = %e, "Failed to subscribe to tickers");
                continue;
            }
        };

        let mut quote_sub = match client.subscribe(NatsSubjects::all_fx_quotes()).await {
            Ok(s) => s,
            Err(e) => {
                warn!(error = %e, "Failed to subscribe to fx quotes");
                continue;
            }
        };

        let mut candle_sub = match client.subscribe("market.candle.*.*").await {
            Ok(s) => s,
            Err(e) => {
                warn!(error = %e, "Failed to subscribe to candles");
                continue;
            }
        };

        let mut status_sub = match client.subscribe(NatsSubjects::all_statuses()).await {
            Ok(s) => s,
            Err(e) => {
                warn!(error = %e, "Failed to subscribe to statuses");
                continue;
            }
        };

        info!("Gateway active on NATS topics (tickers, fx_quotes, candles, statuses)");

        loop {
            tokio::select! {
                Some(msg) = ticker_sub.next() => {
                    if let Ok(MarketMessage::Ticker(ticker)) = serde_json::from_slice::<MarketMessage>(&msg.payload) {
                        {
                            let mut lock = state.latest_tickers.write().await;
                            lock.insert(ticker.instrument.clone(), ticker.clone());
                        }
                        let _ = state.broadcast_tx.send(ServerWsEvent::Ticker { ticker });
                    }
                }
                Some(msg) = quote_sub.next() => {
                    if let Ok(MarketMessage::Quote(quote)) = serde_json::from_slice::<MarketMessage>(&msg.payload) {
                        let ticker = TickerState {
                            instrument: quote.instrument.clone(),
                            provider: quote.provider.clone(),
                            price: quote.mid,
                            bid: Some(quote.bid),
                            ask: Some(quote.ask),
                            mid: Some(quote.mid),
                            spread: Some(quote.spread),
                            spread_bps: Some(quote.spread_bps),
                            open_24h: None,
                            high_24h: None,
                            low_24h: None,
                            volume_24h: None,
                            quote_volume_24h: None,
                            change_24h: None,
                            change_percent_24h: None,
                            updated_at_ns: quote.provider_ts_ns,
                            session_state: Some("open".into()),
                            session_segment: Some("REGULAR".into()),
                            data_quality: Some("realtime_consolidated".into()),
                            market: Some("FX".into()),
                            currency: Some("USD".into()),
                            previous_close: None,
                        };
                        {
                            let mut lock = state.latest_tickers.write().await;
                            lock.insert(quote.instrument.clone(), ticker.clone());
                        }
                        let _ = state.broadcast_tx.send(ServerWsEvent::Ticker { ticker });
                        let _ = state.broadcast_tx.send(ServerWsEvent::FxQuote { quote });
                    }
                }
                Some(msg) = candle_sub.next() => {
                    if let Ok(MarketMessage::Candle(candle)) = serde_json::from_slice::<MarketMessage>(&msg.payload) {
                        let key = format!("{}:{}", candle.interval.as_str(), candle.instrument.as_str());
                        {
                            let mut lock = state.latest_candles.write().await;
                            lock.insert(key, candle.clone());
                        }
                        let _ = state.broadcast_tx.send(ServerWsEvent::Candle { candle });
                    }
                }
                Some(msg) = status_sub.next() => {
                    if let Ok(MarketMessage::Status(status)) = serde_json::from_slice::<MarketMessage>(&msg.payload) {
                        {
                            let mut lock = state.provider_status.write().await;
                            lock.insert(status.provider.clone(), status.clone());
                        }
                        let _ = state.broadcast_tx.send(ServerWsEvent::Status { status });
                    }
                }
                else => {
                    warn!("NATS subscription stream terminated; reconnecting...");
                    break;
                }
            }
        }

        sleep(Duration::from_secs(2)).await;
    }
}

/// Real live background poller for Forex pairs from CCY market feed
async fn run_fx_poller(state: AppState) {
    let fx_instruments: Vec<Instrument> = state
        .instruments
        .iter()
        .filter(|i| i.asset_class == AssetClass::Fx)
        .cloned()
        .collect();

    if fx_instruments.is_empty() {
        return;
    }

    info!(count = fx_instruments.len(), "Starting real Forex live market quote poller");

    loop {
        for inst in &fx_instruments {
            let url = format!(
                "https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1m&range=1d",
                inst.provider_symbol
            );

            if let Ok(res) = state.http_client.get(&url).send().await {
                if res.status().is_success() {
                    if let Ok(json) = res.json::<serde_json::Value>().await {
                        if let Some(result) = json.pointer("/chart/result/0") {
                            let meta = result.get("meta");
                            let regular_price = meta
                                .and_then(|m| m.get("regularMarketPrice"))
                                .and_then(|v| v.as_f64());
                            let regular_time = meta
                                .and_then(|m| m.get("regularMarketTime"))
                                .and_then(|v| v.as_i64())
                                .unwrap_or_else(|| Utc::now().timestamp());
                            let day_high = meta
                                .and_then(|m| m.get("regularMarketDayHigh"))
                                .and_then(|v| v.as_f64());
                            let day_low = meta
                                .and_then(|m| m.get("regularMarketDayLow"))
                                .and_then(|v| v.as_f64());
                            let prev_close = meta
                                .and_then(|m| m.get("chartPreviousClose").or_else(|| m.get("previousClose")))
                                .and_then(|v| v.as_f64());

                            if let Some(price_f64) = regular_price {
                                let pip_size = inst.pip_size.and_then(|p| p.to_f64()).unwrap_or(0.0001);
                                let spread_f64 = pip_size * 0.8;
                                let bid_f64 = price_f64 - spread_f64 / 2.0;
                                let ask_f64 = price_f64 + spread_f64 / 2.0;
                                let spread_bps_f64 = (spread_f64 / price_f64) * 10_000.0;

                                let change_24h = prev_close.map(|pc| price_f64 - pc);
                                let change_pct = prev_close.map(|pc| ((price_f64 - pc) / pc) * 100.0);

                                let price_dec = Decimal::from_f64_retain(price_f64).unwrap_or(Decimal::ZERO);
                                let bid_dec = Decimal::from_f64_retain(bid_f64).unwrap_or(Decimal::ZERO);
                                let ask_dec = Decimal::from_f64_retain(ask_f64).unwrap_or(Decimal::ZERO);
                                let mid_dec = price_dec;
                                let spread_dec = Decimal::from_f64_retain(spread_f64).unwrap_or(Decimal::ZERO);
                                let spread_bps_dec = Decimal::from_f64_retain(spread_bps_f64).unwrap_or(Decimal::ZERO);

                                let quote_tick = QuoteTick {
                                    instrument: inst.id.clone(),
                                    provider: inst.provider.clone(),
                                    provider_symbol: inst.provider_symbol.clone(),
                                    bid: bid_dec,
                                    ask: ask_dec,
                                    mid: mid_dec,
                                    spread: spread_dec,
                                    spread_bps: spread_bps_dec,
                                    provider_ts_ns: regular_time * 1_000_000_000,
                                    ingest_ts_ns: Utc::now().timestamp_nanos_opt().unwrap_or(0),
                                    sequence: None,
                                    tradeable: Some(true),
                                    bid_size: None,
                                    ask_size: None,
                                };

                                let ticker = TickerState {
                                    instrument: inst.id.clone(),
                                    provider: inst.provider.clone(),
                                    price: price_dec,
                                    bid: Some(bid_dec),
                                    ask: Some(ask_dec),
                                    mid: Some(mid_dec),
                                    spread: Some(spread_dec),
                                    spread_bps: Some(spread_bps_dec),
                                    open_24h: prev_close.and_then(Decimal::from_f64_retain),
                                    high_24h: day_high.and_then(Decimal::from_f64_retain),
                                    low_24h: day_low.and_then(Decimal::from_f64_retain),
                                    volume_24h: Some(Decimal::ZERO),
                                    quote_volume_24h: Some(Decimal::ZERO),
                                    change_24h: change_24h.and_then(Decimal::from_f64_retain),
                                    change_percent_24h: change_pct.and_then(Decimal::from_f64_retain),
                                    updated_at_ns: regular_time * 1_000_000_000,
                                    session_state: Some("open".into()),
                                    session_segment: Some("REGULAR".into()),
                                    data_quality: Some("realtime_venue".into()),
                                    market: Some("FX".into()),
                                    currency: Some(inst.quote.clone()),
                                    previous_close: prev_close.and_then(Decimal::from_f64_retain),
                                };

                                {
                                    let mut lock = state.latest_tickers.write().await;
                                    lock.insert(inst.id.clone(), ticker.clone());
                                }

                                let _ = state.broadcast_tx.send(ServerWsEvent::Ticker { ticker });
                                let _ = state.broadcast_tx.send(ServerWsEvent::FxQuote { quote: quote_tick });

                                // Check if there is an active 1m candle to cache
                                let timestamps = result.get("timestamp").and_then(|t| t.as_array());
                                let quote_obj = result.pointer("/indicators/quote/0");
                                if let (Some(ts_arr), Some(q)) = (timestamps, quote_obj) {
                                    let opens = q.get("open").and_then(|v| v.as_array());
                                    let highs = q.get("high").and_then(|v| v.as_array());
                                    let lows = q.get("low").and_then(|v| v.as_array());
                                    let closes = q.get("close").and_then(|v| v.as_array());

                                    if let (Some(ts_last), Some(o_arr), Some(h_arr), Some(l_arr), Some(c_arr)) =
                                        (ts_arr.last().and_then(|v| v.as_i64()), opens, highs, lows, closes)
                                    {
                                        let o = o_arr.last().and_then(|v| v.as_f64());
                                        let h = h_arr.last().and_then(|v| v.as_f64());
                                        let l = l_arr.last().and_then(|v| v.as_f64());
                                        let c = c_arr.last().and_then(|v| v.as_f64());

                                        if let (Some(ov), Some(hv), Some(lv), Some(cv)) = (o, h, l, c) {
                                            let mut candle = Candle::new(
                                                inst.id.clone(),
                                                Interval::Min1,
                                                ts_last * 1_000_000_000,
                                                Decimal::from_f64_retain(ov).unwrap_or(price_dec),
                                                Decimal::ONE,
                                                inst.provider.clone(),
                                            );
                                            candle.high = Decimal::from_f64_retain(hv).unwrap_or(price_dec);
                                            candle.low = Decimal::from_f64_retain(lv).unwrap_or(price_dec);
                                            candle.close = Decimal::from_f64_retain(cv).unwrap_or(price_dec);

                                            let key = format!("1m:{}", inst.id.as_str());
                                            {
                                                let mut lock = state.latest_candles.write().await;
                                                lock.insert(key, candle.clone());
                                            }
                                            let _ = state.broadcast_tx.send(ServerWsEvent::Candle { candle });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            sleep(Duration::from_millis(300)).await;
        }

        sleep(Duration::from_secs(4)).await;
    }
}

/// Real background supervisor & poller for US & IDX Equities (24/7 session-aware)
async fn run_equity_supervisor_and_poller(state: AppState) {
    let equity_instruments: Vec<Instrument> = state
        .instruments
        .iter()
        .filter(|i| {
            matches!(
                i.asset_class,
                AssetClass::UsStocks | AssetClass::IdxStocks | AssetClass::Equity | AssetClass::Etf
            ) || i.id.as_str().starts_with("US:")
                || i.id.as_str().starts_with("ID:")
        })
        .cloned()
        .collect();

    if equity_instruments.is_empty() {
        return;
    }

    info!(count = equity_instruments.len(), "Starting 24/7 Equity Session Supervisor & Poller");

    let us_cal = UsMarketCalendar::new();
    let id_cal = IdxMarketCalendar::new();

    let mut last_us_state = MarketSessionState::Unknown;
    let mut last_id_state = MarketSessionState::Unknown;
    let mut is_initial_run = true;

    loop {
        let now = Utc::now();
        let us_state = us_cal.state_at(now);
        let id_state = id_cal.state_at(now);

        let us_state_str = match us_state {
            MarketSessionState::Regular => "REGULAR",
            MarketSessionState::PreMarket => "PRE_MARKET",
            MarketSessionState::AfterHours => "AFTER_HOURS",
            MarketSessionState::Break => "BREAK",
            MarketSessionState::Holiday => "HOLIDAY",
            MarketSessionState::Closed => "CLOSED",
            _ => "CLOSED",
        };
        let id_state_str = match id_state {
            MarketSessionState::Regular => "REGULAR",
            MarketSessionState::PreMarket => "PRE_MARKET",
            MarketSessionState::AfterHours => "AFTER_HOURS",
            MarketSessionState::Break => "BREAK",
            MarketSessionState::Holiday => "HOLIDAY",
            MarketSessionState::Closed => "CLOSED",
            _ => "CLOSED",
        };

        if us_state != last_us_state || is_initial_run {
            last_us_state = us_state;
            let evt = ServerWsEvent::Session {
                session: SessionStateUpdate {
                    market: "US".to_string(),
                    state: us_state_str.to_string(),
                    segment: us_cal.session_segment(now),
                    next_transition_at: us_cal.next_transition(now).map(|dt| dt.timestamp_millis()),
                    ts: now.timestamp_millis(),
                },
            };
            let _ = state.broadcast_tx.send(evt);
        }

        if id_state != last_id_state || is_initial_run {
            last_id_state = id_state;
            let evt = ServerWsEvent::Session {
                session: SessionStateUpdate {
                    market: "ID".to_string(),
                    state: id_state_str.to_string(),
                    segment: id_cal.session_segment(now),
                    next_transition_at: id_cal.next_transition(now).map(|dt| dt.timestamp_millis()),
                    ts: now.timestamp_millis(),
                },
            };
            let _ = state.broadcast_tx.send(evt);
        }

        for inst in &equity_instruments {
            let is_us = inst.asset_class == AssetClass::UsStocks || inst.id.as_str().starts_with("US:");
            let _is_id = inst.asset_class == AssetClass::IdxStocks || inst.id.as_str().starts_with("ID:");
            let active_state = if is_us { us_state } else { id_state };

            let should_poll = is_initial_run
                || active_state == MarketSessionState::Regular
                || active_state == MarketSessionState::PreMarket
                || active_state == MarketSessionState::AfterHours;

            if should_poll {
                let url = format!(
                    "https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1m&range=1d",
                    inst.provider_symbol
                );

                if let Ok(res) = state.http_client.get(&url).send().await {
                    if res.status().is_success() {
                        if let Ok(json) = res.json::<serde_json::Value>().await {
                            if let Some(result) = json.pointer("/chart/result/0") {
                                let meta = result.get("meta");
                                let regular_price = meta
                                    .and_then(|m| m.get("regularMarketPrice"))
                                    .and_then(|v| v.as_f64());
                                let regular_time = meta
                                    .and_then(|m| m.get("regularMarketTime"))
                                    .and_then(|v| v.as_i64())
                                    .unwrap_or_else(|| Utc::now().timestamp());
                                let day_high = meta
                                    .and_then(|m| m.get("regularMarketDayHigh"))
                                    .and_then(|v| v.as_f64());
                                let day_low = meta
                                    .and_then(|m| m.get("regularMarketDayLow"))
                                    .and_then(|v| v.as_f64());
                                let prev_close = meta
                                    .and_then(|m| m.get("chartPreviousClose").or_else(|| m.get("previousClose")))
                                    .and_then(|v| v.as_f64());
                                let day_volume = meta
                                    .and_then(|m| m.get("regularMarketVolume"))
                                    .and_then(|v| v.as_f64())
                                    .unwrap_or(0.0);

                                if let Some(price_f64) = regular_price {
                                    let change_24h = prev_close.map(|pc| price_f64 - pc);
                                    let change_pct = prev_close.map(|pc| ((price_f64 - pc) / pc) * 100.0);

                                    let price_dec = Decimal::from_f64_retain(price_f64).unwrap_or(Decimal::ZERO);
                                    let market_name = if is_us { "US" } else { "ID" };
                                    let currency_name = if is_us { "USD" } else { "IDR" };
                                    let data_quality_str = if is_us {
                                        if active_state == MarketSessionState::Regular {
                                            "realtime_venue"
                                        } else {
                                            "last_known"
                                        }
                                    } else {
                                        if active_state == MarketSessionState::Regular {
                                            "delayed"
                                        } else {
                                            "last_known"
                                        }
                                    };

                                    let session_state_str = match active_state {
                                        MarketSessionState::Regular => "regular",
                                        MarketSessionState::PreMarket => "pre_market",
                                        MarketSessionState::AfterHours => "after_hours",
                                        MarketSessionState::Break => "break",
                                        MarketSessionState::Holiday => "holiday",
                                        _ => "closed",
                                    };

                                    let session_segment = if is_us {
                                        us_cal.session_segment(now)
                                    } else {
                                        id_cal.session_segment(now)
                                    };

                                    let ticker = TickerState {
                                        instrument: inst.id.clone(),
                                        provider: inst.provider.clone(),
                                        price: price_dec,
                                        bid: Some(price_dec),
                                        ask: Some(price_dec),
                                        mid: Some(price_dec),
                                        spread: None,
                                        spread_bps: None,
                                        open_24h: prev_close.and_then(Decimal::from_f64_retain),
                                        high_24h: day_high.and_then(Decimal::from_f64_retain),
                                        low_24h: day_low.and_then(Decimal::from_f64_retain),
                                        volume_24h: Some(Decimal::from_f64_retain(day_volume).unwrap_or(Decimal::ZERO)),
                                        quote_volume_24h: Some(Decimal::ZERO),
                                        change_24h: change_24h.and_then(Decimal::from_f64_retain),
                                        change_percent_24h: change_pct.and_then(Decimal::from_f64_retain),
                                        updated_at_ns: regular_time * 1_000_000_000,
                                        session_state: Some(session_state_str.into()),
                                        session_segment,
                                        data_quality: Some(data_quality_str.into()),
                                        market: Some(market_name.into()),
                                        currency: Some(currency_name.into()),
                                        previous_close: prev_close.and_then(Decimal::from_f64_retain),
                                    };

                                    {
                                        let mut lock = state.latest_tickers.write().await;
                                        lock.insert(inst.id.clone(), ticker.clone());
                                    }

                                    let _ = state.broadcast_tx.send(ServerWsEvent::Ticker { ticker });

                                    // Parse latest candle
                                    let timestamps = result.get("timestamp").and_then(|t| t.as_array());
                                    let quote_obj = result.pointer("/indicators/quote/0");
                                    if let (Some(ts_arr), Some(q)) = (timestamps, quote_obj) {
                                        let opens = q.get("open").and_then(|v| v.as_array());
                                        let highs = q.get("high").and_then(|v| v.as_array());
                                        let lows = q.get("low").and_then(|v| v.as_array());
                                        let closes = q.get("close").and_then(|v| v.as_array());
                                        let volumes = q.get("volume").and_then(|v| v.as_array());

                                        if let (Some(ts_last), Some(o_arr), Some(h_arr), Some(l_arr), Some(c_arr)) =
                                            (ts_arr.last().and_then(|v| v.as_i64()), opens, highs, lows, closes)
                                        {
                                            let o = o_arr.last().and_then(|v| v.as_f64());
                                            let h = h_arr.last().and_then(|v| v.as_f64());
                                            let l = l_arr.last().and_then(|v| v.as_f64());
                                            let c = c_arr.last().and_then(|v| v.as_f64());
                                            let v = volumes.and_then(|v_arr| v_arr.last().and_then(|x| x.as_f64())).unwrap_or(0.0);

                                            if let (Some(ov), Some(hv), Some(lv), Some(cv)) = (o, h, l, c) {
                                                let mut candle = Candle::new(
                                                    inst.id.clone(),
                                                    Interval::Min1,
                                                    ts_last * 1_000_000_000,
                                                    Decimal::from_f64_retain(ov).unwrap_or(price_dec),
                                                    Decimal::from_f64_retain(v).unwrap_or(Decimal::ZERO),
                                                    inst.provider.clone(),
                                                );
                                                candle.high = Decimal::from_f64_retain(hv).unwrap_or(price_dec);
                                                candle.low = Decimal::from_f64_retain(lv).unwrap_or(price_dec);
                                                candle.close = Decimal::from_f64_retain(cv).unwrap_or(price_dec);

                                                let key = format!("1m:{}", inst.id.as_str());
                                                {
                                                    let mut lock = state.latest_candles.write().await;
                                                    lock.insert(key, candle.clone());
                                                }
                                                let _ = state.broadcast_tx.send(ServerWsEvent::Candle { candle });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                sleep(Duration::from_millis(250)).await;
            } else {
                let mut lock = state.latest_tickers.write().await;
                if let Some(t) = lock.get_mut(&inst.id) {
                    let session_state_str = match active_state {
                        MarketSessionState::Break => "break",
                        MarketSessionState::Holiday => "holiday",
                        _ => "closed",
                    };
                    t.session_state = Some(session_state_str.into());
                    t.session_segment = if is_us { us_cal.session_segment(now) } else { id_cal.session_segment(now) };
                    t.data_quality = Some("last_known".into());
                }
            }
        }

        is_initial_run = false;

        let any_active = us_state == MarketSessionState::Regular
            || us_state == MarketSessionState::PreMarket
            || us_state == MarketSessionState::AfterHours
            || id_state == MarketSessionState::Regular;

        if any_active {
            sleep(Duration::from_secs(5)).await;
        } else {
            sleep(Duration::from_secs(30)).await;
        }
    }
}


// REST Handlers

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    active_ws_clients: u64,
    instruments_count: usize,
    timestamp_ns: i64,
}

async fn handle_health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        active_ws_clients: ACTIVE_WS_CLIENTS.load(Ordering::Relaxed),
        instruments_count: state.instruments.len(),
        timestamp_ns: Utc::now().timestamp_nanos_opt().unwrap_or(0),
    })
}

#[derive(Deserialize, Default)]
struct SymbolsQuery {
    #[serde(rename = "assetClass")]
    asset_class: Option<String>,
}

#[derive(Serialize)]
struct MarketSymbolDto {
    id: String,
    base: String,
    quote: String,
    #[serde(rename = "assetClass")]
    asset_class: String,
    provider: String,
    #[serde(rename = "providerSymbol")]
    provider_symbol: String,
    name: String,
    enabled: bool,
    #[serde(rename = "isTokenizedMetal")]
    is_tokenized_metal: bool,
    #[serde(rename = "pipSize", skip_serializing_if = "Option::is_none")]
    pip_size: Option<f64>,
    #[serde(rename = "displayDecimals", skip_serializing_if = "Option::is_none")]
    display_decimals: Option<u32>,
    #[serde(rename = "candlePriceBasis", skip_serializing_if = "Option::is_none")]
    candle_price_basis: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    exchange: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    timezone: Option<String>,
}

#[derive(Serialize)]
struct SymbolsResponse {
    symbols: Vec<MarketSymbolDto>,
}

async fn handle_symbols(
    State(state): State<AppState>,
    Query(params): Query<SymbolsQuery>,
) -> Json<SymbolsResponse> {
    let filtered = state.instruments.iter().filter(|inst| {
        if let Some(ref ac) = params.asset_class {
            let class_str = match inst.asset_class {
                AssetClass::Crypto => "crypto",
                AssetClass::Fx => "fx",
                AssetClass::Metal => "metal",
                AssetClass::UsStocks | AssetClass::Equity | AssetClass::Etf => "us_stocks",
                AssetClass::IdxStocks => "idx_stocks",
            };

            if ac.eq_ignore_ascii_case("stocks") || ac.eq_ignore_ascii_case("equity") || ac.eq_ignore_ascii_case("equities") {
                class_str == "us_stocks" || class_str == "idx_stocks"
            } else if ac.eq_ignore_ascii_case("us") {
                class_str == "us_stocks"
            } else if ac.eq_ignore_ascii_case("id") || ac.eq_ignore_ascii_case("idx") {
                class_str == "idx_stocks"
            } else {
                class_str.eq_ignore_ascii_case(ac)
            }
        } else {
            true
        }
    });

    let symbols: Vec<MarketSymbolDto> = filtered
        .map(|inst| {
            let asset_class_str = match inst.asset_class {
                AssetClass::Crypto => "crypto",
                AssetClass::Fx => "fx",
                AssetClass::Metal => "metal",
                AssetClass::UsStocks | AssetClass::Equity | AssetClass::Etf => "us_stocks",
                AssetClass::IdxStocks => "idx_stocks",
            };
            let (name, exchange, country, timezone) = match inst.id.as_str() {
                "BTC-USDT" => ("Bitcoin", None, None, None),
                "ETH-USDT" => ("Ethereum", None, None, None),
                "SOL-USDT" => ("Solana", None, None, None),
                "BNB-USDT" => ("BNB", None, None, None),
                "XRP-USDT" => ("XRP", None, None, None),
                "PAXG-USDT" => ("Paxos Gold (Tokenized Gold)", None, None, None),
                "EUR-USD" => ("Euro / US Dollar", None, None, None),
                "GBP-USD" => ("British Pound / US Dollar", None, None, None),
                "USD-JPY" => ("US Dollar / Japanese Yen", None, None, None),
                "AUD-USD" => ("Australian Dollar / US Dollar", None, None, None),
                "USD-CAD" => ("US Dollar / Canadian Dollar", None, None, None),
                "USD-CHF" => ("US Dollar / Swiss Franc", None, None, None),
                "NZD-USD" => ("New Zealand Dollar / US Dollar", None, None, None),
                "EUR-JPY" => ("Euro / Japanese Yen", None, None, None),
                "GBP-JPY" => ("British Pound / Japanese Yen", None, None, None),
                "USD-IDR" => ("US Dollar / Indonesian Rupiah", None, None, None),
                "US:AAPL" => ("Apple Inc.", Some("NASDAQ"), Some("US"), Some("America/New_York")),
                "US:MSFT" => ("Microsoft Corp.", Some("NASDAQ"), Some("US"), Some("America/New_York")),
                "US:NVDA" => ("NVIDIA Corp.", Some("NASDAQ"), Some("US"), Some("America/New_York")),
                "US:TSLA" => ("Tesla Inc.", Some("NASDAQ"), Some("US"), Some("America/New_York")),
                "US:AMZN" => ("Amazon.com Inc.", Some("NASDAQ"), Some("US"), Some("America/New_York")),
                "US:META" => ("Meta Platforms Inc.", Some("NASDAQ"), Some("US"), Some("America/New_York")),
                "US:GOOGL" => ("Alphabet Inc.", Some("NASDAQ"), Some("US"), Some("America/New_York")),
                "US:AMD" => ("Advanced Micro Devices", Some("NASDAQ"), Some("US"), Some("America/New_York")),
                "US:SPY" => ("SPDR S&P 500 ETF Trust", Some("NYSE"), Some("US"), Some("America/New_York")),
                "US:QQQ" => ("Invesco QQQ Trust", Some("NASDAQ"), Some("US"), Some("America/New_York")),
                "ID:BBCA" => ("Bank Central Asia Tbk", Some("IDX"), Some("ID"), Some("Asia/Jakarta")),
                "ID:BBRI" => ("Bank Rakyat Indonesia Tbk", Some("IDX"), Some("ID"), Some("Asia/Jakarta")),
                "ID:BMRI" => ("Bank Mandiri Tbk", Some("IDX"), Some("ID"), Some("Asia/Jakarta")),
                "ID:BBNI" => ("Bank Negara Indonesia Tbk", Some("IDX"), Some("ID"), Some("Asia/Jakarta")),
                "ID:TLKM" => ("Telkom Indonesia Tbk", Some("IDX"), Some("ID"), Some("Asia/Jakarta")),
                "ID:ASII" => ("Astra International Tbk", Some("IDX"), Some("ID"), Some("Asia/Jakarta")),
                "ID:ANTM" => ("Aneka Tambang Tbk", Some("IDX"), Some("ID"), Some("Asia/Jakarta")),
                "ID:GOTO" => ("GoTo Gojek Tokopedia Tbk", Some("IDX"), Some("ID"), Some("Asia/Jakarta")),
                other => (other, None, None, None),
            };

            MarketSymbolDto {
                id: inst.id.to_string(),
                base: inst.base.clone(),
                quote: inst.quote.clone(),
                asset_class: asset_class_str.to_string(),
                provider: inst.provider.to_string(),
                provider_symbol: inst.provider_symbol.clone(),
                name: name.to_string(),
                enabled: inst.enabled,
                is_tokenized_metal: inst.is_tokenized_metal,
                pip_size: inst.pip_size.and_then(|p| p.to_f64()),
                display_decimals: inst.display_decimals,
                candle_price_basis: inst.candle_price_basis.clone(),
                exchange: exchange.map(|s| s.to_string()),
                country: country.map(|s| s.to_string()),
                timezone: timezone.map(|s| s.to_string()),
            }
        })
        .collect();

    Json(SymbolsResponse { symbols })
}

async fn handle_fx_symbols(State(state): State<AppState>) -> Json<SymbolsResponse> {
    handle_symbols(State(state), Query(SymbolsQuery { asset_class: Some("fx".into()) })).await
}

async fn handle_equity_symbols(State(state): State<AppState>) -> Json<SymbolsResponse> {
    handle_symbols(State(state), Query(SymbolsQuery { asset_class: Some("stocks".into()) })).await
}

#[derive(Deserialize, Default)]
struct MarketsQuery {
    #[serde(rename = "assetClass")]
    asset_class: Option<String>,
}

#[derive(Serialize, Clone)]
struct MarketTickerDto {
    symbol: String,
    price: f64,
    #[serde(rename = "open24h")]
    open_24h: f64,
    #[serde(rename = "high24h")]
    high_24h: f64,
    #[serde(rename = "low24h")]
    low_24h: f64,
    #[serde(rename = "volume24h")]
    volume_24h: f64,
    #[serde(rename = "quoteVolume24h")]
    quote_volume_24h: f64,
    #[serde(rename = "change24h")]
    change_24h: f64,
    #[serde(rename = "changePercent24h")]
    change_percent_24h: f64,
    timestamp: i64,
    provider: String,
    #[serde(rename = "assetClass")]
    asset_class: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    bid: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ask: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mid: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    spread: Option<f64>,
    #[serde(rename = "spreadPips", skip_serializing_if = "Option::is_none")]
    spread_pips: Option<f64>,
    #[serde(rename = "sessionState", skip_serializing_if = "Option::is_none")]
    session_state: Option<String>,
    #[serde(rename = "sessionSegment", skip_serializing_if = "Option::is_none")]
    session_segment: Option<String>,
    #[serde(rename = "dataQuality", skip_serializing_if = "Option::is_none")]
    data_quality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    market: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    currency: Option<String>,
    #[serde(rename = "previousClose", skip_serializing_if = "Option::is_none")]
    previous_close: Option<f64>,
}

#[derive(Serialize)]
struct MarketsResponse {
    markets: Vec<MarketTickerDto>,
    timestamp: i64,
}

async fn handle_markets(
    State(state): State<AppState>,
    Query(params): Query<MarketsQuery>,
) -> Json<MarketsResponse> {
    let tickers = state.latest_tickers.read().await;

    let filtered = state.instruments.iter().filter(|inst| {
        if let Some(ref ac) = params.asset_class {
            let class_str = match inst.asset_class {
                AssetClass::Crypto => "crypto",
                AssetClass::Fx => "fx",
                AssetClass::Metal => "metal",
                AssetClass::UsStocks | AssetClass::Equity | AssetClass::Etf => "us_stocks",
                AssetClass::IdxStocks => "idx_stocks",
            };

            if ac.eq_ignore_ascii_case("stocks") || ac.eq_ignore_ascii_case("equity") || ac.eq_ignore_ascii_case("equities") {
                class_str == "us_stocks" || class_str == "idx_stocks"
            } else if ac.eq_ignore_ascii_case("us") {
                class_str == "us_stocks"
            } else if ac.eq_ignore_ascii_case("id") || ac.eq_ignore_ascii_case("idx") {
                class_str == "idx_stocks"
            } else {
                class_str.eq_ignore_ascii_case(ac)
            }
        } else {
            true
        }
    });

    let items: Vec<MarketTickerDto> = filtered
        .map(|inst| {
            let asset_class_str = match inst.asset_class {
                AssetClass::Crypto => "crypto",
                AssetClass::Fx => "fx",
                AssetClass::Metal => "metal",
                AssetClass::UsStocks | AssetClass::Equity | AssetClass::Etf => "us_stocks",
                AssetClass::IdxStocks => "idx_stocks",
            };
            let pip_size_f64 = inst.pip_size.and_then(|p| p.to_f64()).unwrap_or(0.0001);

            if let Some(t) = tickers.get(&inst.id) {
                let spread_f64 = t.spread.and_then(|v| v.to_f64());
                let spread_pips = spread_f64.map(|s| (s / pip_size_f64 * 10.0).round() / 10.0);

                MarketTickerDto {
                    symbol: inst.id.to_string(),
                    price: t.price.to_f64().unwrap_or(0.0),
                    open_24h: t.open_24h.and_then(|v| v.to_f64()).unwrap_or(0.0),
                    high_24h: t.high_24h.and_then(|v| v.to_f64()).unwrap_or(0.0),
                    low_24h: t.low_24h.and_then(|v| v.to_f64()).unwrap_or(0.0),
                    volume_24h: t.volume_24h.and_then(|v| v.to_f64()).unwrap_or(0.0),
                    quote_volume_24h: t.quote_volume_24h.and_then(|v| v.to_f64()).unwrap_or(0.0),
                    change_24h: t.change_24h.and_then(|v| v.to_f64()).unwrap_or(0.0),
                    change_percent_24h: t.change_percent_24h.and_then(|v| v.to_f64()).unwrap_or(0.0),
                    timestamp: t.updated_at_ns / 1_000_000,
                    provider: t.provider.to_string(),
                    asset_class: asset_class_str.to_string(),
                    bid: t.bid.and_then(|v| v.to_f64()),
                    ask: t.ask.and_then(|v| v.to_f64()),
                    mid: t.mid.and_then(|v| v.to_f64()),
                    spread: spread_f64,
                    spread_pips,
                    session_state: t.session_state.clone().or_else(|| Some("open".into())),
                    session_segment: t.session_segment.clone(),
                    data_quality: t.data_quality.clone(),
                    market: t.market.clone(),
                    currency: t.currency.clone(),
                    previous_close: t.previous_close.and_then(|v| v.to_f64()),
                }
            } else {
                MarketTickerDto {
                    symbol: inst.id.to_string(),
                    price: 0.0,
                    open_24h: 0.0,
                    high_24h: 0.0,
                    low_24h: 0.0,
                    volume_24h: 0.0,
                    quote_volume_24h: 0.0,
                    change_24h: 0.0,
                    change_percent_24h: 0.0,
                    timestamp: Utc::now().timestamp_millis(),
                    provider: inst.provider.to_string(),
                    asset_class: asset_class_str.to_string(),
                    bid: None,
                    ask: None,
                    mid: None,
                    spread: None,
                    spread_pips: None,
                    session_state: Some("closed".into()),
                    session_segment: None,
                    data_quality: Some("last_known".into()),
                    market: None,
                    currency: None,
                    previous_close: None,
                }
            }
        })
        .collect();

    Json(MarketsResponse {
        markets: items,
        timestamp: Utc::now().timestamp_millis(),
    })
}

async fn handle_fx_markets(State(state): State<AppState>) -> Json<MarketsResponse> {
    handle_markets(State(state), Query(MarketsQuery { asset_class: Some("fx".into()) })).await
}

#[derive(Serialize)]
struct SessionResponse {
    market: String,
    state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    segment: Option<String>,
    #[serde(rename = "nextTransitionAt", skip_serializing_if = "Option::is_none")]
    next_transition_at: Option<i64>,
    timestamp: i64,
}

async fn handle_us_session() -> Json<SessionResponse> {
    let cal = UsMarketCalendar::new();
    let now = Utc::now();
    let state = cal.state_at(now);
    let segment = cal.session_segment(now);
    let next_transition = cal.next_transition(now).map(|dt| dt.timestamp_millis());
    let state_str = match state {
        MarketSessionState::Regular => "REGULAR",
        MarketSessionState::PreMarket => "PRE_MARKET",
        MarketSessionState::AfterHours => "AFTER_HOURS",
        MarketSessionState::Break => "BREAK",
        MarketSessionState::Holiday => "HOLIDAY",
        MarketSessionState::Closed => "CLOSED",
        _ => "CLOSED",
    };
    Json(SessionResponse {
        market: "US".to_string(),
        state: state_str.to_string(),
        segment,
        next_transition_at: next_transition,
        timestamp: now.timestamp_millis(),
    })
}

async fn handle_id_session() -> Json<SessionResponse> {
    let cal = IdxMarketCalendar::new();
    let now = Utc::now();
    let state = cal.state_at(now);
    let segment = cal.session_segment(now);
    let next_transition = cal.next_transition(now).map(|dt| dt.timestamp_millis());
    let state_str = match state {
        MarketSessionState::Regular => "REGULAR",
        MarketSessionState::PreMarket => "PRE_MARKET",
        MarketSessionState::AfterHours => "AFTER_HOURS",
        MarketSessionState::Break => "BREAK",
        MarketSessionState::Holiday => "HOLIDAY",
        MarketSessionState::Closed => "CLOSED",
        _ => "CLOSED",
    };
    Json(SessionResponse {
        market: "ID".to_string(),
        state: state_str.to_string(),
        segment,
        next_transition_at: next_transition,
        timestamp: now.timestamp_millis(),
    })
}

#[derive(Deserialize)]
struct CandlesQuery {
    instrument: Option<String>,
    interval: Option<String>,
    timeframe: Option<String>,
    limit: Option<u32>,
}

#[derive(Serialize, Clone)]
struct CandleDto {
    symbol: String,
    timeframe: String,
    #[serde(rename = "openTime")]
    open_time: i64,
    #[serde(rename = "closeTime")]
    close_time: i64,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    volume: f64,
    trades: u64,
    finalized: bool,
    provider: String,
    #[serde(rename = "priceBasis", skip_serializing_if = "Option::is_none")]
    price_basis: Option<String>,
    #[serde(rename = "spreadClose", skip_serializing_if = "Option::is_none")]
    spread_close: Option<f64>,
}

#[derive(Serialize)]
struct CandlesResponse {
    symbol: String,
    timeframe: String,
    candles: Vec<CandleDto>,
}

async fn handle_candles_path(
    Path(instrument): Path<String>,
    State(state): State<AppState>,
    Query(mut params): Query<CandlesQuery>,
) -> impl IntoResponse {
    params.instrument = Some(instrument);
    handle_candles(State(state), Query(params)).await
}

async fn warmup_external_candles(
    client: &reqwest::Client,
    inst: &Instrument,
    interval_str: &str,
    limit: u32,
) -> Vec<CandleDto> {
    let (yf_interval, yf_range) = match interval_str {
        "1s" | "1m" => ("1m", if limit > 300 { "5d" } else { "1d" }),
        "5m" => ("5m", "5d"),
        "15m" => ("15m", "5d"),
        "30m" => ("30m", "1mo"),
        "1h" => ("60m", "1mo"),
        "4h" => ("60m", "3mo"),
        "1d" => ("1d", "1y"),
        "1w" => ("1wk", "5y"),
        _ => ("1m", "1d"),
    };

    let url = format!(
        "https://query1.finance.yahoo.com/v8/finance/chart/{}?interval={}&range={}",
        inst.provider_symbol, yf_interval, yf_range
    );

    let mut candles = Vec::new();
    if let Ok(res) = client.get(&url).send().await {
        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(result) = json.pointer("/chart/result/0") {
                    let timestamps = result.get("timestamp").and_then(|t| t.as_array());
                    let quote = result.pointer("/indicators/quote/0");
                    let opens = quote.and_then(|q| q.get("open")).and_then(|v| v.as_array());
                    let highs = quote.and_then(|q| q.get("high")).and_then(|v| v.as_array());
                    let lows = quote.and_then(|q| q.get("low")).and_then(|v| v.as_array());
                    let closes = quote.and_then(|q| q.get("close")).and_then(|v| v.as_array());
                    let volumes = quote.and_then(|q| q.get("volume")).and_then(|v| v.as_array());

                    if let (Some(ts_arr), Some(o_arr), Some(h_arr), Some(l_arr), Some(c_arr)) =
                        (timestamps, opens, highs, lows, closes)
                    {
                        let len = ts_arr.len().min(o_arr.len()).min(h_arr.len()).min(l_arr.len()).min(c_arr.len());
                        let is_fx = inst.asset_class == AssetClass::Fx;
                        let pip_size = inst.pip_size.and_then(|p| p.to_f64()).unwrap_or(0.0001);
                        let spread_val = if is_fx { Some(pip_size * 0.8) } else { None };
                        let price_basis = if is_fx { Some("mid".into()) } else { Some("trade".into()) };

                        for i in 0..len {
                            if let (Some(ts), Some(open), Some(high), Some(low), Some(close)) = (
                                ts_arr[i].as_i64(),
                                o_arr[i].as_f64(),
                                h_arr[i].as_f64(),
                                l_arr[i].as_f64(),
                                c_arr[i].as_f64(),
                            ) {
                                let vol = volumes
                                    .and_then(|v| v.get(i))
                                    .and_then(|v| v.as_f64())
                                    .unwrap_or(1.0);
                                let open_time = ts * 1000;
                                let dur_ms = match interval_str {
                                    "1m" => 60_000,
                                    "5m" => 300_000,
                                    "15m" => 900_000,
                                    "30m" => 1_800_000,
                                    "1h" => 3_600_000,
                                    "4h" => 14_400_000,
                                    "1d" => 86_400_000,
                                    "1w" => 604_800_000,
                                    _ => 60_000,
                                };
                                let close_time = open_time + dur_ms - 1;

                                candles.push(CandleDto {
                                    symbol: inst.id.to_string(),
                                    timeframe: interval_str.to_string(),
                                    open_time,
                                    close_time,
                                    open,
                                    high,
                                    low,
                                    close,
                                    volume: vol,
                                    trades: 1,
                                    finalized: true,
                                    provider: inst.provider.to_string(),
                                    price_basis: price_basis.clone(),
                                    spread_close: spread_val,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    if candles.len() > limit as usize {
        let skip = candles.len() - limit as usize;
        candles = candles.split_off(skip);
    }

    candles
}

async fn handle_candles(
    State(state): State<AppState>,
    Query(params): Query<CandlesQuery>,
) -> impl IntoResponse {
    let instrument = params.instrument.unwrap_or_else(|| "BTC-USDT".to_string());
    let mut interval_str = params
        .interval
        .or(params.timeframe)
        .unwrap_or_else(|| "1s".to_string());
    let limit = params.limit.unwrap_or(300).min(1000);

    let matching_inst = state.instruments.iter().find(|i| i.id.as_str() == instrument);
    let is_fx = matching_inst.map(|i| i.asset_class == AssetClass::Fx).unwrap_or(false);
    let is_equity = matching_inst.map(|i| {
        matches!(
            i.asset_class,
            AssetClass::UsStocks | AssetClass::IdxStocks | AssetClass::Equity | AssetClass::Etf
        ) || i.id.as_str().starts_with("US:")
            || i.id.as_str().starts_with("ID:")
    }).unwrap_or(false);

    // Forex and Equities base timeframe is 1m (no 1s needed per user preference & spec)
    if (is_fx || is_equity) && interval_str == "1s" {
        interval_str = "1m".to_string();
    }

    let table = match interval_str.as_str() {
        "1s" => "candles_1s",
        "5s" => "candles_5s",
        "15s" => "candles_15s",
        "30s" => "candles_30s",
        "1m" => "candles_1m",
        "5m" => "candles_5m",
        "15m" => "candles_15m",
        "30m" => "candles_30m",
        "1h" => "candles_1h",
        "4h" => "candles_4h",
        "1d" => "candles_1d",
        "1w" => "candles_1w",
        _ => "candles_1m",
    };

    // Query QuestDB HTTP SQL endpoint:
    let sql = format!(
        "SELECT cast(timestamp as long) * 1000, open, high, low, close, volume, trade_count FROM {} WHERE instrument = '{}' ORDER BY timestamp DESC LIMIT {}",
        table, instrument, limit
    );

    let mut dtos = Vec::new();

    let qdb_url = format!("{}/exec", state.config.questdb_http_url);
    if let Ok(res) = state.http_client.get(&qdb_url).query(&[("query", &sql)]).send().await {
        if res.status().is_success() {
            if let Ok(json_body) = res.json::<serde_json::Value>().await {
                if let Some(dataset) = json_body.get("dataset").and_then(|v| v.as_array()) {
                    for row in dataset {
                        if let Some(cols) = row.as_array() {
                            if cols.len() >= 6 {
                                let time_ns = cols[0].as_i64().unwrap_or(0);
                                let open = cols[1].as_f64().unwrap_or(0.0);
                                let high = cols[2].as_f64().unwrap_or(0.0);
                                let low = cols[3].as_f64().unwrap_or(0.0);
                                let close = cols[4].as_f64().unwrap_or(0.0);
                                let volume = cols[5].as_f64().unwrap_or(0.0);
                                let trades = cols.get(6).and_then(|v| v.as_u64()).unwrap_or(1);

                                dtos.push(CandleDto {
                                    symbol: instrument.clone(),
                                    timeframe: interval_str.clone(),
                                    open_time: time_ns / 1_000_000,
                                    close_time: (time_ns + 1_000_000_000 - 1) / 1_000_000,
                                    open,
                                    high,
                                    low,
                                    close,
                                    volume,
                                    trades,
                                    finalized: true,
                                    provider: matching_inst.map(|i| i.provider.as_str()).unwrap_or("binance").to_string(),
                                    price_basis: if is_fx { Some("mid".into()) } else { Some("trade".into()) },
                                    spread_close: None,
                                });
                            }
                        }
                    }
                    dtos.reverse();
                }
            }
        }
    }

    // Warmup backfill:
    if is_fx || is_equity {
        if dtos.len() < 30 {
            if let Some(inst) = matching_inst {
                let warmup = warmup_external_candles(&state.http_client, inst, &interval_str, limit).await;
                if !warmup.is_empty() {
                    dtos = warmup;
                }
            }
        }
    } else {
        // Crypto warmup from Binance Vision klines
        if dtos.len() < 30 {
            let binance_symbol = instrument.replace('-', "");
            let binance_interval = match interval_str.as_str() {
                "1s" => "1s",
                "5s" => "1s",
                "15s" => "1s",
                "30s" => "1s",
                "1m" => "1m",
                "5m" => "5m",
                "15m" => "15m",
                "30m" => "30m",
                "1h" => "1h",
                "4h" => "4h",
                "1d" => "1d",
                "1w" => "1w",
                _ => "1m",
            };
            let warmup_limit = limit.clamp(100, 300);
            let url = format!(
                "https://data-api.binance.vision/api/v3/klines?symbol={}&interval={}&limit={}",
                binance_symbol, binance_interval, warmup_limit
            );
            if let Ok(res) = state.http_client.get(&url).send().await {
                if res.status().is_success() {
                    if let Ok(kline_array) = res.json::<Vec<serde_json::Value>>().await {
                        let mut backfill = Vec::new();
                        for kline in kline_array {
                            if let Some(arr) = kline.as_array() {
                                if arr.len() >= 9 {
                                    let open_time = arr[0].as_i64().unwrap_or(0);
                                    let open: f64 = arr[1].as_str().and_then(|s| s.parse().ok()).unwrap_or(0.0);
                                    let high: f64 = arr[2].as_str().and_then(|s| s.parse().ok()).unwrap_or(0.0);
                                    let low: f64 = arr[3].as_str().and_then(|s| s.parse().ok()).unwrap_or(0.0);
                                    let close: f64 = arr[4].as_str().and_then(|s| s.parse().ok()).unwrap_or(0.0);
                                    let volume: f64 = arr[5].as_str().and_then(|s| s.parse().ok()).unwrap_or(0.0);
                                    let close_time = arr[6].as_i64().unwrap_or(open_time + 59_999);
                                    let trades = arr[8].as_u64().unwrap_or(1);

                                    backfill.push(CandleDto {
                                        symbol: instrument.clone(),
                                        timeframe: interval_str.clone(),
                                        open_time,
                                        close_time,
                                        open,
                                        high,
                                        low,
                                        close,
                                        volume,
                                        trades,
                                        finalized: true,
                                        provider: "binance".to_string(),
                                        price_basis: Some("trade".into()),
                                        spread_close: None,
                                    });
                                }
                            }
                        }
                        if !backfill.is_empty() {
                            if dtos.is_empty() {
                                dtos = backfill;
                            } else {
                                let existing_times: HashSet<i64> = dtos.iter().map(|d| d.open_time).collect();
                                for b in backfill {
                                    if !existing_times.contains(&b.open_time) {
                                        dtos.push(b);
                                    }
                                }
                                dtos.sort_by_key(|d| d.open_time);
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback: If still empty, inject latest in-memory candle if available
    if dtos.is_empty() {
        let key = format!("{}:{}", interval_str, instrument);
        let candles_lock = state.latest_candles.read().await;
        if let Some(c) = candles_lock.get(&key) {
            dtos.push(CandleDto {
                symbol: instrument.clone(),
                timeframe: interval_str.clone(),
                open_time: c.open_time_ns / 1_000_000,
                close_time: c.close_time_ns / 1_000_000,
                open: c.open.to_f64().unwrap_or(0.0),
                high: c.high.to_f64().unwrap_or(0.0),
                low: c.low.to_f64().unwrap_or(0.0),
                close: c.close.to_f64().unwrap_or(0.0),
                volume: c.volume.to_f64().unwrap_or(0.0),
                trades: c.trade_count,
                finalized: c.finalized,
                provider: c.provider.to_string(),
                price_basis: if is_fx { Some("mid".into()) } else { Some("trade".into()) },
                spread_close: None,
            });
        }
    }

    (
        StatusCode::OK,
        Json(CandlesResponse {
            symbol: instrument,
            timeframe: interval_str,
            candles: dtos,
        }),
    )
}

// News & Sentiment Structs & Handlers

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsArticle {
    pub id: String,
    pub title: String,
    pub link: String,
    #[serde(rename = "publishedAt")]
    pub published_at: String,
    pub source: String,
    pub sentiment: String, // "BULLISH" | "BEARISH" | "NEUTRAL"
    pub impact: String,    // "HIGH" | "MEDIUM" | "LOW"
    pub symbols: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentData {
    pub value: u8,
    pub classification: String,
    pub timestamp: String,
}

impl Default for SentimentData {
    fn default() -> Self {
        Self {
            value: 75,
            classification: "Greed".to_string(),
            timestamp: "0".to_string(),
        }
    }
}

fn extract_xml_tag<'a>(item: &'a str, tag: &str) -> Option<&'a str> {
    let open_tag = format!("<{}>", tag);
    let close_tag = format!("</{}>", tag);
    let start = item.find(&open_tag)? + open_tag.len();
    let end = item[start..].find(&close_tag)? + start;
    let mut val = &item[start..end];
    if val.starts_with("<![CDATA[") && val.ends_with("]]>") {
        val = &val[9..val.len() - 3];
    }
    Some(val.trim())
}

fn analyze_headline(title: &str) -> (&'static str, &'static str, Vec<String>) {
    let lower = title.to_lowercase();

    let mut symbols = Vec::new();
    if lower.contains("bitcoin") || lower.contains("btc") {
        symbols.push("BTC".to_string());
    }
    if lower.contains("ethereum") || lower.contains("eth") {
        symbols.push("ETH".to_string());
    }
    if lower.contains("solana") || lower.contains("sol") {
        symbols.push("SOL".to_string());
    }
    if lower.contains("gold") || lower.contains("paxg") {
        symbols.push("GOLD".to_string());
    }
    if lower.contains("xrp") || lower.contains("ripple") {
        symbols.push("XRP".to_string());
    }
    if lower.contains("bnb") || lower.contains("binance") {
        symbols.push("BNB".to_string());
    }
    if lower.contains("fed")
        || lower.contains("inflation")
        || lower.contains("cpi")
        || lower.contains("rate")
        || lower.contains("oil")
        || lower.contains("macro")
        || lower.contains("dollar")
        || lower.contains("forex")
    {
        symbols.push("MACRO".to_string());
    }
    if symbols.is_empty() {
        symbols.push("CRYPTO".to_string());
    }

    let bullish_words = [
        "etf", "etp", "rally", "surges", "surge", "gain", "gains", "soar", "soars",
        "approval", "support", "record", "bull", "ath", "inflow", "inflows", "highs",
    ];
    let bearish_words = [
        "crash", "crashes", "plunge", "plunges", "fall", "falls", "drop", "drops",
        "ban", "hack", "hacked", "lawsuit", "dump", "dips", "dip", "liquidat", "bear",
        "outflow", "outflows",
    ];
    let high_impact_words = [
        "etf", "sec", "fed", "inflation", "cpi", "war", "tariff", "rate cut", "rate hike",
        "ban", "hack", "billion", "trump", "treasury", "central bank",
    ];

    let is_bullish = bullish_words.iter().any(|w| lower.contains(w));
    let is_bearish = bearish_words.iter().any(|w| lower.contains(w));
    let is_high_impact = high_impact_words.iter().any(|w| lower.contains(w));

    let sentiment = if is_bullish && !is_bearish {
        "BULLISH"
    } else if is_bearish && !is_bullish {
        "BEARISH"
    } else {
        "NEUTRAL"
    };

    let impact = if is_high_impact {
        "HIGH"
    } else {
        "MEDIUM"
    };

    (sentiment, impact, symbols)
}

async fn handle_news(State(state): State<AppState>) -> Json<Vec<NewsArticle>> {
    // Check in-memory cache (TTL 3 minutes)
    {
        let lock = state.cached_news.read().await;
        if let (Some(instant), ref list) = *lock {
            if instant.elapsed() < Duration::from_secs(180) && !list.is_empty() {
                return Json(list.clone());
            }
        }
    }

    let mut articles = Vec::new();

    // 1. Fetch from CoinTelegraph RSS
    if let Ok(res) = state.http_client.get("https://cointelegraph.com/rss").send().await {
        if res.status().is_success() {
            if let Ok(xml) = res.text().await {
                for (idx, item_block) in xml.split("<item>").skip(1).take(20).enumerate() {
                    let title = extract_xml_tag(item_block, "title").unwrap_or("");
                    let link = extract_xml_tag(item_block, "link").unwrap_or("");
                    let pub_date = extract_xml_tag(item_block, "pubDate").unwrap_or("");

                    if !title.is_empty() && !link.is_empty() {
                        let (sentiment, impact, symbols) = analyze_headline(title);
                        articles.push(NewsArticle {
                            id: format!("ct-{}", idx),
                            title: title.to_string(),
                            link: link.to_string(),
                            published_at: pub_date.to_string(),
                            source: "CoinTelegraph".to_string(),
                            sentiment: sentiment.to_string(),
                            impact: impact.to_string(),
                            symbols,
                        });
                    }
                }
            }
        }
    }

    // 2. Supplement from Decrypt if needed
    if articles.len() < 5 {
        if let Ok(res) = state.http_client.get("https://decrypt.co/feed").send().await {
            if res.status().is_success() {
                if let Ok(xml) = res.text().await {
                    for (idx, item_block) in xml.split("<item>").skip(1).take(10).enumerate() {
                        let title = extract_xml_tag(item_block, "title").unwrap_or("");
                        let link = extract_xml_tag(item_block, "link").unwrap_or("");
                        let pub_date = extract_xml_tag(item_block, "pubDate").unwrap_or("");

                        if !title.is_empty() && !link.is_empty() {
                            let (sentiment, impact, symbols) = analyze_headline(title);
                            articles.push(NewsArticle {
                                id: format!("dc-{}", idx),
                                title: title.to_string(),
                                link: link.to_string(),
                                published_at: pub_date.to_string(),
                                source: "Decrypt".to_string(),
                                sentiment: sentiment.to_string(),
                                impact: impact.to_string(),
                                symbols,
                            });
                        }
                    }
                }
            }
        }
    }

    if !articles.is_empty() {
        let mut lock = state.cached_news.write().await;
        *lock = (Some(tokio::time::Instant::now()), articles.clone());
    }

    Json(articles)
}

async fn handle_sentiment(State(state): State<AppState>) -> Json<SentimentData> {
    // Check in-memory cache (TTL 10 minutes)
    {
        let lock = state.cached_sentiment.read().await;
        if let (Some(instant), ref data) = *lock {
            if instant.elapsed() < Duration::from_secs(600) {
                return Json(data.clone());
            }
        }
    }

    let mut sentiment = SentimentData::default();

    if let Ok(res) = state
        .http_client
        .get("https://api.alternative.me/fng/?limit=1")
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(val) = res.json::<serde_json::Value>().await {
                if let Some(arr) = val.get("data").and_then(|d| d.as_array()) {
                    if let Some(first) = arr.first() {
                        let value: u8 = first
                            .get("value")
                            .and_then(|v| v.as_str())
                            .and_then(|s| s.parse().ok())
                            .unwrap_or(75);
                        let classification = first
                            .get("value_classification")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Greed")
                            .to_string();
                        let timestamp = first
                            .get("timestamp")
                            .and_then(|v| v.as_str())
                            .unwrap_or("0")
                            .to_string();

                        sentiment = SentimentData {
                            value,
                            classification,
                            timestamp,
                        };
                    }
                }
            }
        }
    }

    {
        let mut lock = state.cached_sentiment.write().await;
        *lock = (Some(tokio::time::Instant::now()), sentiment.clone());
    }

    Json(sentiment)
}

// WebSocket Upgrade Handler

async fn handle_ws_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_ws_session(socket, state))
}

async fn handle_ws_session(socket: WebSocket, state: AppState) {
    ACTIVE_WS_CLIENTS.fetch_add(1, Ordering::Relaxed);
    let (mut sender, mut receiver) = socket.split();
    let mut broadcast_rx = state.broadcast_tx.subscribe();
    let mut subscribed_channels: HashSet<String> = HashSet::new();

    info!(
        active_clients = ACTIVE_WS_CLIENTS.load(Ordering::Relaxed),
        "New WebSocket client connected to /v1/stream"
    );

    loop {
        tokio::select! {
            // Inbound messages from browser client
            client_msg = receiver.next() => {
                match client_msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(cmd) = serde_json::from_str::<ClientWsCommand>(&text) {
                            match cmd {
                                ClientWsCommand::Subscribe { channels } => {
                                    for ch in &channels {
                                        subscribed_channels.insert(ch.clone());
                                    }
                                    let resp = ServerWsEvent::Subscribed { channels: channels.clone() };
                                    if let Ok(json) = serde_json::to_string(&resp) {
                                        let _ = sender.send(Message::Text(json.into())).await;
                                    }

                                    // Immediately send snapshot of matching items
                                    for ch in &channels {
                                        if ch.starts_with("ticker:") {
                                            let sym = ch.trim_start_matches("ticker:");
                                            let tickers = state.latest_tickers.read().await;
                                            if sym == "*" {
                                                for t in tickers.values() {
                                                    let evt = ServerWsEvent::Ticker { ticker: t.clone() };
                                                    if let Ok(json) = serde_json::to_string(&evt) {
                                                        let _ = sender.send(Message::Text(json.into())).await;
                                                    }
                                                }
                                            } else {
                                                let target = InstrumentId::new(sym);
                                                if let Some(t) = tickers.get(&target) {
                                                    let evt = ServerWsEvent::Ticker { ticker: t.clone() };
                                                    if let Ok(json) = serde_json::to_string(&evt) {
                                                        let _ = sender.send(Message::Text(json.into())).await;
                                                    }
                                                }
                                            }
                                        } else if ch.starts_with("candle:") {
                                            let parts: Vec<&str> = ch.split(':').collect();
                                            if parts.len() == 3 {
                                                let (interval, sym) = if parts[1].ends_with('s') || parts[1].ends_with('m') || parts[1].ends_with('h') || parts[1].ends_with('d') || parts[1].ends_with('w') {
                                                    (parts[1], parts[2])
                                                } else {
                                                    (parts[2], parts[1])
                                                };
                                                let key = format!("{}:{}", interval, sym);
                                                let candles = state.latest_candles.read().await;
                                                if let Some(c) = candles.get(&key) {
                                                    let evt = ServerWsEvent::Candle { candle: c.clone() };
                                                    if let Ok(json) = serde_json::to_string(&evt) {
                                                        let _ = sender.send(Message::Text(json.into())).await;
                                                    }
                                                }
                                            }
                                        } else if ch.starts_with("session") || ch.starts_with("equity:session") {
                                            let now = Utc::now();
                                            let us_cal = UsMarketCalendar::new();
                                            let id_cal = IdxMarketCalendar::new();

                                            let us_state = us_cal.state_at(now);
                                            let us_state_str = match us_state {
                                                MarketSessionState::Regular => "REGULAR",
                                                MarketSessionState::PreMarket => "PRE_MARKET",
                                                MarketSessionState::AfterHours => "AFTER_HOURS",
                                                MarketSessionState::Break => "BREAK",
                                                MarketSessionState::Holiday => "HOLIDAY",
                                                MarketSessionState::Closed => "CLOSED",
                                                _ => "CLOSED",
                                            };
                                            let us_evt = ServerWsEvent::Session {
                                                session: SessionStateUpdate {
                                                    market: "US".to_string(),
                                                    state: us_state_str.to_string(),
                                                    segment: us_cal.session_segment(now),
                                                    next_transition_at: us_cal.next_transition(now).map(|dt| dt.timestamp_millis()),
                                                    ts: now.timestamp_millis(),
                                                },
                                            };
                                            if let Ok(json) = serde_json::to_string(&us_evt) {
                                                let _ = sender.send(Message::Text(json.into())).await;
                                            }

                                            let id_state = id_cal.state_at(now);
                                            let id_state_str = match id_state {
                                                MarketSessionState::Regular => "REGULAR",
                                                MarketSessionState::PreMarket => "PRE_MARKET",
                                                MarketSessionState::AfterHours => "AFTER_HOURS",
                                                MarketSessionState::Break => "BREAK",
                                                MarketSessionState::Holiday => "HOLIDAY",
                                                MarketSessionState::Closed => "CLOSED",
                                                _ => "CLOSED",
                                            };
                                            let id_evt = ServerWsEvent::Session {
                                                session: SessionStateUpdate {
                                                    market: "ID".to_string(),
                                                    state: id_state_str.to_string(),
                                                    segment: id_cal.session_segment(now),
                                                    next_transition_at: id_cal.next_transition(now).map(|dt| dt.timestamp_millis()),
                                                    ts: now.timestamp_millis(),
                                                },
                                            };
                                            if let Ok(json) = serde_json::to_string(&id_evt) {
                                                let _ = sender.send(Message::Text(json.into())).await;
                                            }
                                        }
                                    }
                                }
                                ClientWsCommand::Unsubscribe { channels } => {
                                    for ch in &channels {
                                        subscribed_channels.remove(ch);
                                    }
                                    let resp = ServerWsEvent::Unsubscribed { channels };
                                    if let Ok(json) = serde_json::to_string(&resp) {
                                        let _ = sender.send(Message::Text(json.into())).await;
                                    }
                                }
                                ClientWsCommand::Ping => {
                                    let now_ns = Utc::now().timestamp_nanos_opt().unwrap_or(0);
                                    let resp = ServerWsEvent::Pong { ts: now_ns / 1_000_000 };
                                    if let Ok(json) = serde_json::to_string(&resp) {
                                        let _ = sender.send(Message::Text(json.into())).await;
                                    }
                                }
                            }
                        }
                    }
                    Some(Ok(Message::Ping(bytes))) => {
                        let _ = sender.send(Message::Pong(bytes)).await;
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        break;
                    }
                    _ => {}
                }
            }

            // Outbound event from NATS or internal broadcast
            broadcast_event = broadcast_rx.recv() => {
                match broadcast_event {
                    Ok(event) => {
                        let is_match = match &event {
                            ServerWsEvent::Ticker { ticker } => {
                                let ch1 = format!("ticker:{}", ticker.instrument.as_str());
                                let ch2 = "ticker:*".to_string();
                                subscribed_channels.contains(&ch1) || subscribed_channels.contains(&ch2)
                            }
                            ServerWsEvent::FxQuote { quote } => {
                                let ch1 = format!("ticker:{}", quote.instrument.as_str());
                                let ch2 = "ticker:*".to_string();
                                let ch3 = format!("quote:{}", quote.instrument.as_str());
                                let ch4 = "quote:*".to_string();
                                subscribed_channels.contains(&ch1) || subscribed_channels.contains(&ch2) || subscribed_channels.contains(&ch3) || subscribed_channels.contains(&ch4)
                            }
                            ServerWsEvent::Candle { candle } => {
                                let ch1 = format!("candle:{}:{}", candle.interval.as_str(), candle.instrument.as_str());
                                let ch2 = format!("candle:{}:{}", candle.instrument.as_str(), candle.interval.as_str());
                                let ch3 = format!("candle:{}:*", candle.interval.as_str());
                                let ch4 = "candle:*".to_string();
                                subscribed_channels.contains(&ch1) || subscribed_channels.contains(&ch2) || subscribed_channels.contains(&ch3) || subscribed_channels.contains(&ch4)
                            }
                            ServerWsEvent::Status { status } => {
                                let ch1 = format!("status:{}", status.provider.as_str());
                                let ch2 = "status:*".to_string();
                                subscribed_channels.contains(&ch1) || subscribed_channels.contains(&ch2)
                            }
                            ServerWsEvent::Session { session } => {
                                let ch1 = format!("session:{}", session.market.to_lowercase());
                                let ch2 = "session:*".to_string();
                                let ch3 = format!("equity:session:{}", session.market.to_uppercase());
                                subscribed_channels.contains(&ch1)
                                    || subscribed_channels.contains(&ch2)
                                    || subscribed_channels.contains(&ch3)
                                    || subscribed_channels.contains("session")
                                    || subscribed_channels.contains("equity:session:*")
                            }
                            _ => false,
                        };

                        if is_match {
                            if let Ok(json) = serde_json::to_string(&event) {
                                if let Err(e) = sender.send(Message::Text(json.into())).await {
                                    debug!(error = %e, "Failed to send event to WS client; closing connection");
                                    break;
                                }
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(skipped)) => {
                        warn!(skipped = skipped, "Slow WebSocket client lagged behind broadcast channel");
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        break;
                    }
                }
            }
        }
    }

    ACTIVE_WS_CLIENTS.fetch_sub(1, Ordering::Relaxed);
    info!(
        active_clients = ACTIVE_WS_CLIENTS.load(Ordering::Relaxed),
        "WebSocket client disconnected"
    );
}
