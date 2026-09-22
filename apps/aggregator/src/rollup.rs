use std::collections::HashMap;
use market_domain::{Candle, InstrumentId, Interval};

pub struct RollupEngine {
    open_1m: HashMap<InstrumentId, Candle>,
    open_1h: HashMap<InstrumentId, Candle>,
    open_1d: HashMap<InstrumentId, Candle>,
}

#[derive(Debug, Default)]
pub struct RollupResult {
    pub finalized_1m: Option<Candle>,
    pub finalized_1h: Option<Candle>,
    pub finalized_1d: Option<Candle>,
    pub active_1m: Option<Candle>,
}

impl RollupEngine {
    pub fn new() -> Self {
        Self {
            open_1m: HashMap::new(),
            open_1h: HashMap::new(),
            open_1d: HashMap::new(),
        }
    }

    /// Ingest a finalized 1-second candle and rollup into 1m, 1h, and 1d candles
    pub fn ingest_1s_candle(&mut self, candle_1s: &Candle) -> RollupResult {
        let mut result = RollupResult::default();

        // 1m Rollup
        let bucket_1m_start = Interval::Min1.bucket_start_ns(candle_1s.open_time_ns);
        let mut finished_to_rollup = None;
        if let Some(open) = self.open_1m.get_mut(&candle_1s.instrument) {
            if bucket_1m_start == open.open_time_ns {
                // Same 1m bucket
                open.merge(candle_1s);
                result.active_1m = Some(open.clone());
            } else if bucket_1m_start > open.open_time_ns {
                // 1m bucket rolled over!
                let mut finished_1m = open.clone();
                finished_1m.finalized = true;
                result.finalized_1m = Some(finished_1m.clone());
                finished_to_rollup = Some(finished_1m);

                // Create new 1m candle from candle_1s
                let mut new_1m = candle_1s.clone();
                new_1m.interval = Interval::Min1;
                new_1m.open_time_ns = bucket_1m_start;
                new_1m.close_time_ns = Interval::Min1.bucket_end_ns(candle_1s.open_time_ns);
                new_1m.finalized = false;

                *open = new_1m.clone();
                result.active_1m = Some(new_1m);
            }
        } else {
            // First 1m candle
            let mut new_1m = candle_1s.clone();
            new_1m.interval = Interval::Min1;
            new_1m.open_time_ns = bucket_1m_start;
            new_1m.close_time_ns = Interval::Min1.bucket_end_ns(candle_1s.open_time_ns);
            new_1m.finalized = false;
            self.open_1m.insert(candle_1s.instrument.clone(), new_1m.clone());
            result.active_1m = Some(new_1m);
        }

        if let Some(finished_1m) = finished_to_rollup {
            let h_res = self.ingest_1m_candle(&finished_1m);
            result.finalized_1h = h_res.finalized_1h;
            result.finalized_1d = h_res.finalized_1d;
        }

        result
    }

    fn ingest_1m_candle(&mut self, candle_1m: &Candle) -> RollupResult {
        let mut result = RollupResult::default();
        let bucket_1h_start = Interval::Hour1.bucket_start_ns(candle_1m.open_time_ns);

        let mut finished_to_rollup = None;
        if let Some(open) = self.open_1h.get_mut(&candle_1m.instrument) {
            if bucket_1h_start == open.open_time_ns {
                open.merge(candle_1m);
            } else if bucket_1h_start > open.open_time_ns {
                let mut finished_1h = open.clone();
                finished_1h.finalized = true;
                result.finalized_1h = Some(finished_1h.clone());
                finished_to_rollup = Some(finished_1h);

                let mut new_1h = candle_1m.clone();
                new_1h.interval = Interval::Hour1;
                new_1h.open_time_ns = bucket_1h_start;
                new_1h.close_time_ns = Interval::Hour1.bucket_end_ns(candle_1m.open_time_ns);
                new_1h.finalized = false;
                *open = new_1h;
            }
        } else {
            let mut new_1h = candle_1m.clone();
            new_1h.interval = Interval::Hour1;
            new_1h.open_time_ns = bucket_1h_start;
            new_1h.close_time_ns = Interval::Hour1.bucket_end_ns(candle_1m.open_time_ns);
            new_1h.finalized = false;
            self.open_1h.insert(candle_1m.instrument.clone(), new_1h);
        }

        if let Some(finished_1h) = finished_to_rollup {
            let d_res = self.ingest_1h_candle(&finished_1h);
            result.finalized_1d = d_res.finalized_1d;
        }

        result
    }

