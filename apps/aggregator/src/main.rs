mod engine;
mod questdb;
mod rollup;

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use anyhow::{Context, Result};
use chrono::Utc;
use futures_util::StreamExt;
use tokio::sync::Mutex;
use tokio::time::{interval, sleep};
use tracing::{info, warn, Level};
use tracing_subscriber::FmtSubscriber;

use engine::{CandleEngine, EngineOutput};
use market_config::AppConfig;
use market_domain::Interval;
use market_protocol::{MarketMessage, NatsSubjects};
use questdb::QuestDbClient;
use rollup::RollupEngine;

static TRADES_PROCESSED: AtomicU64 = AtomicU64::new(0);
static CANDLES_1S_FINALIZED: AtomicU64 = AtomicU64::new(0);
static CANDLES_1M_FINALIZED: AtomicU64 = AtomicU64::new(0);

#[tokio::main]
async fn main() -> Result<()> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    let cfg = AppConfig::load().context("Failed to load application config")?;

    info!("===============================================");
    info!("Starting Rust 1-Second Market Aggregator Daemon");
    info!(nats_url = %cfg.nats_url, "NATS event bus endpoint");
    info!(
        questdb_host = %cfg.questdb_ilp_host,
        questdb_port = cfg.questdb_ilp_port,
        "QuestDB ILP ingestion endpoint"
    );
    info!("===============================================");

    // Initialize QuestDB client
    let questdb = Arc::new(QuestDbClient::new(
        cfg.questdb_ilp_host.clone(),
        cfg.questdb_ilp_port,
        50_000,
    ));

    // Connect to NATS
    let nats_client = loop {
        match async_nats::connect(&cfg.nats_url).await {
            Ok(client) => {
                info!("Connected to NATS message broker at {}", cfg.nats_url);
                break client;
            }
            Err(err) => {
                warn!(error = %err, "Waiting for NATS connection at {}...", cfg.nats_url);
                sleep(Duration::from_secs(2)).await;
            }
        }
    };

    let nats = Arc::new(nats_client);

    let engine = Arc::new(Mutex::new(CandleEngine::new(Interval::Sec1, 500)));
    let rollup = Arc::new(Mutex::new(RollupEngine::new()));

    // Periodic timeout check to finalize quiet candles
    let timeout_task = {
        let engine = engine.clone();
        let rollup = rollup.clone();
        let questdb = questdb.clone();
        let nats = nats.clone();

        tokio::spawn(async move {
            let mut tick = interval(Duration::from_millis(500));
            loop {
                tick.tick().await;
                let now_ns = Utc::now().timestamp_nanos_opt().unwrap_or(0);
                let timed_out_candles = {
                    let mut lock = engine.lock().await;
                    lock.check_timeouts(now_ns)
                };

                for candle in timed_out_candles {
                    CANDLES_1S_FINALIZED.fetch_add(1, Ordering::Relaxed);
                    questdb.enqueue(candle.clone()).await;

                    // Publish finalized 1s candle to NATS
                    let subject = NatsSubjects::candle(Interval::Sec1, &candle.instrument);
                    if let Ok(bytes) = serde_json::to_vec(&MarketMessage::Candle(candle.clone())) {
                        let _ = nats.publish(subject, bytes.into()).await;
                    }

                    // Rollup into 1m/1h/1d
                    let rollup_res = {
                        let mut roll_lock = rollup.lock().await;
                        roll_lock.ingest_1s_candle(&candle)
                    };

                    handle_rollup_results(&rollup_res, &questdb, &nats).await;
                }
            }
        })
    };

    // Telemetry reporter
    let telemetry_task = tokio::spawn(async move {
        let mut tick = interval(Duration::from_secs(10));
        loop {
            tick.tick().await;
            info!(
                trades_processed = TRADES_PROCESSED.load(Ordering::Relaxed),
                candles_1s_finalized = CANDLES_1S_FINALIZED.load(Ordering::Relaxed),
                candles_1m_finalized = CANDLES_1M_FINALIZED.load(Ordering::Relaxed),
                "Aggregator engine metrics"
            );
        }
    });

    // Subscribe to all normalized trades
    let trade_subject = NatsSubjects::all_trades();
    info!(subject = %trade_subject, "Subscribing to normalized trades on NATS");
    let mut trade_sub = nats.subscribe(trade_subject).await.context("Failed to subscribe to trades on NATS")?;

    info!("Aggregator hot-path event loop running...");
    while let Some(msg) = trade_sub.next().await {
        if let Ok(MarketMessage::Trade(trade)) = serde_json::from_slice::<MarketMessage>(&msg.payload) {
            TRADES_PROCESSED.fetch_add(1, Ordering::Relaxed);

            let output = {
                let mut lock = engine.lock().await;
                lock.handle_trade(&trade)
            };

            match output {
                EngineOutput::Partial(candle) => {
                    // Broadcast live partial 1s candle
                    let subject = NatsSubjects::candle(Interval::Sec1, &candle.instrument);
                    if let Ok(bytes) = serde_json::to_vec(&MarketMessage::Candle(candle)) {
                        let _ = nats.publish(subject, bytes.into()).await;
                    }
                }
                EngineOutput::FinalizedAndNew {
                    finalized,
                    new_partial,
                } => {
                    CANDLES_1S_FINALIZED.fetch_add(1, Ordering::Relaxed);

                    // 1. Enqueue finalized 1s candle to QuestDB
                    questdb.enqueue(finalized.clone()).await;

                    // 2. Publish finalized 1s candle to NATS
                    let subject_1s = NatsSubjects::candle(Interval::Sec1, &finalized.instrument);
                    if let Ok(bytes) = serde_json::to_vec(&MarketMessage::Candle(finalized.clone())) {
                        let _ = nats.publish(subject_1s, bytes.into()).await;
                    }

                    // 3. Rollup into 1m, 1h, 1d
                    let rollup_res = {
                        let mut roll_lock = rollup.lock().await;
                        roll_lock.ingest_1s_candle(&finalized)
                    };
                    handle_rollup_results(&rollup_res, &questdb, &nats).await;

                    // 4. Publish newly opened partial candle
                    let new_subj = NatsSubjects::candle(Interval::Sec1, &new_partial.instrument);
                    if let Ok(bytes) = serde_json::to_vec(&MarketMessage::Candle(new_partial)) {
                        let _ = nats.publish(new_subj, bytes.into()).await;
                    }
                }
                EngineOutput::TimedOutFinalized(candle) => {
                    CANDLES_1S_FINALIZED.fetch_add(1, Ordering::Relaxed);
                    questdb.enqueue(candle.clone()).await;
                    let subject = NatsSubjects::candle(Interval::Sec1, &candle.instrument);
                    if let Ok(bytes) = serde_json::to_vec(&MarketMessage::Candle(candle)) {
                        let _ = nats.publish(subject, bytes.into()).await;
                    }
                }
            }
        }
    }

    #[allow(unreachable_code)]
    {
        timeout_task.abort();
        telemetry_task.abort();
        Ok(())
    }
}

