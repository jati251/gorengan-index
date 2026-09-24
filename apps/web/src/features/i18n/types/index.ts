export type Locale = "id" | "en";

export interface TranslationSchema {
  common: {
    signIn: string;
    signOut: string;
    account: string;
    loadingAccount: string;
    backToMarkets: string;
    openTerminal: string;
    openBoard: string;
    continueWithGoogle: string;
    connecting: string;
    loading: string;
    allMarkets: string;
    status: {
      live: string;
      stale: string;
      reconnecting: string;
      connecting: string;
      offline: string;
    };
    categories: {
      all: string;
      crypto: string;
      fx: string;
      us_stocks: string;
      idx_stocks: string;
    };
  };
  landing: {
    nav: {
      marketView: string;
      about: string;
      faq: string;
      terminal: string;
    };
    hero: {
      eyebrow: string;
      titleMain: string;
      titleAccent: string;
      intro: string;
      openBoard: string;
      openTerminal: string;
      publicNotice: string;
    };
    tape: {
      boardLabel: string;
      featuredTitle: string;
      assetsCount: string;
      waitingForPrice: string;
    };
    market: {
      eyebrow: string;
      title: string;
      authSubtitle: string;
      publicSubtitle: string;
      tabChart: string;
      tabMarkets: string;
      liveStream: string;
      sampleUpdates: string;
      marketSnapshot: string;
      showingFeatured: string;
      openTerminalAll: string;
    };
    about: {
      eyebrow: string;
      title: string;
      desc1: string;
      desc2: string;
      openTerminal: string;
      continueWithGoogle: string;
    };
    faq: {
      eyebrow: string;
      title: string;
      items: Array<{
        question: string;
        answer: string;
      }>;
    };
    footer: {
      brandTagline: string;
      disclaimer: string;
    };
  };
  terminal: {
    railTitle: string;
    marketsCount: string;
    mobileNav: {
      chart: string;
      markets: string;
      intel: string;
    };
    workspace: {
      boardLabel: string;
      marketsHeading: string;
      symbolsCount: string;
      marketSnapshot: string;
    };
  };
  watchlist: {
    tabs: {
      favorites: string;
      all: string;
    };
    trendFilters: {
      all: string;
      gainers: string;
      losers: string;
    };
    searchPlaceholder: string;
    categories: {
      all: string;
      crypto: string;
      fx: string;
      us: string;
      idx: string;
    };
    emptyFavorites: {
      title: string;
      desc: string;
    };
    emptySearch: {
      title: string;
      desc: string;
    };
    favoriteActions: {
      remove: string;
      add: string;
    };
  };
  marketTable: {
    searchPlaceholder: string;
    columns: {
      symbol: string;
      name: string;
      price: string;
      change24h: string;
      high24h: string;
      low24h: string;
      volume24h: string;
      range: string;
    };
    sessionBadges: {
      closed: string;
      holiday: string;
      break: string;
      preMarket: string;
      afterHours: string;
      liveIex: string;
      delayed: string;
    };
    empty: {
      title: string;
      desc: string;
    };
    showingCount: string;
  };
  marketStats: {
    labels: {
      price: string;
      change24h: string;
      high24h: string;
      low24h: string;
      volume24h: string;
      spread24h: string;
      marketBreadth: string;
      gainers: string;
      losers: string;
    };
  };
  intelligence: {
    tabs: {
      orderbook: string;
      stats: string;
      news: string;
    };
    selectedMarket: string;
    sentimentTitle: string;
    orderbook: {
      title: string;
      price: string;
      size: string;
      total: string;
      spread: string;
      connecting: string;
    };
  };
  sentiment: {
    title: string;
    levels: {
      extremeFear: string;
      fear: string;
      neutral: string;
      greed: string;
      extremeGreed: string;
      unavailable: string;
    };
    labels: {
      scaleZero: string;
      scaleFifty: string;
      scaleHundred: string;
      unavailableMsg: string;
      noDataMsg: string;
    };
  };
  news: {
    impact: {
      high: string;
      medium: string;
      low: string;
    };
    sentiment: {
      bull: string;
      bear: string;
      ntrl: string;
    };
    empty: string;
  };
  chart: {
    indicators: {
      ema20: string;
      ema50: string;
    };
    metrics: {
      prevClose: string;
      dayHigh: string;
      dayLow: string;
      vol: string;
      bid: string;
      ask: string;
      spread: string;
      high24h: string;
      low24h: string;
    };
  };
  login: {
    backToMarkets: string;
    workspaceEyebrow: string;
    titleMain: string;
    titleAccent: string;
    description: string;
    continueWithGoogle: string;
    connecting: string;
    footnote: string;
    footerText: string;
    asideTag: string;
    asideTitleMain: string;
    asideTitleAccent: string;
    asideKeywords: string;
    errorExpired: string;
    errorStartFailed: string;
  };
  time: {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
  };
}
