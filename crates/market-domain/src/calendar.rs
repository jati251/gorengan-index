use crate::quote::MarketSessionState;
use chrono::{DateTime, Datelike, NaiveDate, NaiveTime, Timelike, Utc, Weekday};
use chrono_tz::{America::New_York, Asia::Jakarta};

pub trait MarketCalendar: Send + Sync {
    fn state_at(&self, timestamp: DateTime<Utc>) -> MarketSessionState;
    fn next_transition(&self, timestamp: DateTime<Utc>) -> Option<DateTime<Utc>>;
    fn session_segment(&self, timestamp: DateTime<Utc>) -> Option<String>;
}

pub struct UsMarketCalendar;

impl UsMarketCalendar {
    pub fn new() -> Self {
        Self
    }

    /// Check if a given date is a known US stock market holiday (NYSE/NASDAQ)
    pub fn is_holiday(date: NaiveDate) -> bool {
        let (_y, m, d) = (date.year(), date.month(), date.day());
        // New Year's Day
        if m == 1 && d == 1 {
            return true;
        }
        // Independence Day (July 4)
        if m == 7 && d == 4 {
            return true;
        }
        // Juneteenth (June 19)
        if m == 6 && d == 19 {
            return true;
        }
        // Christmas Day (Dec 25)
        if m == 12 && d == 25 {
            return true;
        }
        // Thanksgiving (4th Thursday in November)
        if m == 11 && date.weekday() == Weekday::Thu && (22..=28).contains(&d) {
            return true;
        }
        // Labor Day (1st Monday in September)
        if m == 9 && date.weekday() == Weekday::Mon && d <= 7 {
            return true;
        }
        // Memorial Day (Last Monday in May)
        if m == 5 && date.weekday() == Weekday::Mon && d >= 25 {
            return true;
        }
        // MLK Day (3rd Monday in January)
        if m == 1 && date.weekday() == Weekday::Mon && (15..=21).contains(&d) {
            return true;
        }
        // Washington's Birthday (3rd Monday in February)
        if m == 2 && date.weekday() == Weekday::Mon && (15..=21).contains(&d) {
            return true;
        }
        false
    }
}

impl Default for UsMarketCalendar {
    fn default() -> Self {
        Self::new()
    }
}

impl MarketCalendar for UsMarketCalendar {
    fn state_at(&self, timestamp: DateTime<Utc>) -> MarketSessionState {
        let et = timestamp.with_timezone(&New_York);
        let weekday = et.weekday();

        // Weekend
        if weekday == Weekday::Sat || weekday == Weekday::Sun {
            return MarketSessionState::Closed;
        }

        // Holiday
        if Self::is_holiday(et.date_naive()) {
            return MarketSessionState::Holiday;
        }

        let time = et.time();
        let pre_market_open = NaiveTime::from_hms_opt(4, 0, 0).unwrap();
        let regular_open = NaiveTime::from_hms_opt(9, 30, 0).unwrap();
        let regular_close = NaiveTime::from_hms_opt(16, 0, 0).unwrap();
        let after_hours_close = NaiveTime::from_hms_opt(20, 0, 0).unwrap();

        if time >= regular_open && time < regular_close {
            MarketSessionState::Regular
        } else if time >= pre_market_open && time < regular_open {
            MarketSessionState::PreMarket
        } else if time >= regular_close && time < after_hours_close {
            MarketSessionState::AfterHours
        } else {
            MarketSessionState::Closed
        }
    }

    fn next_transition(&self, timestamp: DateTime<Utc>) -> Option<DateTime<Utc>> {
        let mut check = timestamp;
        let initial_state = self.state_at(check);

        // Advance in 1-minute steps up to 7 days to find state change
        for _ in 0..(7 * 24 * 60) {
            check += chrono::Duration::minutes(1);
            if self.state_at(check) != initial_state {
                // Round to minute
                let naive = check.naive_utc();
                let rounded = naive
                    .date()
                    .and_hms_opt(naive.hour(), naive.minute(), 0)
                    .unwrap();
                return Some(DateTime::from_naive_utc_and_offset(rounded, Utc));
            }
        }
        None
    }

    fn session_segment(&self, timestamp: DateTime<Utc>) -> Option<String> {
        match self.state_at(timestamp) {
            MarketSessionState::Regular => Some("REGULAR".to_string()),
            MarketSessionState::PreMarket => Some("PRE_MARKET".to_string()),
            MarketSessionState::AfterHours => Some("AFTER_HOURS".to_string()),
            _ => None,
        }
    }
}

pub struct IdxMarketCalendar;

impl IdxMarketCalendar {
    pub fn new() -> Self {
        Self
    }

    /// Check if a given date is an Indonesian public holiday or collective leave
    pub fn is_holiday(date: NaiveDate) -> bool {
        let (m, d) = (date.month(), date.day());
        // New Year (Jan 1)
        if m == 1 && d == 1 {
            return true;
        }
        // Labor Day (May 1)
        if m == 5 && d == 1 {
            return true;
        }
        // Independence Day (Aug 17)
        if m == 8 && d == 17 {
            return true;
        }
        // Christmas (Dec 25)
        if m == 12 && d == 25 {
            return true;
        }
        false
    }
}

impl Default for IdxMarketCalendar {
    fn default() -> Self {
        Self::new()
    }
}

