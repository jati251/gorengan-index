use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use crate::instrument::{InstrumentId, ProviderId};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TickerState {
    pub instrument: InstrumentId,
    pub provider: ProviderId,
    pub price: Decimal,
    #[serde(default)]
    pub bid: Option<Decimal>,
    #[serde(default)]
    pub ask: Option<Decimal>,
    #[serde(default)]
    pub mid: Option<Decimal>,
    #[serde(default)]
    pub spread: Option<Decimal>,
    #[serde(default)]
    pub spread_bps: Option<Decimal>,
    #[serde(default)]
    pub open_24h: Option<Decimal>,
    #[serde(default)]
    pub high_24h: Option<Decimal>,
    #[serde(default)]
    pub low_24h: Option<Decimal>,
    #[serde(default)]
    pub volume_24h: Option<Decimal>,
    #[serde(default)]
    pub quote_volume_24h: Option<Decimal>,
    #[serde(default)]
    pub change_24h: Option<Decimal>,
    #[serde(default)]
    pub change_percent_24h: Option<Decimal>,
    pub updated_at_ns: i64,
    #[serde(default)]
    pub session_state: Option<String>,
    #[serde(default)]
    pub session_segment: Option<String>,
    #[serde(default)]
    pub data_quality: Option<String>,
    #[serde(default)]
    pub market: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub previous_close: Option<Decimal>,
}
