use crate::instrument::{InstrumentId, ProviderId};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CandlePriceBasis {
    Trade,
    Mid,
    Bid,
    Ask,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VolumeKind {
    RealTradeVolume,
    ProviderVolume,
    TickCount,
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionKind {
    TwentyFourSeven,
    FxTwentyFourFive,
    ProviderControlled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarketSessionState {
    Open,
    Regular,
    PreMarket,
    Break,
    AfterHours,
    Overnight,
    Closed,
    Holiday,
    Halted,
    PreOpen,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QuoteTick {
    pub instrument: InstrumentId,
    pub provider: ProviderId,
    pub provider_symbol: String,
    pub bid: Decimal,
    pub ask: Decimal,
    pub mid: Decimal,
    pub spread: Decimal,
    pub spread_bps: Decimal,
    pub provider_ts_ns: i64,
    pub ingest_ts_ns: i64,
    pub sequence: Option<u64>,
    pub tradeable: Option<bool>,
    pub bid_size: Option<Decimal>,
    pub ask_size: Option<Decimal>,
}

impl QuoteTick {
    pub fn new(
        instrument: InstrumentId,
        provider: ProviderId,
        provider_symbol: String,
        bid: Decimal,
        ask: Decimal,
        provider_ts_ns: i64,
        ingest_ts_ns: i64,
    ) -> Self {
        let mid = (bid + ask) / Decimal::from(2);
        let spread = ask - bid;
        let spread_bps = if mid.is_zero() {
            Decimal::ZERO
        } else {
            (spread / mid) * Decimal::from(10_000)
        };

        Self {
            instrument,
            provider,
            provider_symbol,
            bid,
            ask,
            mid,
            spread,
            spread_bps,
            provider_ts_ns,
            ingest_ts_ns,
            sequence: None,
            tradeable: Some(true),
            bid_size: None,
            ask_size: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn test_quote_calculations() {
        let quote = QuoteTick::new(
            InstrumentId::new("EUR-USD"),
            ProviderId::new("interbank"),
            "EURUSD=X".into(),
            dec!(1.18120),
            dec!(1.18128),
            1_780_000_000_000_000_000,
            1_780_000_000_002_000_000,
        );

        assert_eq!(quote.mid, dec!(1.18124));
        assert_eq!(quote.spread, dec!(0.00008));
        assert!(quote.spread_bps > Decimal::ZERO);
    }
}
