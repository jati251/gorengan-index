import type { TranslationSchema } from "../types";

export const en: TranslationSchema = {
  common: {
    signIn: "Sign in",
    signOut: "Sign out",
    account: "Account",
    loadingAccount: "Loading account…",
    backToMarkets: "Back to markets",
    openTerminal: "Open terminal",
    openBoard: "Open board",
    continueWithGoogle: "Continue with Google",
    connecting: "Connecting…",
    loading: "Loading…",
    allMarkets: "All Markets",
    status: {
      live: "Live",
      stale: "Stale",
      reconnecting: "Reconnecting",
      connecting: "Connecting",
      offline: "Offline",
    },
    categories: {
      all: "All",
      crypto: "Crypto",
      fx: "Forex",
      us_stocks: "US Stocks",
      idx_stocks: "IDX Stocks",
    },
  },
  landing: {
    nav: {
      marketView: "Market view",
      about: "About",
      faq: "FAQ",
      terminal: "Terminal",
    },
    hero: {
      eyebrow: "GOR / INDEX • MARKET BOARD",
      titleMain: "Check the",
      titleAccent: "board.",
      intro:
        "Screener for volatile IDX stocks, crypto, forex, and US stocks in one place. Real-time market board with live candlestick charts and financial intelligence.",
      openBoard: "Open board",
      openTerminal: "Open terminal",
      publicNotice: "Public view · prices sampled every 5 seconds.",
    },
    tape: {
      boardLabel: "THE BOARD",
      featuredTitle: "Featured Markets (2 per Category)",
      assetsCount: "{count} assets",
      waitingForPrice: "Waiting for price",
    },
    market: {
      eyebrow: "Market view",
      title: "On the board",
      authSubtitle: "Your market workspace is ready.",
      publicSubtitle: "Public quotes sampled every 5 seconds.",
      tabChart: "Chart",
      tabMarkets: "Markets",
      liveStream: "Live stream",
      sampleUpdates: "5s updates",
      marketSnapshot: "Market snapshot",
      showingFeatured: "Showing 2 featured assets per asset class ({count} total)",
      openTerminalAll: "Open Terminal for all {count} markets",
    },
    about: {
      eyebrow: "The workspace",
      title: "Keep your eye on the board.",
      desc1:
        "Pin the symbols you follow. Check the chart. Read the news. Then get back to your day.",
      desc2:
        "The board is open to everyone. Sign in to keep a watchlist and open the full terminal.",
      openTerminal: "Open your terminal",
      continueWithGoogle: "Continue with Google",
    },
    faq: {
      eyebrow: "Knowledge Base • Q&A",
      title: "Frequently Asked Questions (FAQ)",
      items: [
        {
          question: "What is Gorengan Index?",
          answer:
            "Gorengan Index is a real-time financial market screener and terminal designed specifically to track volatile & active stocks on the Indonesia Stock Exchange (IDX/IHSG), global crypto assets (Bitcoin, Ethereum, Solana), and forex pairs in one high-speed retro arcade interface.",
        },
        {
          question: "What is a 'saham gorengan' and how does screening work?",
          answer:
            "'Saham gorengan' is an Indonesian market term for small-to-mid cap stocks characterized by high volatility and rapid trading volume. Gorengan Index monitors intraday volume surges, 24-hour price momentum, and live order flow dynamics to help traders and scalpers spot emerging opportunities.",
        },
        {
          question: "Is market price data provided in real-time?",
          answer:
            "Yes! Price data is streamed directly using high-throughput WebSockets. Public mode samples quotes every 5 seconds, while authenticated users enjoy zero-delay live tick streaming.",
        },
        {
          question: "Which financial asset classes are supported?",
          answer:
            "Gorengan Index provides comprehensive multi-asset coverage: Indonesian Equities (IDX tickers such as BBCA, BBRI, GOTO, BUMI, CUAN, PTRO), Cryptocurrencies (BTC, ETH, SOL, PEPE, DOGE), Foreign Exchange (USD/IDR, EUR/USD, GBP/USD), and US Equities (AAPL, NVDA, TSLA).",
        },
        {
          question: "Is Gorengan Index free to use?",
          answer:
            "Yes, Gorengan Index is 100% free for market research and personal price tracking. You can access the Market Board, analyze TradingView charts, and use the terminal without subscription fees.",
        },
      ],
    },
    footer: {
      brandTagline: "Gorengan Index — Real-Time IDX Stock, Crypto & FX Screener",
      disclaimer: "Market data for personal research",
    },
  },
  terminal: {
    railTitle: "GI / TERMINAL",
    marketsCount: "{count} MARKETS",
    mobileNav: {
      chart: "Chart",
      markets: "Markets",
      intel: "News",
    },
    workspace: {
      boardLabel: "02 / BOARD",
      marketsHeading: "Markets",
      symbolsCount: "{count} symbols",
      marketSnapshot: "MARKET SNAPSHOT",
    },
  },
  watchlist: {
    tabs: {
      favorites: "FAVORITES",
      all: "ALL",
    },
    trendFilters: {
      all: "ALL",
      gainers: "GAINERS",
      losers: "LOSERS",
    },
    searchPlaceholder: "Search symbols, names, pairs...",
    categories: {
      all: "ALL",
      crypto: "CRYPTO",
      fx: "FOREX",
      us: "US",
      idx: "IDX",
    },
    emptyFavorites: {
      title: "No favorites added yet",
      desc: "Click the star icon next to any symbol to track it here.",
    },
    emptySearch: {
      title: "No symbols found",
      desc: "No symbols matched your query \"{query}\".",
    },
    favoriteActions: {
      remove: "Remove from watchlist",
      add: "Add to watchlist",
    },
  },
  marketTable: {
    searchPlaceholder: "Search market, symbol, pair...",
    columns: {
      symbol: "Symbol",
      name: "Name",
      price: "Price",
      change24h: "24h Change",
      high24h: "24h High",
      low24h: "24h Low",
      volume24h: "Volume (24h)",
      range: "24h Range",
    },
    sessionBadges: {
      closed: "CLOSED",
      holiday: "HOLIDAY",
      break: "BREAK",
      preMarket: "PRE-MARKET",
      afterHours: "AFTER-HOURS",
      liveIex: "LIVE · IEX",
      delayed: "DELAYED",
    },
    empty: {
      title: "No markets found",
      desc: "No symbols matched your active filter or search query.",
    },
    showingCount: "Showing {visible} of {total} markets",
  },
  marketStats: {
    labels: {
      price: "PRICE",
      change24h: "24H CHANGE",
      high24h: "24H HIGH",
      low24h: "24H LOW",
      volume24h: "VOLUME (24H)",
      spread24h: "24H SPREAD",
      marketBreadth: "MARKET BREADTH",
      gainers: "GAINERS",
      losers: "LOSERS",
    },
  },
  intelligence: {
    tabs: {
      orderbook: "Order Book",
      stats: "Market stats",
      news: "News",
    },
    selectedMarket: "Selected market",
    sentimentTitle: "Sentiment Index",
    orderbook: {
      title: "Order Book",
      price: "Price",
      size: "Size",
      total: "Total",
      spread: "Spread",
      connecting: "Connecting live stream...",
    },
  },
  sentiment: {
    title: "Fear & Greed Index",
    levels: {
      extremeFear: "Extreme Fear",
      fear: "Fear",
      neutral: "Neutral",
      greed: "Greed",
      extremeGreed: "Extreme Greed",
      unavailable: "Unavailable",
    },
    labels: {
      scaleZero: "0 Extreme Fear",
      scaleFifty: "50 Neutral",
      scaleHundred: "100 Extreme Greed",
      unavailableMsg: "Sentiment is unavailable right now.",
      noDataMsg: "No sentiment data yet.",
    },
  },
  news: {
    impact: {
      high: "HIGH",
      medium: "MEDIUM",
      low: "LOW",
    },
    sentiment: {
      bull: "BULL",
      bear: "BEAR",
      ntrl: "NTRL",
    },
    empty: "No news articles available right now.",
  },
  chart: {
    indicators: {
      ema20: "EMA 20",
      ema50: "EMA 50",
    },
    metrics: {
      prevClose: "PREV CLOSE:",
      dayHigh: "DAY HIGH:",
      dayLow: "DAY LOW:",
      vol: "VOL:",
      bid: "BID:",
      ask: "ASK:",
      spread: "SPREAD:",
      high24h: "24h High:",
      low24h: "24h Low:",
    },
  },
  login: {
    backToMarkets: "Back to markets",
    workspaceEyebrow: "Your workspace",
    titleMain: "Pick up where",
    titleAccent: "the market is.",
    description:
      "Sign in to open your watchlist, real-time charts, and market news in the institutional terminal.",
    continueWithGoogle: "Continue with Google",
    connecting: "Connecting…",
    footnote: "Authentication is securely verified through Google OAuth.",
    footerText: "Gorengan Index · Market data for personal research",
    asideTag: "MARKET / 01",
    asideTitleMain: "One place to watch",
    asideTitleAccent: "what moves.",
    asideKeywords: "CHARTS · WATCHLIST · NEWS",
    errorExpired: "Authentication session expired or failed. Please try again.",
    errorStartFailed: "Sign-in did not start. Please verify your connection and try again.",
  },
  time: {
    justNow: "just now",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
  },
};
