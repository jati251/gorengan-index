use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::sync::LazyLock;

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
    Equity,
    Etf,
    UsStocks,
    IdxStocks,
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
    #[serde(default)]
    pub pip_size: Option<Decimal>,
    #[serde(default)]
    pub display_decimals: Option<u32>,
    #[serde(default)]
    pub candle_price_basis: Option<String>,
}

static UNIVERSE_JSON: &str = include_str!("instruments.json");

static UNIVERSE: LazyLock<Vec<Instrument>> = LazyLock::new(|| {
    serde_json::from_str(UNIVERSE_JSON).expect("instruments.json must be valid JSON")
});

impl Instrument {
    pub fn default_universe() -> Vec<Self> {
        UNIVERSE.clone()
    }

    pub fn default_crypto_universe() -> Vec<Self> {
        Self::default_universe()
            .into_iter()
            .filter(|i| i.asset_class == AssetClass::Crypto || i.asset_class == AssetClass::Metal)
            .collect()
    }

    pub fn default_fx_universe() -> Vec<Self> {
        Self::default_universe()
            .into_iter()
            .filter(|i| i.asset_class == AssetClass::Fx)
            .collect()
    }

    pub fn default_us_equity_universe() -> Vec<Self> {
        Self::default_universe()
            .into_iter()
            .filter(|i| i.asset_class == AssetClass::UsStocks || i.asset_class == AssetClass::Equity)
            .collect()
    }

    pub fn default_idx_equity_universe() -> Vec<Self> {
        Self::default_universe()
            .into_iter()
            .filter(|i| i.asset_class == AssetClass::IdxStocks)
            .collect()
    }
}
