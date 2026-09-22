use market_domain::{Candle, ProviderId, QuoteTick, TickerState, TradeEvent};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProviderStatusEvent {
    pub provider: ProviderId,
    pub connected: bool,
    pub status: String, // "LIVE", "STALE", "RECONNECTING", "OFFLINE"
    pub last_event_at_ns: i64,
    pub reconnect_count: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum MarketMessage {
    Trade(TradeEvent),
    Quote(QuoteTick),
    Ticker(TickerState),
    Candle(Candle),
    Status(ProviderStatusEvent),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum ClientWsCommand {
    Subscribe { channels: Vec<String> },
    Unsubscribe { channels: Vec<String> },
    Ping,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerWsEvent {
    Ticker { ticker: TickerState },
    FxQuote { quote: QuoteTick },
    Candle { candle: Candle },
    Status { status: ProviderStatusEvent },
    Pong { ts: i64 },
    Subscribed { channels: Vec<String> },
    Unsubscribed { channels: Vec<String> },
    Error { message: String },
}

#[cfg(test)]
mod tests {
    use super::*;
    use market_domain::{InstrumentId, Interval};
    use rust_decimal_macros::dec;

    #[test]
    fn test_message_roundtrip() {
        let p = ProviderId::new("binance");
        let i = InstrumentId::new("BTC-USDT");
        let candle = Candle::new(i, Interval::Sec1, 1_000_000_000, dec!(50000.0), dec!(1.2), p);

        let msg = MarketMessage::Candle(candle.clone());
        let json = serde_json::to_string(&msg).unwrap();
        let parsed: MarketMessage = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed, MarketMessage::Candle(candle));
    }
}
