use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use crate::instrument::{InstrumentId, ProviderId};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TickerState {
    pub instrument: InstrumentId,
    pub provider: ProviderId,
    pub price: Decimal,
    pub bid: Option<Decimal>,
    pub ask: Option<Decimal>,
    pub open_24h: Option<Decimal>,
    pub high_24h: Option<Decimal>,
    pub low_24h: Option<Decimal>,
    pub volume_24h: Option<Decimal>,
    pub quote_volume_24h: Option<Decimal>,
    pub change_24h: Option<Decimal>,
    pub change_percent_24h: Option<Decimal>,
    pub updated_at_ns: i64,
}
