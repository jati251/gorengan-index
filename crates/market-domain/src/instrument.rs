use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct InstrumentId(pub String);

impl InstrumentId {
    pub fn new(s: impl Into<String>) -> Self {
        Self(s.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for InstrumentId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<&str> for InstrumentId {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

impl From<String> for InstrumentId {
    fn from(s: String) -> Self {
        Self(s)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ProviderId(pub String);

impl ProviderId {
    pub fn new(s: impl Into<String>) -> Self {
        Self(s.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for ProviderId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetClass {
    Crypto,
    Fx,
    Metal,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Instrument {
    pub id: InstrumentId,
    pub base: String,
    pub quote: String,
    pub asset_class: AssetClass,
    pub provider: ProviderId,
    pub provider_symbol: String,
    pub price_scale: u32,
    pub quantity_scale: u32,
    pub enabled: bool,
    #[serde(default)]
    pub is_tokenized_metal: bool,
}

impl Instrument {
    pub fn default_universe() -> Vec<Self> {
        vec![
            Self {
                id: InstrumentId::new("BTC-USDT"),
                base: "BTC".into(),
                quote: "USDT".into(),
                asset_class: AssetClass::Crypto,
                provider: ProviderId::new("binance"),
                provider_symbol: "BTCUSDT".into(),
                price_scale: 2,
                quantity_scale: 5,
                enabled: true,
                is_tokenized_metal: false,
            },
            Self {
                id: InstrumentId::new("ETH-USDT"),
                base: "ETH".into(),
                quote: "USDT".into(),
                asset_class: AssetClass::Crypto,
                provider: ProviderId::new("binance"),
                provider_symbol: "ETHUSDT".into(),
                price_scale: 2,
                quantity_scale: 4,
                enabled: true,
                is_tokenized_metal: false,
            },
            Self {
                id: InstrumentId::new("SOL-USDT"),
                base: "SOL".into(),
                quote: "USDT".into(),
                asset_class: AssetClass::Crypto,
                provider: ProviderId::new("binance"),
                provider_symbol: "SOLUSDT".into(),
                price_scale: 2,
                quantity_scale: 3,
                enabled: true,
                is_tokenized_metal: false,
            },
            Self {
                id: InstrumentId::new("BNB-USDT"),
                base: "BNB".into(),
                quote: "USDT".into(),
                asset_class: AssetClass::Crypto,
                provider: ProviderId::new("binance"),
                provider_symbol: "BNBUSDT".into(),
                price_scale: 2,
                quantity_scale: 3,
                enabled: true,
                is_tokenized_metal: false,
            },
            Self {
                id: InstrumentId::new("XRP-USDT"),
                base: "XRP".into(),
                quote: "USDT".into(),
                asset_class: AssetClass::Crypto,
                provider: ProviderId::new("binance"),
                provider_symbol: "XRPUSDT".into(),
                price_scale: 4,
                quantity_scale: 1,
                enabled: true,
                is_tokenized_metal: false,
            },
            Self {
                id: InstrumentId::new("PAXG-USDT"),
                base: "PAXG".into(),
                quote: "USDT".into(),
                asset_class: AssetClass::Metal,
                provider: ProviderId::new("binance"),
                provider_symbol: "PAXGUSDT".into(),
                price_scale: 2,
                quantity_scale: 4,
                enabled: true,
                is_tokenized_metal: true,
            },
        ]
    }
}
