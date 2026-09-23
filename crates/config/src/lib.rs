use serde::{Deserialize, Serialize};
use std::env;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Failed to load configuration: {0}")]
    Load(#[from] config::ConfigError),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub nats_url: String,
    pub questdb_ilp_host: String,
    pub questdb_ilp_port: u16,
    pub questdb_http_url: String,
    pub valkey_url: String,
    pub gateway_port: u16,
    pub universe: Vec<String>,
    pub hot_symbols: Vec<String>,
    pub candle_1s_retention_days: u32,
    pub binance_ws_url: String,
    pub binance_rest_url: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            nats_url: "nats://127.0.0.1:4222".into(),
            questdb_ilp_host: "127.0.0.1".into(),
            questdb_ilp_port: 9009,
            questdb_http_url: "http://127.0.0.1:9000".into(),
            valkey_url: "redis://127.0.0.1:6379".into(),
            gateway_port: 9001,
            universe: market_domain::Instrument::default_universe()
                .into_iter()
                .map(|i| i.id.to_string())
                .collect(),
            hot_symbols: vec![
                "BTC-USDT".into(),
                "ETH-USDT".into(),
                "SOL-USDT".into(),
                "PAXG-USDT".into(),
                "EUR-USD".into(),
                "GBP-USD".into(),
                "USD-JPY".into(),
                "US:AAPL".into(),
                "US:NVDA".into(),
                "ID:BBCA".into(),
                "ID:BBRI".into(),
            ],
            candle_1s_retention_days: 30,
            binance_ws_url: "wss://data-stream.binance.vision:9443".into(),
            binance_rest_url: "https://data-api.binance.vision".into(),
        }
    }
}

impl AppConfig {
    pub fn load() -> Result<Self, ConfigError> {
        let _ = dotenvy::dotenv();

        let mut cfg = Self::default();

        if let Ok(v) = env::var("NATS_URL") {
            cfg.nats_url = v;
        }
        if let Ok(v) = env::var("QUESTDB_ILP_HOST") {
            cfg.questdb_ilp_host = v;
        }
        if let Ok(v) = env::var("QUESTDB_ILP_PORT") {
            if let Ok(p) = v.parse() {
                cfg.questdb_ilp_port = p;
            }
        }
        if let Ok(v) = env::var("QUESTDB_HTTP_URL") {
            cfg.questdb_http_url = v;
        }
        if let Ok(v) = env::var("VALKEY_URL") {
            cfg.valkey_url = v;
        }
        if let Ok(v) = env::var("GATEWAY_PORT") {
            if let Ok(p) = v.parse() {
                cfg.gateway_port = p;
            }
        }
        if let Ok(v) = env::var("BINANCE_WS_URL") {
            cfg.binance_ws_url = v;
        }
        if let Ok(v) = env::var("BINANCE_REST_URL") {
            cfg.binance_rest_url = v;
        }
        if let Ok(v) = env::var("UNIVERSE").or_else(|_| env::var("MARKET_UNIVERSE")) {
            cfg.universe = v.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        }

        Ok(cfg)
    }
}