    fn ingest_1h_candle(&mut self, candle_1h: &Candle) -> RollupResult {
        let mut result = RollupResult::default();
        let bucket_1d_start = Interval::Day1.bucket_start_ns(candle_1h.open_time_ns);

        if let Some(open) = self.open_1d.get_mut(&candle_1h.instrument) {
            if bucket_1d_start == open.open_time_ns {
                open.merge(candle_1h);
            } else if bucket_1d_start > open.open_time_ns {
                let mut finished_1d = open.clone();
                finished_1d.finalized = true;
                result.finalized_1d = Some(finished_1d);

                let mut new_1d = candle_1h.clone();
                new_1d.interval = Interval::Day1;
                new_1d.open_time_ns = bucket_1d_start;
                new_1d.close_time_ns = Interval::Day1.bucket_end_ns(candle_1h.open_time_ns);
                new_1d.finalized = false;
                *open = new_1d;
            }
        } else {
            let mut new_1d = candle_1h.clone();
            new_1d.interval = Interval::Day1;
            new_1d.open_time_ns = bucket_1d_start;
            new_1d.close_time_ns = Interval::Day1.bucket_end_ns(candle_1h.open_time_ns);
            new_1d.finalized = false;
            self.open_1d.insert(candle_1h.instrument.clone(), new_1d);
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use market_domain::ProviderId;
    use rust_decimal_macros::dec;

    #[test]
    fn test_rollup_1s_to_1m() {
        let mut rollup = RollupEngine::new();
        let inst = InstrumentId::new("BTC-USDT");
        let prov = ProviderId::new("binance");

        // Minute boundary: 1780000020_000_000_000 (00:00:20)
        let c1 = Candle {
            instrument: inst.clone(),
            interval: Interval::Sec1,
            open_time_ns: 60_000_000_000 + 20_000_000_000,
            close_time_ns: 60_000_000_000 + 20_999_999_999,
            open: dec!(100.0),
            high: dec!(105.0),
            low: dec!(99.0),
            close: dec!(103.0),
            volume: dec!(2.0),
            trade_count: 5,
            finalized: true,
            provider: prov.clone(),
        };

        let res1 = rollup.ingest_1s_candle(&c1);
        assert!(res1.finalized_1m.is_none());
        assert!(res1.active_1m.is_some());

        // Same minute, 10 seconds later: (00:00:30)
        let c2 = Candle {
            instrument: inst.clone(),
            interval: Interval::Sec1,
            open_time_ns: 60_000_000_000 + 30_000_000_000,
            close_time_ns: 60_000_000_000 + 30_999_999_999,
            open: dec!(103.0),
            high: dec!(110.0),
            low: dec!(102.0),
            close: dec!(109.0),
            volume: dec!(3.0),
            trade_count: 3,
            finalized: true,
            provider: prov.clone(),
        };

        let res2 = rollup.ingest_1s_candle(&c2);
        assert!(res2.finalized_1m.is_none());
        let active = res2.active_1m.unwrap();
        assert_eq!(active.open, dec!(100.0));
        assert_eq!(active.high, dec!(110.0));
        assert_eq!(active.low, dec!(99.0));
        assert_eq!(active.close, dec!(109.0));
        assert_eq!(active.volume, dec!(5.0));
        assert_eq!(active.trade_count, 8);

        // Next minute: (00:01:05)
        let c3 = Candle {
            instrument: inst.clone(),
            interval: Interval::Sec1,
            open_time_ns: 120_000_000_000 + 5_000_000_000,
            close_time_ns: 120_000_000_000 + 5_999_999_999,
            open: dec!(109.0),
            high: dec!(111.0),
            low: dec!(108.0),
            close: dec!(110.0),
            volume: dec!(1.0),
            trade_count: 2,
            finalized: true,
            provider: prov.clone(),
        };

        let res3 = rollup.ingest_1s_candle(&c3);
        assert!(res3.finalized_1m.is_some());
        let fin = res3.finalized_1m.unwrap();
        assert_eq!(fin.interval, Interval::Min1);
        assert_eq!(fin.open_time_ns, 60_000_000_000);
        assert_eq!(fin.open, dec!(100.0));
        assert_eq!(fin.high, dec!(110.0));
        assert_eq!(fin.low, dec!(99.0));
        assert_eq!(fin.close, dec!(109.0));
        assert_eq!(fin.volume, dec!(5.0));
        assert_eq!(fin.trade_count, 8);
        assert!(fin.finalized);
    }
}
