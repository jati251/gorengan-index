use std::collections::HashMap;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use market_domain::{Instrument, InstrumentId, ProviderId, TickerState, TradeEvent, TradeSide};

#[derive(Debug, Deserialize)]
pub struct BinanceEnvelope {
    #[allow(dead_code)]
    pub stream: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct BinanceTradePayload {
    #[serde(rename = "s")]
    pub symbol: String,
    #[serde(rename = "t")]
    pub trade_id: i64,
    #[serde(rename = "p")]
    pub price: String,
    #[serde(rename = "q")]
    pub quantity: String,
    #[serde(rename = "T")]
    pub trade_time_ms: i64,
    #[serde(rename = "m")]
    pub is_buyer_maker: bool,
}

#[derive(Debug, Deserialize)]
pub struct BinanceTickerPayload {
    #[serde(rename = "s")]
    pub symbol: String,
    #[serde(rename = "c")]
    pub last_price: String,
    #[serde(rename = "b")]
    pub bid_price: String,
    #[serde(rename = "a")]
    pub ask_price: String,
    #[serde(rename = "o")]
    pub open_price: String,
    #[serde(rename = "h")]
    pub high_price: String,
    #[serde(rename = "l")]
    pub low_price: String,
    #[serde(rename = "v")]
    pub volume: String,
    #[serde(rename = "q")]
    pub quote_volume: String,
    #[serde(rename = "p")]
    pub price_change: String,
    #[serde(rename = "P")]
    pub price_change_percent: String,
    #[serde(rename = "E")]
    pub event_time_ms: i64,
}

#[derive(Debug, Clone)]
pub struct BinanceNormalizer {
    /// Maps Binance symbol e.g. "BTCUSDT" -> Canonical InstrumentId e.g. "BTC-USDT"
    symbol_map: HashMap<String, InstrumentId>,
    provider_id: ProviderId,
}

impl BinanceNormalizer {
    pub fn new(instruments: &[Instrument]) -> Self {
        let mut symbol_map = HashMap::new();
        for inst in instruments {
            symbol_map.insert(inst.provider_symbol.to_uppercase(), inst.id.clone());
        }

        Self {
            symbol_map,
            provider_id: ProviderId::new("binance"),
        }
    }

    pub fn map_symbol(&self, raw_symbol: &str) -> Option<&InstrumentId> {
        self.symbol_map.get(&raw_symbol.to_uppercase())
    }

    pub fn normalize_trade(&self, payload: &BinanceTradePayload) -> Option<TradeEvent> {
        let instrument = self.map_symbol(&payload.symbol)?.clone();
        let price = Decimal::from_str(&payload.price).ok()?;
        let quantity = Decimal::from_str(&payload.quantity).ok()?;

        let event_time_ns = payload.trade_time_ms * 1_000_000;
        let ingest_time_ns = Utc::now().timestamp_nanos_opt().unwrap_or(event_time_ns);

        // In Binance spot: m (isBuyerMaker) == true means the buyer was maker, taker was seller (Sell)
        let side = if payload.is_buyer_maker {
            Some(TradeSide::Sell)
        } else {
            Some(TradeSide::Buy)
        };

        Some(TradeEvent {
            event_id: format!("{}-{}", payload.symbol, payload.trade_id),
            provider: self.provider_id.clone(),
            instrument,
            event_time_ns,
            ingest_time_ns,
            price,
            quantity,
            side,
        })
    }

    pub fn normalize_ticker(&self, payload: &BinanceTickerPayload) -> Option<TickerState> {
        let instrument = self.map_symbol(&payload.symbol)?.clone();
        let price = Decimal::from_str(&payload.last_price).ok()?;
        let bid = Decimal::from_str(&payload.bid_price).ok();
        let ask = Decimal::from_str(&payload.ask_price).ok();
        let open_24h = Decimal::from_str(&payload.open_price).ok();
        let high_24h = Decimal::from_str(&payload.high_price).ok();
        let low_24h = Decimal::from_str(&payload.low_price).ok();
        let volume_24h = Decimal::from_str(&payload.volume).ok();
        let quote_volume_24h = Decimal::from_str(&payload.quote_volume).ok();
        let change_24h = Decimal::from_str(&payload.price_change).ok();
        let change_percent_24h = Decimal::from_str(&payload.price_change_percent).ok();

        let updated_at_ns = payload.event_time_ms * 1_000_000;

        let (mid, spread, spread_bps) = match (bid, ask) {
            (Some(b), Some(a)) => {
                let m = (b + a) / Decimal::from(2);
                let s = a - b;
                let bps = if m.is_zero() { Decimal::ZERO } else { (s / m) * Decimal::from(10_000) };
                (Some(m), Some(s), Some(bps))
            }
            _ => (None, None, None),
        };

        Some(TickerState {
            instrument,
            provider: self.provider_id.clone(),
            price,
            bid,
            ask,
            mid,
            spread,
            spread_bps,
            open_24h,
            high_24h,
            low_24h,
            volume_24h,
            quote_volume_24h,
            change_24h,
            change_percent_24h,
            updated_at_ns,
            session_state: Some("open".to_string()),
            session_segment: Some("REGULAR".to_string()),
            data_quality: Some("realtime_consolidated".to_string()),
            market: Some("CRYPTO".to_string()),
            currency: Some("USDT".to_string()),
            previous_close: None,
        })
    }