async fn handle_rollup_results(
    res: &rollup::RollupResult,
    questdb: &Arc<QuestDbClient>,
    nats: &Arc<async_nats::Client>,
) {
    if let Some(c1m) = &res.finalized_1m {
        CANDLES_1M_FINALIZED.fetch_add(1, Ordering::Relaxed);
        questdb.enqueue(c1m.clone()).await;
        let subject = NatsSubjects::candle(Interval::Min1, &c1m.instrument);
        if let Ok(bytes) = serde_json::to_vec(&MarketMessage::Candle(c1m.clone())) {
            let _ = nats.publish(subject, bytes.into()).await;
        }
    }

    if let Some(c1h) = &res.finalized_1h {
        questdb.enqueue(c1h.clone()).await;
        let subject = NatsSubjects::candle(Interval::Hour1, &c1h.instrument);
        if let Ok(bytes) = serde_json::to_vec(&MarketMessage::Candle(c1h.clone())) {
            let _ = nats.publish(subject, bytes.into()).await;
        }
    }

    if let Some(c1d) = &res.finalized_1d {
        questdb.enqueue(c1d.clone()).await;
        let subject = NatsSubjects::candle(Interval::Day1, &c1d.instrument);
        if let Ok(bytes) = serde_json::to_vec(&MarketMessage::Candle(c1d.clone())) {
            let _ = nats.publish(subject, bytes.into()).await;
        }
    }
}
