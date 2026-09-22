use crate::instrument::InstrumentId;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CorporateActionType {
    Split,
    ReverseSplit,
    Dividend,
    SymbolChange,
    Delisting,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CorporateAction {
    pub effective_ts_ns: i64,
    pub instrument: InstrumentId,
    pub action_type: CorporateActionType,
    pub ratio_from: Option<Decimal>,
    pub ratio_to: Option<Decimal>,
    pub cash_amount: Option<Decimal>,
    pub currency: Option<String>,
    pub source: String,
}

impl CorporateAction {
    pub fn split_adjustment_factor(&self) -> Option<Decimal> {
        match self.action_type {
            CorporateActionType::Split => {
                if let (Some(from), Some(to)) = (self.ratio_from, self.ratio_to) {
                    if !to.is_zero() {
                        return Some(from / to);
                    }
                }
                None
            }
            CorporateActionType::ReverseSplit => {
                if let (Some(from), Some(to)) = (self.ratio_from, self.ratio_to) {
                    if !from.is_zero() {
                        return Some(to / from);
                    }
                }
                None
            }
            _ => None,
        }
    }
}
