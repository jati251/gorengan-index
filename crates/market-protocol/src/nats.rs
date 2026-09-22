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

    /// e.g. "market.fx.quote.interbank.EUR-USD"
    pub fn fx_quote(provider: &ProviderId, instrument: &InstrumentId) -> String {
        format!("market.fx.quote.{}.{}", provider.as_str(), instrument.as_str())
    }

    /// Pattern to subscribe to all FX quotes: "market.fx.quote.*.*"
    pub fn all_fx_quotes() -> &'static str {
        "market.fx.quote.*.*"
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

    /// e.g. "equity.snapshot.us.AAPL" or "equity.snapshot.id.BBCA"
    pub fn equity_snapshot(market: &str, symbol: &str) -> String {
        format!("equity.snapshot.{}.{}", market.to_lowercase(), symbol)
    }

    /// e.g. "equity.session.us" or "equity.session.id"
    pub fn equity_session(market: &str) -> String {
        format!("equity.session.{}", market.to_lowercase())
    }

    pub fn all_equity_sessions() -> &'static str {
        "equity.session.*"
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