impl MarketCalendar for IdxMarketCalendar {
    fn state_at(&self, timestamp: DateTime<Utc>) -> MarketSessionState {
        let wib = timestamp.with_timezone(&Jakarta);
        let weekday = wib.weekday();

        // Weekend
        if weekday == Weekday::Sat || weekday == Weekday::Sun {
            return MarketSessionState::Closed;
        }

        // Holiday
        if Self::is_holiday(wib.date_naive()) {
            return MarketSessionState::Holiday;
        }

        let time = wib.time();
        let session1_open = NaiveTime::from_hms_opt(9, 0, 0).unwrap();

        let (session1_close, session2_open) = if weekday == Weekday::Fri {
            // Friday session schedule
            (
                NaiveTime::from_hms_opt(11, 30, 0).unwrap(),
                NaiveTime::from_hms_opt(14, 0, 0).unwrap(),
            )
        } else {
            // Monday - Thursday session schedule
            (
                NaiveTime::from_hms_opt(12, 0, 0).unwrap(),
                NaiveTime::from_hms_opt(13, 30, 0).unwrap(),
            )
        };

        let session2_close = NaiveTime::from_hms_opt(16, 0, 0).unwrap();

        if (time >= session1_open && time < session1_close)
            || (time >= session2_open && time < session2_close)
        {
            MarketSessionState::Regular
        } else if time >= session1_close && time < session2_open {
            MarketSessionState::Break
        } else {
            MarketSessionState::Closed
        }
    }

    fn next_transition(&self, timestamp: DateTime<Utc>) -> Option<DateTime<Utc>> {
        let mut check = timestamp;
        let initial_state = self.state_at(check);

        for _ in 0..(7 * 24 * 60) {
            check += chrono::Duration::minutes(1);
            if self.state_at(check) != initial_state {
                let naive = check.naive_utc();
                let rounded = naive
                    .date()
                    .and_hms_opt(naive.hour(), naive.minute(), 0)
                    .unwrap();
                return Some(DateTime::from_naive_utc_and_offset(rounded, Utc));
            }
        }
        None
    }

    fn session_segment(&self, timestamp: DateTime<Utc>) -> Option<String> {
        let wib = timestamp.with_timezone(&Jakarta);
        let weekday = wib.weekday();
        if weekday == Weekday::Sat || weekday == Weekday::Sun {
            return None;
        }

        let time = wib.time();
        let session1_open = NaiveTime::from_hms_opt(9, 0, 0).unwrap();
        let (session1_close, session2_open) = if weekday == Weekday::Fri {
            (
                NaiveTime::from_hms_opt(11, 30, 0).unwrap(),
                NaiveTime::from_hms_opt(14, 0, 0).unwrap(),
            )
        } else {
            (
                NaiveTime::from_hms_opt(12, 0, 0).unwrap(),
                NaiveTime::from_hms_opt(13, 30, 0).unwrap(),
            )
        };
        let session2_close = NaiveTime::from_hms_opt(16, 0, 0).unwrap();

        if time >= session1_open && time < session1_close {
            Some("SESSION_1".to_string())
        } else if time >= session1_close && time < session2_open {
            Some("BREAK".to_string())
        } else if time >= session2_open && time < session2_close {
            Some("SESSION_2".to_string())
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_us_market_calendar() {
        let cal = UsMarketCalendar::new();

        // Wednesday 2026-09-23 10:00 AM EDT (14:00 UTC) -> Regular
        let dt_regular = Utc.with_ymd_and_hms(2026, 9, 23, 14, 0, 0).unwrap();
        assert_eq!(cal.state_at(dt_regular), MarketSessionState::Regular);
        assert_eq!(cal.session_segment(dt_regular), Some("REGULAR".into()));

        // Wednesday 2026-09-23 08:00 AM EDT (12:00 UTC) -> PreMarket
        let dt_pre = Utc.with_ymd_and_hms(2026, 9, 23, 12, 0, 0).unwrap();
        assert_eq!(cal.state_at(dt_pre), MarketSessionState::PreMarket);

        // Wednesday 2026-09-23 05:00 PM EDT (21:00 UTC) -> AfterHours
        let dt_after = Utc.with_ymd_and_hms(2026, 9, 23, 21, 0, 0).unwrap();
        assert_eq!(cal.state_at(dt_after), MarketSessionState::AfterHours);

        // Saturday 2026-09-26 12:00 PM EDT -> Closed
        let dt_weekend = Utc.with_ymd_and_hms(2026, 9, 26, 16, 0, 0).unwrap();
        assert_eq!(cal.state_at(dt_weekend), MarketSessionState::Closed);
    }

    #[test]
    fn test_idx_market_calendar() {
        let cal = IdxMarketCalendar::new();

        // Wednesday 2026-09-23 10:00 AM WIB (03:00 UTC) -> Regular Session 1
        let dt_s1 = Utc.with_ymd_and_hms(2026, 9, 23, 3, 0, 0).unwrap();
        assert_eq!(cal.state_at(dt_s1), MarketSessionState::Regular);
        assert_eq!(cal.session_segment(dt_s1), Some("SESSION_1".into()));

        // Wednesday 2026-09-23 12:30 PM WIB (05:30 UTC) -> Break
        let dt_break = Utc.with_ymd_and_hms(2026, 9, 23, 5, 30, 0).unwrap();
        assert_eq!(cal.state_at(dt_break), MarketSessionState::Break);
        assert_eq!(cal.session_segment(dt_break), Some("BREAK".into()));

        // Wednesday 2026-09-23 02:00 PM WIB (07:00 UTC) -> Regular Session 2
        let dt_s2 = Utc.with_ymd_and_hms(2026, 9, 23, 7, 0, 0).unwrap();
        assert_eq!(cal.state_at(dt_s2), MarketSessionState::Regular);
        assert_eq!(cal.session_segment(dt_s2), Some("SESSION_2".into()));

        // Wednesday 2026-09-23 08:00 PM WIB (13:00 UTC) -> Closed
        let dt_closed = Utc.with_ymd_and_hms(2026, 9, 23, 13, 0, 0).unwrap();
        assert_eq!(cal.state_at(dt_closed), MarketSessionState::Closed);
    }
}
