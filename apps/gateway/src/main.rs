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
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, RwLock};
use tokio::time::sleep;
use tower_http::cors::CorsLayer;
use tracing::{debug, info, warn, Level};
use tracing_subscriber::FmtSubscriber;

use market_config::AppConfig;
use market_domain::{Candle, Instrument, InstrumentId, ProviderId, TickerState};
use market_protocol::{
    ClientWsCommand, MarketMessage, NatsSubjects, ProviderStatusEvent, ServerWsEvent,
};

static ACTIVE_WS_CLIENTS: AtomicU64 = AtomicU64::new(0);

#[derive(Clone)]
struct AppState {
    config: AppConfig,
    instruments: Vec<Instrument>,
    latest_tickers: Arc<RwLock<HashMap<InstrumentId, TickerState>>>,
    latest_candles: Arc<RwLock<HashMap<String, Candle>>>, // key: "1s:BTC-USDT"
    provider_status: Arc<RwLock<HashMap<ProviderId, ProviderStatusEvent>>>,
    broadcast_tx: broadcast::Sender<ServerWsEvent>,
    http_client: reqwest::Client,
}

#[tokio::main]
async fn main() -> Result<()> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    let cfg = AppConfig::load().context("Failed to load application config")?;
    let all_instruments = Instrument::default_universe();
    let universe_symbols: Vec<InstrumentId> = cfg.universe.iter().map(|s| InstrumentId::new(s.clone())).collect();
    let active_instruments: Vec<Instrument> = all_instruments
        .into_iter()
        .filter(|inst| universe_symbols.contains(&inst.id))
        .collect();

    let (broadcast_tx, _) = broadcast::channel(10_000);

    let state = AppState {
        config: cfg.clone(),
        instruments: active_instruments,
        latest_tickers: Arc::new(RwLock::new(HashMap::new())),
        latest_candles: Arc::new(RwLock::new(HashMap::new())),
        provider_status: Arc::new(RwLock::new(HashMap::new())),
        broadcast_tx,
        http_client: reqwest::Client::builder()
            .timeout(Duration::from_secs(3))
            .build()?,
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

    // Axum Router with CORS
    let app = Router::new()
        .route("/v1/health", get(handle_health))
        .route("/v1/symbols", get(handle_symbols))
        .route("/v1/markets", get(handle_markets))
        .route("/v1/candles", get(handle_candles))
        .route("/v1/candles/{instrument}", get(handle_candles_path))
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

        info!("Gateway active on NATS topics (tickers, candles, statuses)");

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
}

#[derive(Serialize)]
struct SymbolsResponse {
    symbols: Vec<MarketSymbolDto>,
}

async fn handle_symbols(State(state): State<AppState>) -> Json<SymbolsResponse> {
    let symbols: Vec<MarketSymbolDto> = state
        .instruments
        .iter()
        .map(|inst| {
            let asset_class_str = match inst.asset_class {
                market_domain::AssetClass::Crypto => "crypto",
                market_domain::AssetClass::Fx => "fx",
                market_domain::AssetClass::Metal => "metal",
            };
            let name = match inst.id.as_str() {
                "BTC-USDT" => "Bitcoin",
                "ETH-USDT" => "Ethereum",
                "SOL-USDT" => "Solana",
                "BNB-USDT" => "BNB",
                "XRP-USDT" => "XRP",
                "PAXG-USDT" => "Paxos Gold (Tokenized Gold)",
                other => other,
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
            }
        })
        .collect();

    Json(SymbolsResponse { symbols })
}

#[derive(Serialize)]
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
}

#[derive(Serialize)]
struct MarketsResponse {
    markets: Vec<MarketTickerDto>,
    timestamp: i64,
}

async fn handle_markets(State(state): State<AppState>) -> Json<MarketsResponse> {
    let tickers = state.latest_tickers.read().await;

    let items: Vec<MarketTickerDto> = state
        .instruments
        .iter()
        .map(|inst| {
            if let Some(t) = tickers.get(&inst.id) {
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
                }
            }
        })
        .collect();

    Json(MarketsResponse {
        markets: items,
        timestamp: Utc::now().timestamp_millis(),
    })
}

#[derive(Deserialize)]
struct CandlesQuery {
    instrument: Option<String>,
    interval: Option<String>,
    timeframe: Option<String>,
    limit: Option<u32>,
}

#[derive(Serialize)]
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

async fn handle_candles(
    State(state): State<AppState>,
    Query(params): Query<CandlesQuery>,
) -> impl IntoResponse {
    let instrument = params.instrument.unwrap_or_else(|| "BTC-USDT".to_string());
    let interval_str = params
        .interval
        .or(params.timeframe)
        .unwrap_or_else(|| "1s".to_string());
    let limit = params.limit.unwrap_or(300).min(1000);

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
        _ => "candles_1s",
    };

    // Query QuestDB HTTP SQL endpoint:
    // Format: http://127.0.0.1:9000/exec?query=SELECT ...
    let sql = format!(
        "SELECT open_time_ns, open, high, low, close, volume, trade_count FROM {} WHERE instrument = '{}' ORDER BY open_time_ns DESC LIMIT {}",
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
                                    provider: "binance".to_string(),
                                });
                            }
                        }
                    }
                    dtos.reverse();
                }
            }
        }
    }

    // Fallback: If QuestDB is empty or starting up, inject latest in-memory candle if available
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

            // Outbound event from NATS broadcast
            broadcast_event = broadcast_rx.recv() => {
                match broadcast_event {
                    Ok(event) => {
                        let is_match = match &event {
                            ServerWsEvent::Ticker { ticker } => {
                                let ch1 = format!("ticker:{}", ticker.instrument.as_str());
                                let ch2 = "ticker:*".to_string();
                                subscribed_channels.contains(&ch1) || subscribed_channels.contains(&ch2)
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
