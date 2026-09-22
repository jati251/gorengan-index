use market_domain::{InstrumentId, Interval, ProviderId};

pub struct NatsSubjects;

impl NatsSubjects {
    /// e.g. "market.trade.binance.BTC-USDT"
    pub fn trade(provider: &ProviderId, instrument: &InstrumentId) -> String {
        format!("market.trade.{}.{}", provider.as_str(), instrument.as_str())
    }

    /// Pattern to subscribe to all trades from all providers: "market.trade.*.*"
    pub fn all_trades() -> &'static str {
        "market.trade.*.*"
    }

    /// Pattern to subscribe to all trades for a specific provider: "market.trade.binance.*"
    pub fn provider_trades(provider: &ProviderId) -> String {
        format!("market.trade.{}.*", provider.as_str())
    }

    /// e.g. "market.ticker.binance.BTC-USDT"
    pub fn ticker(provider: &ProviderId, instrument: &InstrumentId) -> String {
        format!("market.ticker.{}.{}", provider.as_str(), instrument.as_str())
    }

    /// Pattern to subscribe to all tickers: "market.ticker.*.*"
    pub fn all_tickers() -> &'static str {
        "market.ticker.*.*"
    }

    /// e.g. "market.candle.1s.BTC-USDT"
    pub fn candle(interval: Interval, instrument: &InstrumentId) -> String {
        format!("market.candle.{}.{}", interval.as_str(), instrument.as_str())
    }

    /// Pattern to subscribe to candles of an interval: "market.candle.1s.*"
    pub fn interval_candles(interval: Interval) -> String {
        format!("market.candle.{}.*", interval.as_str())
    }

    /// e.g. "market.status.binance"
    pub fn provider_status(provider: &ProviderId) -> String {
        format!("market.status.{}", provider.as_str())
    }

    pub fn all_statuses() -> &'static str {
        "market.status.*"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subject_formatting() {
        let p = ProviderId::new("binance");
        let i = InstrumentId::new("BTC-USDT");

        assert_eq!(
            NatsSubjects::trade(&p, &i),
            "market.trade.binance.BTC-USDT"
        );
        assert_eq!(
            NatsSubjects::ticker(&p, &i),
            "market.ticker.binance.BTC-USDT"
        );
        assert_eq!(
            NatsSubjects::candle(Interval::Sec1, &i),
            "market.candle.1s.BTC-USDT"
        );
        assert_eq!(
            NatsSubjects::candle(Interval::Min1, &i),
            "market.candle.1m.BTC-USDT"
        );
        assert_eq!(
            NatsSubjects::provider_status(&p),
            "market.status.binance"
        );
    }
}
