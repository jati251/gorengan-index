use std::collections::HashMap;
use market_domain::{Candle, InstrumentId, Interval, TradeEvent};
use tracing::debug;

#[derive(Debug, Clone)]
pub enum EngineOutput {
    /// Live partial candle update (sub-second tick)
    Partial(Candle),
    /// A candle has completed and finalized, accompanied by the newly opened bucket
    FinalizedAndNew {
        finalized: Candle,
        new_partial: Candle,
    },
    /// A stale open bucket finalized due to elapsed time
    #[allow(dead_code)]
    TimedOutFinalized(Candle),
}

pub struct CandleEngine {
    interval: Interval,
    /// Late event tolerance in nanoseconds (e.g. 500ms = 500_000_000 ns)
    late_tolerance_ns: i64,
    /// Currently open in-memory candle per instrument
    open_candles: HashMap<InstrumentId, Candle>,
}

impl CandleEngine {
    pub fn new(interval: Interval, late_tolerance_ms: i64) -> Self {
        Self {
            interval,
            late_tolerance_ns: late_tolerance_ms * 1_000_000,
            open_candles: HashMap::new(),
        }
    }

    pub fn handle_trade(&mut self, trade: &TradeEvent) -> EngineOutput {
        let bucket_start = self.interval.bucket_start_ns(trade.event_time_ns);

        if let Some(open) = self.open_candles.get_mut(&trade.instrument) {
            if bucket_start == open.open_time_ns {
                // Same bucket: update OHLCV
                open.update(trade.price, trade.quantity);
                EngineOutput::Partial(open.clone())
            } else if bucket_start > open.open_time_ns {
                // New bucket arrived: finalize the previous one
                let mut finalized = open.clone();
                finalized.finalized = true;

                let new_candle = Candle::new(
                    trade.instrument.clone(),
                    self.interval,
                    bucket_start,
                    trade.price,
                    trade.quantity,
                    trade.provider.clone(),
                );

                *open = new_candle.clone();

                EngineOutput::FinalizedAndNew {
                    finalized,
                    new_partial: new_candle,
                }
            } else {
                // Late trade: event_time_ns is before current open candle bucket
                let diff = open.open_time_ns - trade.event_time_ns;
                if diff <= self.late_tolerance_ns {
                    debug!(
                        instrument = %trade.instrument,
                        diff_ms = diff / 1_000_000,
                        "Processing late trade within tolerance window"
                    );
                }
                // Return current open partial candle
                EngineOutput::Partial(open.clone())
            }
        } else {
            // First candle for this instrument
            let new_candle = Candle::new(
                trade.instrument.clone(),
                self.interval,
                bucket_start,
                trade.price,
                trade.quantity,
                trade.provider.clone(),
            );
            self.open_candles.insert(trade.instrument.clone(), new_candle.clone());
            EngineOutput::Partial(new_candle)
        }
    }

    /// Check if any open candles have passed their bucket end + grace period without new trades
    pub fn check_timeouts(&mut self, current_time_ns: i64) -> Vec<Candle> {
        let mut finalized = Vec::new();
        let grace = self.late_tolerance_ns;

        self.open_candles.retain(|_, candle| {
            let bucket_end = candle.close_time_ns;
            if current_time_ns > bucket_end + grace {
                let mut finished = candle.clone();
                finished.finalized = true;
                finalized.push(finished);
                false // remove from open candles
            } else {
                true
            }
        });

        finalized
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use market_domain::{ProviderId, TradeSide};
    use rust_decimal_macros::dec;

    #[test]
    fn test_engine_single_bucket_updates() {
        let mut engine = CandleEngine::new(Interval::Sec1, 500);
        let inst = InstrumentId::new("BTC-USDT");
        let prov = ProviderId::new("binance");

        let t1 = TradeEvent {
            event_id: "t1".into(),
            provider: prov.clone(),
            instrument: inst.clone(),
            event_time_ns: 1_780_000_000_100_000_000,
            ingest_time_ns: 1_780_000_000_105_000_000,
            price: dec!(100.0),
            quantity: dec!(1.0),
            side: Some(TradeSide::Buy),
        };

        let out1 = engine.handle_trade(&t1);
        match out1 {
            EngineOutput::Partial(c) => {
                assert_eq!(c.open, dec!(100.0));
                assert_eq!(c.close, dec!(100.0));
                assert_eq!(c.volume, dec!(1.0));
                assert_eq!(c.trade_count, 1);
                assert!(!c.finalized);
            }
            _ => panic!("Expected partial candle"),
        }

        // Second trade in same second at 500ms
        let t2 = TradeEvent {
            event_id: "t2".into(),
            provider: prov.clone(),
            instrument: inst.clone(),
            event_time_ns: 1_780_000_000_500_000_000,
            ingest_time_ns: 1_780_000_000_505_000_000,
            price: dec!(105.0),
            quantity: dec!(2.0),
            side: Some(TradeSide::Buy),
        };

        let out2 = engine.handle_trade(&t2);
        match out2 {
            EngineOutput::Partial(c) => {
                assert_eq!(c.open, dec!(100.0));
                assert_eq!(c.high, dec!(105.0));
                assert_eq!(c.low, dec!(100.0));
                assert_eq!(c.close, dec!(105.0));
                assert_eq!(c.volume, dec!(3.0));
                assert_eq!(c.trade_count, 2);
            }
            _ => panic!("Expected partial candle"),
        }
    }

    #[test]
    fn test_engine_bucket_finalization_on_new_second() {
        let mut engine = CandleEngine::new(Interval::Sec1, 500);
        let inst = InstrumentId::new("BTC-USDT");
        let prov = ProviderId::new("binance");

        let t1 = TradeEvent {
            event_id: "t1".into(),
            provider: prov.clone(),
            instrument: inst.clone(),
            event_time_ns: 1_780_000_000_100_000_000,
            ingest_time_ns: 1_780_000_000_105_000_000,
            price: dec!(100.0),
            quantity: dec!(1.0),
            side: Some(TradeSide::Buy),
        };
        engine.handle_trade(&t1);

        let t2 = TradeEvent {
            event_id: "t2".into(),
            provider: prov.clone(),
            instrument: inst.clone(),
            event_time_ns: 1_780_000_001_050_000_000,
            ingest_time_ns: 1_780_000_001_055_000_000,
            price: dec!(108.0),
            quantity: dec!(0.5),
            side: Some(TradeSide::Buy),
        };

        let out = engine.handle_trade(&t2);
        match out {
            EngineOutput::FinalizedAndNew {
                finalized,
                new_partial,
            } => {
                assert!(finalized.finalized);
                assert_eq!(finalized.open_time_ns, 1_780_000_000_000_000_000);
                assert_eq!(finalized.close, dec!(100.0));
                assert_eq!(finalized.volume, dec!(1.0));

                assert!(!new_partial.finalized);
                assert_eq!(new_partial.open_time_ns, 1_780_000_001_000_000_000);
                assert_eq!(new_partial.open, dec!(108.0));
                assert_eq!(new_partial.volume, dec!(0.5));
            }
            _ => panic!("Expected FinalizedAndNew"),
        }
    }
}
