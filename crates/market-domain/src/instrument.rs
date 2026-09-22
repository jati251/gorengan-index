use rust_decimal::Decimal;
use rust_decimal_macros::dec;
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

impl Instrument {
    pub fn default_universe() -> Vec<Self> {
        let mut universe = Self::default_crypto_universe();
        universe.extend(Self::default_fx_universe());
        universe.extend(Self::default_us_equity_universe());
        universe.extend(Self::default_idx_equity_universe());
        universe
    }

    pub fn default_crypto_universe() -> Vec<Self> {
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
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
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
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
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
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
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
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
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
                pip_size: None,
                display_decimals: Some(4),
                candle_price_basis: Some("trade".into()),
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
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
            },
        ]
    }

    pub fn default_fx_universe() -> Vec<Self> {
        vec![
            Self {
                id: InstrumentId::new("EUR-USD"),
                base: "EUR".into(),
                quote: "USD".into(),
                asset_class: AssetClass::Fx,
                provider: ProviderId::new("interbank"),
                provider_symbol: "EURUSD=X".into(),
                price_scale: 5,
                quantity_scale: 2,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: Some(dec!(0.0001)),
                display_decimals: Some(5),
                candle_price_basis: Some("mid".into()),
            },
            Self {
                id: InstrumentId::new("GBP-USD"),
                base: "GBP".into(),
                quote: "USD".into(),
                asset_class: AssetClass::Fx,
                provider: ProviderId::new("interbank"),
                provider_symbol: "GBPUSD=X".into(),
                price_scale: 5,
                quantity_scale: 2,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: Some(dec!(0.0001)),
                display_decimals: Some(5),
                candle_price_basis: Some("mid".into()),
            },
            Self {
                id: InstrumentId::new("USD-JPY"),
                base: "USD".into(),
                quote: "JPY".into(),
                asset_class: AssetClass::Fx,
                provider: ProviderId::new("interbank"),
                provider_symbol: "USDJPY=X".into(),
                price_scale: 3,
                quantity_scale: 2,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: Some(dec!(0.01)),
                display_decimals: Some(3),
                candle_price_basis: Some("mid".into()),
            },
            Self {
                id: InstrumentId::new("AUD-USD"),
                base: "AUD".into(),
                quote: "USD".into(),
                asset_class: AssetClass::Fx,
                provider: ProviderId::new("interbank"),
                provider_symbol: "AUDUSD=X".into(),
                price_scale: 5,
                quantity_scale: 2,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: Some(dec!(0.0001)),
                display_decimals: Some(5),
                candle_price_basis: Some("mid".into()),
            },
            Self {
                id: InstrumentId::new("USD-CAD"),
                base: "USD".into(),
                quote: "CAD".into(),
                asset_class: AssetClass::Fx,
                provider: ProviderId::new("interbank"),
                provider_symbol: "USDCAD=X".into(),
                price_scale: 5,
                quantity_scale: 2,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: Some(dec!(0.0001)),
                display_decimals: Some(5),
                candle_price_basis: Some("mid".into()),
            },
            Self {
                id: InstrumentId::new("USD-CHF"),
                base: "USD".into(),
                quote: "CHF".into(),
                asset_class: AssetClass::Fx,
                provider: ProviderId::new("interbank"),
                provider_symbol: "USDCHF=X".into(),
                price_scale: 5,
                quantity_scale: 2,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: Some(dec!(0.0001)),
                display_decimals: Some(5),
                candle_price_basis: Some("mid".into()),
            },
            Self {
                id: InstrumentId::new("NZD-USD"),
                base: "NZD".into(),
                quote: "USD".into(),
                asset_class: AssetClass::Fx,
                provider: ProviderId::new("interbank"),
                provider_symbol: "NZDUSD=X".into(),
                price_scale: 5,
                quantity_scale: 2,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: Some(dec!(0.0001)),
                display_decimals: Some(5),
                candle_price_basis: Some("mid".into()),
            },
            Self {
                id: InstrumentId::new("EUR-JPY"),
                base: "EUR".into(),
                quote: "JPY".into(),
                asset_class: AssetClass::Fx,
                provider: ProviderId::new("interbank"),
                provider_symbol: "EURJPY=X".into(),
                price_scale: 3,
                quantity_scale: 2,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: Some(dec!(0.01)),
                display_decimals: Some(3),
                candle_price_basis: Some("mid".into()),
            },
            Self {
                id: InstrumentId::new("GBP-JPY"),
                base: "GBP".into(),
                quote: "JPY".into(),
                asset_class: AssetClass::Fx,
                provider: ProviderId::new("interbank"),
                provider_symbol: "GBPJPY=X".into(),
                price_scale: 3,
                quantity_scale: 2,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: Some(dec!(0.01)),
                display_decimals: Some(3),
                candle_price_basis: Some("mid".into()),
            },
            Self {
                id: InstrumentId::new("USD-IDR"),
                base: "USD".into(),
                quote: "IDR".into(),
                asset_class: AssetClass::Fx,
                provider: ProviderId::new("interbank"),
                provider_symbol: "USDIDR=X".into(),
                price_scale: 2,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: Some(dec!(1.0)),
                display_decimals: Some(2),
                candle_price_basis: Some("mid".into()),
            },
        ]
    }

    pub fn default_us_equity_universe() -> Vec<Self> {
        vec![
            Self {
                id: InstrumentId::new("US:AAPL"),
                base: "AAPL".into(),
                quote: "USD".into(),
                asset_class: AssetClass::UsStocks,
                provider: ProviderId::new("alpaca_iex"),
                provider_symbol: "AAPL".into(),
                price_scale: 2,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("US:MSFT"),
                base: "MSFT".into(),
                quote: "USD".into(),
                asset_class: AssetClass::UsStocks,
                provider: ProviderId::new("alpaca_iex"),
                provider_symbol: "MSFT".into(),
                price_scale: 2,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("US:NVDA"),
                base: "NVDA".into(),
                quote: "USD".into(),
                asset_class: AssetClass::UsStocks,
                provider: ProviderId::new("alpaca_iex"),
                provider_symbol: "NVDA".into(),
                price_scale: 2,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("US:TSLA"),
                base: "TSLA".into(),
                quote: "USD".into(),
                asset_class: AssetClass::UsStocks,
                provider: ProviderId::new("alpaca_iex"),
                provider_symbol: "TSLA".into(),
                price_scale: 2,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("US:AMZN"),
                base: "AMZN".into(),
                quote: "USD".into(),
                asset_class: AssetClass::UsStocks,
                provider: ProviderId::new("alpaca_iex"),
                provider_symbol: "AMZN".into(),
                price_scale: 2,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("US:META"),
                base: "META".into(),
                quote: "USD".into(),
                asset_class: AssetClass::UsStocks,
                provider: ProviderId::new("alpaca_iex"),
                provider_symbol: "META".into(),
                price_scale: 2,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("US:GOOGL"),
                base: "GOOGL".into(),
                quote: "USD".into(),
                asset_class: AssetClass::UsStocks,
                provider: ProviderId::new("alpaca_iex"),
                provider_symbol: "GOOGL".into(),
                price_scale: 2,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("US:AMD"),
                base: "AMD".into(),
                quote: "USD".into(),
                asset_class: AssetClass::UsStocks,
                provider: ProviderId::new("alpaca_iex"),
                provider_symbol: "AMD".into(),
                price_scale: 2,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("US:SPY"),
                base: "SPY".into(),
                quote: "USD".into(),
                asset_class: AssetClass::UsStocks,
                provider: ProviderId::new("alpaca_iex"),
                provider_symbol: "SPY".into(),
                price_scale: 2,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("US:QQQ"),
                base: "QQQ".into(),
                quote: "USD".into(),
                asset_class: AssetClass::UsStocks,
                provider: ProviderId::new("alpaca_iex"),
                provider_symbol: "QQQ".into(),
                price_scale: 2,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
            },
        ]
    }

    pub fn default_idx_equity_universe() -> Vec<Self> {
        vec![
            Self {
                id: InstrumentId::new("ID:BBCA"),
                base: "BBCA".into(),
                quote: "IDR".into(),
                asset_class: AssetClass::IdxStocks,
                provider: ProviderId::new("idx_delayed"),
                provider_symbol: "BBCA.JK".into(),
                price_scale: 0,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(0),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("ID:BBRI"),
                base: "BBRI".into(),
                quote: "IDR".into(),
                asset_class: AssetClass::IdxStocks,
                provider: ProviderId::new("idx_delayed"),
                provider_symbol: "BBRI.JK".into(),
                price_scale: 0,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(0),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("ID:BMRI"),
                base: "BMRI".into(),
                quote: "IDR".into(),
                asset_class: AssetClass::IdxStocks,
                provider: ProviderId::new("idx_delayed"),
                provider_symbol: "BMRI.JK".into(),
                price_scale: 0,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(0),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("ID:BBNI"),
                base: "BBNI".into(),
                quote: "IDR".into(),
                asset_class: AssetClass::IdxStocks,
                provider: ProviderId::new("idx_delayed"),
                provider_symbol: "BBNI.JK".into(),
                price_scale: 0,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(0),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("ID:TLKM"),
                base: "TLKM".into(),
                quote: "IDR".into(),
                asset_class: AssetClass::IdxStocks,
                provider: ProviderId::new("idx_delayed"),
                provider_symbol: "TLKM.JK".into(),
                price_scale: 0,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(0),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("ID:ASII"),
                base: "ASII".into(),
                quote: "IDR".into(),
                asset_class: AssetClass::IdxStocks,
                provider: ProviderId::new("idx_delayed"),
                provider_symbol: "ASII.JK".into(),
                price_scale: 0,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(0),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("ID:ANTM"),
                base: "ANTM".into(),
                quote: "IDR".into(),
                asset_class: AssetClass::IdxStocks,
                provider: ProviderId::new("idx_delayed"),
                provider_symbol: "ANTM.JK".into(),
                price_scale: 0,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(0),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("ID:GOTO"),
                base: "GOTO".into(),
                quote: "IDR".into(),
                asset_class: AssetClass::IdxStocks,
                provider: ProviderId::new("idx_delayed"),
                provider_symbol: "GOTO.JK".into(),
                price_scale: 0,
                quantity_scale: 0,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(0),
                candle_price_basis: Some("trade".into()),
            },
        ]
    }
}
