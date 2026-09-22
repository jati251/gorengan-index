use crate::instrument::{InstrumentId, ProviderId};
use crate::quote::MarketSessionState;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarketDataQuality {
    RealtimeVenue,
    RealtimeConsolidated,
    NearRealtime,
    Delayed,
    EndOfDay,
    LastKnown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VolumeScope {
    VenueOnly,
    Consolidated,
    ProviderReported,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CandleQuality {
    TradeDerived,
    ProviderBar,
    QuoteDerived,
    SnapshotDerived,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DataProvenance {
    pub provider: ProviderId,
    pub venue: Option<String>,
    pub quality: MarketDataQuality,
    pub delay_seconds: Option<u32>,
    pub is_consolidated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EquityTradeTick {
    pub instrument: InstrumentId,
    pub provider: ProviderId,
    pub venue: Option<String>,
    pub price: Decimal,
    pub quantity: Decimal,
    pub exchange_ts_ns: i64,
    pub received_ts_ns: i64,
    pub conditions: Vec<String>,
    pub provenance: DataProvenance,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EquityQuoteTick {
    pub instrument: InstrumentId,
    pub provider: ProviderId,
    pub venue: Option<String>,
    pub bid: Option<Decimal>,
    pub bid_size: Option<Decimal>,
    pub ask: Option<Decimal>,
    pub ask_size: Option<Decimal>,
    pub last: Option<Decimal>,
    pub timestamp_ns: i64,
    pub provenance: DataProvenance,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EquitySnapshot {
    pub instrument: InstrumentId,
    pub symbol: String,
    pub market: String, // "US" or "ID"
    pub currency: String, // "USD" or "IDR"
    pub last: Option<Decimal>,
    pub open: Option<Decimal>,
    pub high: Option<Decimal>,
    pub low: Option<Decimal>,
    pub previous_close: Option<Decimal>,
    pub volume: Option<Decimal>,
    pub bid: Option<Decimal>,
    pub ask: Option<Decimal>,
    pub change: Option<Decimal>,
    pub change_pct: Option<Decimal>,
    pub market_state: MarketSessionState,
    pub session_segment: Option<String>, // e.g. "SESSION_1", "SESSION_2", "REGULAR"
    pub timestamp_ns: i64,
    pub provenance: DataProvenance,
    pub stale: bool,
}
