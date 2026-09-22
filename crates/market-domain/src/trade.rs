use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use crate::instrument::{InstrumentId, ProviderId};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TradeSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TradeEvent {
    pub event_id: String,
    pub provider: ProviderId,
    pub instrument: InstrumentId,
    pub event_time_ns: i64,
    pub ingest_time_ns: i64,
    pub price: Decimal,
    pub quantity: Decimal,
    pub side: Option<TradeSide>,
}

impl TradeEvent {
    pub fn latency_ms(&self) -> i64 {
        (self.ingest_time_ns - self.event_time_ns) / 1_000_000
    }
}
