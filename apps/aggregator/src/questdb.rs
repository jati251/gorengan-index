use std::time::Duration;
use market_domain::{Candle, Interval};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio::time::sleep;
use tracing::{debug, error, info, warn};

pub struct QuestDbClient {
    tx: mpsc::Sender<Candle>,
}

impl QuestDbClient {
    pub fn new(host: String, port: u16, max_buffer: usize) -> Self {
        let (tx, rx) = mpsc::channel(max_buffer);

        let host_clone = host.clone();
        tokio::spawn(async move {
            run_ilp_sender(host_clone, port, rx).await;
        });

        Self { tx }
    }

    pub async fn enqueue(&self, candle: Candle) {
        if let Err(e) = self.tx.try_send(candle) {
            warn!(error = %e, "QuestDB ingestion buffer full or channel closed; dropping candle");
        }
    }
}

pub fn format_candle_ilp(candle: &Candle) -> String {
    let table = match candle.interval {
        Interval::Sec1 => "candles_1s",
        Interval::Sec5 => "candles_5s",
        Interval::Sec15 => "candles_15s",
        Interval::Sec30 => "candles_30s",
        Interval::Min1 => "candles_1m",
        Interval::Min5 => "candles_5m",
        Interval::Min15 => "candles_15m",
        Interval::Min30 => "candles_30m",
        Interval::Hour1 => "candles_1h",
        Interval::Hour4 => "candles_4h",
        Interval::Day1 => "candles_1d",
        Interval::Week1 => "candles_1w",
    };

    // Format: table,instrument=...,provider=... open=...,high=...,low=...,close=...,volume=...,trade_count=...i timestamp_nanos\n
    format!(
        "{},instrument={},provider={} open={},high={},low={},close={},volume={},trade_count={}i {}\n",
        table,
        candle.instrument.as_str(),
        candle.provider.as_str(),
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume,
        candle.trade_count,
        candle.open_time_ns
    )
}

async fn run_ilp_sender(host: String, port: u16, mut rx: mpsc::Receiver<Candle>) {
    let addr = format!("{}:{}", host, port);
    info!(endpoint = %addr, "Starting QuestDB ILP batch ingestion worker");

    let mut stream: Option<TcpStream> = None;
    let mut batch = String::with_capacity(32 * 1024);

    loop {
        // Collect items into batch
        batch.clear();
        let mut count = 0;

        // Wait for first item
        match rx.recv().await {
            Some(first) => {
                batch.push_str(&format_candle_ilp(&first));
                count += 1;
            }
            None => {
                info!("QuestDB sender channel closed, terminating ingestion worker.");
                break;
            }
        }

        // Drain any pending items up to 500
        while let Ok(next) = rx.try_recv() {
            batch.push_str(&format_candle_ilp(&next));
            count += 1;
            if count >= 500 {
                break;
            }
        }

        // Ensure connection
        if stream.is_none() {
            match TcpStream::connect(&addr).await {
                Ok(s) => {
                    info!(endpoint = %addr, "Connected to QuestDB ILP endpoint successfully");
                    stream = Some(s);
                }
                Err(err) => {
                    warn!(error = %err, endpoint = %addr, "Could not connect to QuestDB ILP endpoint. Retrying in 2s...");
                    sleep(Duration::from_secs(2)).await;
                    continue;
                }
            }
        }

        // Write batch
        if let Some(s) = stream.as_mut() {
            if let Err(e) = s.write_all(batch.as_bytes()).await {
                error!(error = %e, "Failed to write ILP batch to QuestDB; resetting connection");
                stream = None;
                sleep(Duration::from_millis(500)).await;
            } else {
                debug!(count = count, "Flushed ILP candles to QuestDB");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use market_domain::{InstrumentId, ProviderId};
    use rust_decimal_macros::dec;

    #[test]
    fn test_format_candle_ilp() {
        let candle = Candle {
            instrument: InstrumentId::new("BTC-USDT"),
            interval: Interval::Sec1,
            open_time_ns: 1_780_000_000_000_000_000,
            close_time_ns: 1_780_000_000_999_999_999,
            open: dec!(68000.50),
            high: dec!(68010.00),
            low: dec!(67990.25),
            close: dec!(68005.00),
            volume: dec!(1.5),
            trade_count: 12,
            finalized: true,
            provider: ProviderId::new("binance"),
        };

        let line = format_candle_ilp(&candle);
        assert_eq!(
            line,
            "candles_1s,instrument=BTC-USDT,provider=binance open=68000.50,high=68010.00,low=67990.25,close=68005.00,volume=1.5,trade_count=12i 1780000000000000000\n"
        );
    }
}
