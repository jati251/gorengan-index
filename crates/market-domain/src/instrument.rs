use rust_decimal::Decimal;
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

use std::str::FromStr;

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

impl FromStr for AssetClass {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "crypto" => Ok(AssetClass::Crypto),
            "fx" => Ok(AssetClass::Fx),
            "metal" => Ok(AssetClass::Metal),
            "equity" => Ok(AssetClass::Equity),
            "etf" => Ok(AssetClass::Etf),
            "us_stocks" => Ok(AssetClass::UsStocks),
            "idx_stocks" => Ok(AssetClass::IdxStocks),
            other => Err(format!("Unknown asset class: {other}")),
        }
    }
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
    /// Loads active market instruments directly from PostgreSQL `market_symbols` table.
    pub async fn load_from_db(
        client: &tokio_postgres::Client,
    ) -> Result<Vec<Self>, tokio_postgres::Error> {
        let query = "SELECT id, base, quote, asset_class, provider, provider_symbol, enabled,
                            is_tokenized_metal, pip_size, display_decimals, candle_price_basis
                     FROM market_symbols
                     WHERE enabled = true
                     ORDER BY asset_class, id ASC";

        let rows = client.query(query, &[]).await?;
        let mut instruments = Vec::with_capacity(rows.len());

        for row in rows {
            let id_str: String = row.get("id");
            let base: String = row.get("base");
            let quote: String = row.get("quote");
            let asset_class_str: String = row.get("asset_class");
            let provider_str: String = row.get("provider");
            let provider_symbol: String = row.get("provider_symbol");
            let enabled: bool = row.get("enabled");
            let is_tokenized_metal: bool = row.get("is_tokenized_metal");
            let pip_size: Option<Decimal> = row.get("pip_size");
            let display_decimals_raw: Option<i32> = row.get("display_decimals");
            let candle_price_basis: Option<String> = row.get("candle_price_basis");

            let asset_class = AssetClass::from_str(&asset_class_str).unwrap_or(AssetClass::Crypto);
            let display_decimals = display_decimals_raw.map(|d| d as u32);
            let price_scale = display_decimals.unwrap_or(2);
            let quantity_scale = if asset_class == AssetClass::Crypto { 4 } else { 2 };

            instruments.push(Self {
                id: InstrumentId::new(id_str),
                base,
                quote,
                asset_class,
                provider: ProviderId::new(provider_str),
                provider_symbol,
                price_scale,
                quantity_scale,
                enabled,
                is_tokenized_metal,
                pip_size,
                display_decimals,
                candle_price_basis,
            });
        }

        Ok(instruments)
    }

    /// Helper to connect and load instruments from a PostgreSQL connection string.
    pub async fn load_from_connection_string(
        conn_str: &str,
    ) -> Result<Vec<Self>, tokio_postgres::Error> {
        let (client, connection) = tokio_postgres::connect(conn_str, tokio_postgres::NoTls).await?;
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("PostgreSQL connection error: {e}");
            }
        });
        Self::load_from_db(&client).await
    }

    /// In-memory sample fixtures for unit testing and offline test execution.
    pub fn test_fixtures() -> Vec<Self> {
        vec![
            Self {
                id: InstrumentId::new("BTC-USDT"),
                base: "BTC".into(),
                quote: "USDT".into(),
                asset_class: AssetClass::Crypto,
                provider: ProviderId::new("binance"),
                provider_symbol: "BTCUSDT".into(),
                price_scale: 2,
                quantity_scale: 4,
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
                pip_size: Some(rust_decimal_macros::dec!(0.0001)),
                display_decimals: Some(5),
                candle_price_basis: Some("mid".into()),
            },
            Self {
                id: InstrumentId::new("US:AAPL"),
                base: "AAPL".into(),
                quote: "USD".into(),
                asset_class: AssetClass::UsStocks,
                provider: ProviderId::new("alpaca_iex"),
                provider_symbol: "AAPL".into(),
                price_scale: 2,
                quantity_scale: 2,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(2),
                candle_price_basis: Some("trade".into()),
            },
            Self {
                id: InstrumentId::new("ID:BBCA"),
                base: "BBCA".into(),
                quote: "IDR".into(),
                asset_class: AssetClass::IdxStocks,
                provider: ProviderId::new("idx_delayed"),
                provider_symbol: "BBCA.JK".into(),
                price_scale: 0,
                quantity_scale: 2,
                enabled: true,
                is_tokenized_metal: false,
                pip_size: None,
                display_decimals: Some(0),
                candle_price_basis: Some("trade".into()),
            },
        ]
    }

    /// Fallback alias for test environments
    pub fn default_universe() -> Vec<Self> {
        Self::test_fixtures()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_test_fixtures() {
        let fixtures = Instrument::test_fixtures();
        assert_eq!(fixtures.len(), 5);
        assert_eq!(fixtures[0].id.as_str(), "BTC-USDT");
    }

    #[tokio::test]
    async fn test_load_from_db_if_available() {
        let _ = dotenvy::dotenv();
        if let Ok(db_url) = std::env::var("DATABASE_URL") {
            let res = Instrument::load_from_connection_string(&db_url).await;
            if let Ok(instruments) = res {
                assert!(instruments.len() >= 500, "Expected at least 500 symbols from PostgreSQL, got {}", instruments.len());
                assert!(instruments.iter().any(|i| i.id.as_str() == "BTC-USDT"));
                assert!(instruments.iter().any(|i| i.id.as_str() == "ID:BBCA"));
                assert!(instruments.iter().any(|i| i.id.as_str() == "US:AAPL"));
                assert!(instruments.iter().any(|i| i.id.as_str() == "EUR-USD"));
            }
        }
    }
}
