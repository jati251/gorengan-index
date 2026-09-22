use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use thiserror::Error;
use crate::instrument::{InstrumentId, ProviderId};

#[derive(Error, Debug, PartialEq, Eq)]
pub enum IntervalParseError {
    #[error("Unknown or unsupported interval: {0}")]
    Unknown(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Interval {
    #[serde(rename = "1s")]
    Sec1,
    #[serde(rename = "5s")]
    Sec5,
    #[serde(rename = "15s")]
    Sec15,
    #[serde(rename = "30s")]
    Sec30,
    #[serde(rename = "1m")]
    Min1,
    #[serde(rename = "5m")]
    Min5,
    #[serde(rename = "15m")]
    Min15,
    #[serde(rename = "30m")]
    Min30,
    #[serde(rename = "1h")]
    Hour1,
    #[serde(rename = "4h")]
    Hour4,
    #[serde(rename = "1d")]
    Day1,
    #[serde(rename = "1w")]
    Week1,
}

impl Interval {
    pub fn duration_ns(&self) -> i64 {
        match self {
            Self::Sec1 => 1_000_000_000,
            Self::Sec5 => 5 * 1_000_000_000,
            Self::Sec15 => 15 * 1_000_000_000,
            Self::Sec30 => 30 * 1_000_000_000,
            Self::Min1 => 60 * 1_000_000_000,
            Self::Min5 => 5 * 60 * 1_000_000_000,
            Self::Min15 => 15 * 60 * 1_000_000_000,
            Self::Min30 => 30 * 60 * 1_000_000_000,
            Self::Hour1 => 60 * 60 * 1_000_000_000,
            Self::Hour4 => 4 * 60 * 60 * 1_000_000_000,
            Self::Day1 => 24 * 60 * 60 * 1_000_000_000,
            Self::Week1 => 7 * 24 * 60 * 60 * 1_000_000_000,
        }
    }

    pub fn duration_ms(&self) -> i64 {
        self.duration_ns() / 1_000_000
    }

    /// Aligns timestamp to the start of the bucket (event_time in ns)
    pub fn bucket_start_ns(&self, timestamp_ns: i64) -> i64 {
        let dur = self.duration_ns();
        (timestamp_ns / dur) * dur
    }

    /// Aligns timestamp to the end of the bucket (inclusive, in ns)
    pub fn bucket_end_ns(&self, timestamp_ns: i64) -> i64 {
        self.bucket_start_ns(timestamp_ns) + self.duration_ns() - 1
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Sec1 => "1s",
            Self::Sec5 => "5s",
            Self::Sec15 => "15s",
            Self::Sec30 => "30s",
            Self::Min1 => "1m",
            Self::Min5 => "5m",
            Self::Min15 => "15m",
            Self::Min30 => "30m",
            Self::Hour1 => "1h",
            Self::Hour4 => "4h",
            Self::Day1 => "1d",
            Self::Week1 => "1w",
        }
    }
}

impl fmt::Display for Interval {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl FromStr for Interval {
    type Err = IntervalParseError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "1s" => Ok(Self::Sec1),
            "5s" => Ok(Self::Sec5),
            "15s" => Ok(Self::Sec15),
            "30s" => Ok(Self::Sec30),
            "1m" => Ok(Self::Min1),
            "5m" => Ok(Self::Min5),
            "15m" => Ok(Self::Min15),
            "30m" => Ok(Self::Min30),
            "1h" => Ok(Self::Hour1),
            "4h" => Ok(Self::Hour4),
            "1d" => Ok(Self::Day1),
            "1w" => Ok(Self::Week1),
            _ => Err(IntervalParseError::Unknown(s.to_string())),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Candle {
    pub instrument: InstrumentId,
    pub interval: Interval,
    pub open_time_ns: i64,
    pub close_time_ns: i64,
    pub open: Decimal,
    pub high: Decimal,
    pub low: Decimal,
    pub close: Decimal,
    pub volume: Decimal,
    pub trade_count: u64,
    pub finalized: bool,
    pub provider: ProviderId,
}

impl Candle {
    pub fn new(
        instrument: InstrumentId,
        interval: Interval,
        open_time_ns: i64,
        initial_price: Decimal,
        initial_volume: Decimal,
        provider: ProviderId,
    ) -> Self {
        let close_time_ns = open_time_ns + interval.duration_ns() - 1;
        Self {
            instrument,
            interval,
            open_time_ns,
            close_time_ns,
            open: initial_price,
            high: initial_price,
            low: initial_price,
            close: initial_price,
            volume: initial_volume,
            trade_count: 1,
            finalized: false,
            provider,
        }
    }

    pub fn update(&mut self, price: Decimal, quantity: Decimal) {
        if price > self.high {
            self.high = price;
        }
        if price < self.low {
            self.low = price;
        }
        self.close = price;
        self.volume += quantity;
        self.trade_count += 1;
    }

    pub fn merge(&mut self, other: &Candle) {
        if other.high > self.high {
            self.high = other.high;
        }
        if other.low < self.low {
            self.low = other.low;
        }
        self.close = other.close;
        self.volume += other.volume;
        self.trade_count += other.trade_count;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn test_interval_durations() {
        assert_eq!(Interval::Sec1.duration_ns(), 1_000_000_000);
        assert_eq!(Interval::Min1.duration_ns(), 60_000_000_000);
        assert_eq!(Interval::Hour1.duration_ns(), 3_600_000_000_000);
    }

    #[test]
    fn test_bucket_alignment() {
        let ts_ns = 1_780_000_123_456_789_000_i64; // 19-digit nanoseconds

        let b1s_start = Interval::Sec1.bucket_start_ns(ts_ns);
        let b1s_end = Interval::Sec1.bucket_end_ns(ts_ns);
        assert_eq!(b1s_start, 1_780_000_123_000_000_000);
        assert_eq!(b1s_end, 1_780_000_123_999_999_999);

        let b1m_start = Interval::Min1.bucket_start_ns(ts_ns);
        assert_eq!(b1m_start % 60_000_000_000, 0);
    }

    #[test]
    fn test_candle_ohlcv_updates() {
        let instrument = InstrumentId::new("BTC-USDT");
        let provider = ProviderId::new("binance");
        let mut candle = Candle::new(
            instrument,
            Interval::Sec1,
            1_000_000_000,
            dec!(100.0),
            dec!(1.5),
            provider,
        );

        assert_eq!(candle.open, dec!(100.0));
        assert_eq!(candle.high, dec!(100.0));
        assert_eq!(candle.low, dec!(100.0));
        assert_eq!(candle.close, dec!(100.0));
        assert_eq!(candle.volume, dec!(1.5));
        assert_eq!(candle.trade_count, 1);

        candle.update(dec!(105.0), dec!(0.5));
        assert_eq!(candle.high, dec!(105.0));
        assert_eq!(candle.low, dec!(100.0));
        assert_eq!(candle.close, dec!(105.0));
        assert_eq!(candle.volume, dec!(2.0));
        assert_eq!(candle.trade_count, 2);

        candle.update(dec!(98.0), dec!(1.0));
        assert_eq!(candle.high, dec!(105.0));
        assert_eq!(candle.low, dec!(98.0));
        assert_eq!(candle.close, dec!(98.0));
        assert_eq!(candle.volume, dec!(3.0));
        assert_eq!(candle.trade_count, 3);
    }
}
