mod binance;

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use tokio::time::{interval, sleep};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::protocol::Message;
use tracing::{debug, error, info, warn, Level};
use tracing_subscriber::FmtSubscriber;

use binance::{BinanceNormalizer, NormalizedPayload};
use market_config::AppConfig;
use market_domain::{Instrument, InstrumentId, ProviderId};
use market_protocol::{MarketMessage, NatsSubjects, ProviderStatusEvent};

static RECONNECT_COUNT: AtomicU64 = AtomicU64::new(0);
static TRADES_INGESTED: AtomicU64 = AtomicU64::new(0);
static TICKERS_INGESTED: AtomicU64 = AtomicU64::new(0);

#[tokio::main]
async fn main() -> Result<()> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    let cfg = AppConfig::load().context("Failed to load application config")?;
    let provider = ProviderId::new("binance");

    info!("===============================================");
    info!("Starting Rust Binance Market Collector Daemon");
    info!(nats_url = %cfg.nats_url, "NATS event bus endpoint");
    info!(binance_ws = %cfg.binance_ws_url, "Binance WebSocket gateway");
    info!("===============================================");

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
        let universe_symbols: Vec<InstrumentId> = cfg.universe.iter().map(|s| InstrumentId::new(s.clone())).collect();
        all_instruments
            .into_iter()
            .filter(|inst| inst.enabled && universe_symbols.contains(&inst.id) && inst.provider == provider)
            .collect()
    } else {
        all_instruments
            .into_iter()
            .filter(|inst| inst.enabled && inst.provider == provider)
            .collect()
    };

    info!(
        count = active_instruments.len(),
        instruments = ?active_instruments.iter().map(|i| i.id.as_str()).collect::<Vec<_>>(),
        "Configured active instrument universe"
    );

    let normalizer = Arc::new(BinanceNormalizer::new(&active_instruments));

    // Construct stream subscription query (combined stream)
    // Format: <symbol>@trade/<symbol>@ticker/...
    let mut streams = Vec::new();
    for inst in &active_instruments {
        let sym = inst.provider_symbol.to_lowercase();
        streams.push(format!("{}@trade", sym));
        streams.push(format!("{}@ticker", sym));
    }
    let streams_param = streams.join("/");
    let ws_url = format!("{}/stream?streams={}", cfg.binance_ws_url, streams_param);

    // Optional NATS connection loop (retries in background if NATS isn't up yet)
    let nats_client = match async_nats::connect(&cfg.nats_url).await {
        Ok(client) => {
            info!("Successfully connected to NATS event bus at {}", cfg.nats_url);
            Some(client)
        }
        Err(err) => {
            warn!(error = %err, "Could not immediately connect to NATS. Collector will attempt reconnects in background.");
            None
        }
    };

    let nats_holder = Arc::new(tokio::sync::RwLock::new(nats_client));

    // Background task to reconnect to NATS if initial connect failed
    let _nats_reconnector = {
        let nats_holder = nats_holder.clone();
        let nats_url = cfg.nats_url.clone();
        tokio::spawn(async move {
            loop {
                {
                    let lock = nats_holder.read().await;
                    if lock.is_some() {
                        sleep(Duration::from_secs(5)).await;
                        continue;
                    }
                }

                info!(nats_url = %nats_url, "Retrying NATS connection...");
                match async_nats::connect(&nats_url).await {
                    Ok(client) => {
                        info!("Reconnected to NATS event bus successfully!");
                        let mut lock = nats_holder.write().await;
                        *lock = Some(client);
                    }
                    Err(err) => {
                        debug!(error = %err, "NATS connection retry failed, sleeping 5s...");
                        sleep(Duration::from_secs(5)).await;
                    }
                }
            }
        })
    };

    // Periodic telemetry reporter
    let _telemetry_task = tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(10));
        loop {
            ticker.tick().await;
            info!(
                trades_total = TRADES_INGESTED.load(Ordering::Relaxed),
                tickers_total = TICKERS_INGESTED.load(Ordering::Relaxed),
                reconnects = RECONNECT_COUNT.load(Ordering::Relaxed),
                "Collector telemetry metrics"
            );
        }
    });

    // Main Binance ingestion loop with exponential backoff & jitter
    let mut attempt = 0u32;
    loop {
        info!(attempt = attempt + 1, url = %ws_url, "Connecting to Binance WebSocket stream...");

        match connect_async(&ws_url).await {
            Ok((ws_stream, response)) => {
                info!(
                    status = %response.status(),
                    "Connected to Binance WebSocket stream successfully"
                );
                attempt = 0; // Reset backoff on successful connect

                // Broadcast LIVE status to NATS
                if let Some(nats) = nats_holder.read().await.as_ref() {
                    let status_evt = ProviderStatusEvent {
                        provider: provider.clone(),
                        connected: true,
                        status: "LIVE".to_string(),
                        last_event_at_ns: chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
                        reconnect_count: RECONNECT_COUNT.load(Ordering::Relaxed),
                    };
                    let subject = NatsSubjects::provider_status(&provider);
                    if let Ok(bytes) = serde_json::to_vec(&MarketMessage::Status(status_evt)) {
                        let _ = nats.publish(subject, bytes.into()).await;
                    }
                }

                let (mut write, mut read) = ws_stream.split();
                let mut ping_ticker = interval(Duration::from_secs(30));

                loop {
                    tokio::select! {
                        _ = ping_ticker.tick() => {
                            if let Err(e) = write.send(Message::Ping(vec![].into())).await {
                                warn!(error = %e, "Failed to send WebSocket ping frame");
                                break;
                            }
                        }
                        msg = read.next() => {
                            match msg {
                                Some(Ok(Message::Text(text))) => {
                                    if let Some(payload) = normalizer.parse_frame(&text) {
                                        match payload {
                                            NormalizedPayload::Trade(trade) => {
                                                TRADES_INGESTED.fetch_add(1, Ordering::Relaxed);
                                                let subject = NatsSubjects::trade(&trade.provider, &trade.instrument);
                                                if let Some(nats) = nats_holder.read().await.as_ref() {
                                                    let msg = MarketMessage::Trade(trade);
                                                    if let Ok(bytes) = serde_json::to_vec(&msg) {
                                                        let _ = nats.publish(subject, bytes.into()).await;
                                                    }
                                                }
                                            }
                                            NormalizedPayload::Ticker(ticker) => {
                                                TICKERS_INGESTED.fetch_add(1, Ordering::Relaxed);
                                                let subject = NatsSubjects::ticker(&ticker.provider, &ticker.instrument);
                                                if let Some(nats) = nats_holder.read().await.as_ref() {
                                                    let msg = MarketMessage::Ticker(ticker);
                                                    if let Ok(bytes) = serde_json::to_vec(&msg) {
                                                        let _ = nats.publish(subject, bytes.into()).await;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                Some(Ok(Message::Ping(bytes))) => {
                                    let _ = write.send(Message::Pong(bytes)).await;
                                }
                                Some(Ok(Message::Pong(_))) => {
                                    debug!("Received WebSocket pong heartbeat from Binance");
                                }
                                Some(Ok(Message::Close(reason))) => {
                                    warn!(?reason, "Binance closed WebSocket connection");
                                    break;
                                }
                                Some(Err(e)) => {
                                    error!(error = %e, "Binance WebSocket read error");
                                    break;
                                }
                                None => {
                                    warn!("Binance WebSocket stream ended (EOF)");
                                    break;
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
            Err(e) => {
                error!(error = %e, "Failed to connect to Binance WebSocket");
            }
        }

        RECONNECT_COUNT.fetch_add(1, Ordering::Relaxed);
        attempt = (attempt + 1).min(6);
        let backoff_secs = (2u64.pow(attempt)).min(30);

        // Broadcast RECONNECTING status
        if let Some(nats) = nats_holder.read().await.as_ref() {
            let status_evt = ProviderStatusEvent {
                provider: provider.clone(),
                connected: false,
                status: "RECONNECTING".to_string(),
                last_event_at_ns: chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
                reconnect_count: RECONNECT_COUNT.load(Ordering::Relaxed),
            };
            let subject = NatsSubjects::provider_status(&provider);
            if let Ok(bytes) = serde_json::to_vec(&MarketMessage::Status(status_evt)) {
                let _ = nats.publish(subject, bytes.into()).await;
            }
        }

        warn!(
            backoff_secs = backoff_secs,
            "Reconnecting to Binance in {} seconds...", backoff_secs
        );
        sleep(Duration::from_secs(backoff_secs)).await;
    }

    #[allow(unreachable_code)]
    {
        _nats_reconnector.abort();
        _telemetry_task.abort();
        Ok(())
    }
}