    /// Parse incoming raw text frame from Binance WebSocket stream
    pub fn parse_frame(&self, text: &str) -> Option<NormalizedPayload> {
        let envelope: BinanceEnvelope = serde_json::from_str(text).ok()?;
        let event_type = envelope.data.get("e")?.as_str()?;

        match event_type {
            "trade" => {
                let trade_payload: BinanceTradePayload = serde_json::from_value(envelope.data).ok()?;
                self.normalize_trade(&trade_payload).map(NormalizedPayload::Trade)
            }
            "24hrTicker" => {
                let ticker_payload: BinanceTickerPayload = serde_json::from_value(envelope.data).ok()?;
                self.normalize_ticker(&ticker_payload).map(NormalizedPayload::Ticker)
            }
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NormalizedPayload {
    Trade(TradeEvent),
    Ticker(TickerState),
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn test_normalize_trade_payload() {
        let instruments = Instrument::default_universe();
        let normalizer = BinanceNormalizer::new(&instruments);

        let json = r#"{
            "stream": "btcusdt@trade",
            "data": {
                "e": "trade",
                "E": 1672515782136,
                "s": "BTCUSDT",
                "t": 12345678,
                "p": "68500.50",
                "q": "0.12500000",
                "b": 88,
                "a": 50,
                "T": 1672515782123,
                "m": false,
                "M": true
            }
        }"#;

        let parsed = normalizer.parse_frame(json).expect("should parse trade");
        match parsed {
            NormalizedPayload::Trade(trade) => {
                assert_eq!(trade.instrument.as_str(), "BTC-USDT");
                assert_eq!(trade.provider.as_str(), "binance");
                assert_eq!(trade.event_id, "BTCUSDT-12345678");
                assert_eq!(trade.price, dec!(68500.50));
                assert_eq!(trade.quantity, dec!(0.125));
                assert_eq!(trade.event_time_ns, 1672515782123 * 1_000_000);
                assert_eq!(trade.side, Some(TradeSide::Buy));
            }
            _ => panic!("Expected Trade variant"),
        }
    }

    #[test]
    fn test_normalize_ticker_payload() {
        let instruments = Instrument::default_universe();
        let normalizer = BinanceNormalizer::new(&instruments);

        let json = r#"{
            "stream": "ethusdt@ticker",
            "data": {
                "e": "24hrTicker",
                "E": 1672515782000,
                "s": "ETHUSDT",
                "p": "50.00",
                "P": "2.50",
                "w": "2020.00",
                "x": "1980.00",
                "c": "2050.00",
                "Q": "0.50",
                "b": "2049.50",
                "B": "10.0",
                "a": "2050.50",
                "A": "8.0",
                "o": "2000.00",
                "h": "2100.00",
                "l": "1970.00",
                "v": "50000.00",
                "q": "102500000.00",
                "O": 1672429382000,
                "C": 1672515782000,
                "F": 100,
                "L": 200,
                "n": 101
            }
        }"#;

        let parsed = normalizer.parse_frame(json).expect("should parse ticker");
        match parsed {
            NormalizedPayload::Ticker(ticker) => {
                assert_eq!(ticker.instrument.as_str(), "ETH-USDT");
                assert_eq!(ticker.provider.as_str(), "binance");
                assert_eq!(ticker.price, dec!(2050.00));
                assert_eq!(ticker.bid, Some(dec!(2049.50)));
                assert_eq!(ticker.ask, Some(dec!(2050.50)));
                assert_eq!(ticker.open_24h, Some(dec!(2000.00)));
                assert_eq!(ticker.high_24h, Some(dec!(2100.00)));
                assert_eq!(ticker.low_24h, Some(dec!(1970.00)));
                assert_eq!(ticker.volume_24h, Some(dec!(50000.00)));
                assert_eq!(ticker.change_24h, Some(dec!(50.00)));
                assert_eq!(ticker.change_percent_24h, Some(dec!(2.50)));
            }
            _ => panic!("Expected Ticker variant"),
        }
    }
}
