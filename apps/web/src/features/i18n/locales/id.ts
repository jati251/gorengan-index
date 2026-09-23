import type { TranslationSchema } from "../types";

export const id: TranslationSchema = {
  common: {
    signIn: "Masuk",
    signOut: "Keluar",
    account: "Akun",
    loadingAccount: "Memuat akun…",
    backToMarkets: "Kembali ke pasar",
    openTerminal: "Buka terminal",
    openBoard: "Buka papan",
    continueWithGoogle: "Lanjutkan dengan Google",
    connecting: "Menghubungkan…",
    loading: "Memuat…",
    allMarkets: "Semua Pasar",
    status: {
      live: "Langsung",
      stale: "Tertahan",
      reconnecting: "Menghubungkan ulang",
      connecting: "Menghubungkan",
      offline: "Terputus",
    },
    categories: {
      all: "Semua",
      crypto: "Kripto",
      fx: "Forex",
      us_stocks: "Saham US",
      idx_stocks: "Saham IDX",
    },
  },
  landing: {
    nav: {
      marketView: "Tinjauan pasar",
      about: "Tentang",
      faq: "FAQ",
      terminal: "Terminal",
    },
    hero: {
      eyebrow: "GOR / INDEX • MARKET BOARD",
      titleMain: "Pantau",
      titleAccent: "pergerakan pasar.",
      intro:
        "Screener saham gorengan IDX, crypto, forex, dan US stocks dalam satu tempat. Papan pasar real-time dengan chart candlestick live dan analisis pasar terlengkap.",
      openBoard: "Buka papan",
      openTerminal: "Buka terminal",
      publicNotice: "Mode publik · kuotasi diperbarui tiap 5 detik.",
    },
    tape: {
      boardLabel: "PAPAN BURSA",
      featuredTitle: "Pasar Unggulan (2 per Kategori)",
      assetsCount: "{count} aset",
      waitingForPrice: "Menunggu harga",
    },
    market: {
      eyebrow: "Tinjauan pasar",
      title: "Sedang berjalan di bursa",
      authSubtitle: "Ruang kerja pasar Anda telah siap.",
      publicSubtitle: "Kuotasi publik diperbarui setiap 5 detik.",
      tabChart: "Grafik",
      tabMarkets: "Pasar",
      liveStream: "Streaming langsung",
      sampleUpdates: "Update tiap 5 detik",
      marketSnapshot: "Ringkasan pasar",
      showingFeatured: "Menampilkan 2 aset unggulan per kelas aset ({count} total)",
      openTerminalAll: "Buka Terminal untuk semua {count} pasar",
    },
    about: {
      eyebrow: "Ruang kerja",
      title: "Fokus pantau pergerakan pasar.",
      desc1:
        "Pin simbol favorit Anda. Pantau chart candlestick. Baca berita pasar terkini. Lanjutkan hari Anda tanpa cemas.",
      desc2:
        "Papan pasar terbuka untuk siapa saja. Masuk untuk menyimpan daftar pantau (watchlist) dan akses terminal institusional lengkap.",
      openTerminal: "Buka terminal Anda",
      continueWithGoogle: "Lanjutkan dengan Google",
    },
    faq: {
      eyebrow: "Tanya Jawab • Knowledge Base",
      title: "Pertanyaan Umum (FAQ)",
      items: [
        {
          question: "Apa itu Gorengan Index?",
          answer:
            "Gorengan Index adalah platform screener dan terminal pasar finansial real-time yang dirancang khusus untuk memantau pergerakan saham-saham aktif & volatil di Bursa Efek Indonesia (IDX/IHSG), aset kripto global (Bitcoin, Ethereum, Solana), serta pasangan mata uang forex dalam satu antarmuka retro arcade berkecepatan tinggi.",
        },
        {
          question: "Apa yang dimaksud dengan saham gorengan dan bagaimana cara screening di Gorengan Index?",
          answer:
            "Saham gorengan adalah istilah pasar modal Indonesia untuk saham lapis dua atau tiga (small/mid cap) dengan volatilitas dan volume transaksi tinggi. Gorengan Index memantau lonjakan volume harian, perubahan persentase harga 24 jam, dan orderbook live untuk mempermudah trader dan scalper mendeteksi momentum pasar.",
        },
        {
          question: "Apakah data harga di Gorengan Index disajikan secara real-time?",
          answer:
            "Ya, data harga dialirkan secara langsung menggunakan WebSocket berkecepatan tinggi. Mode publik memperbarui kuotasi pasar setiap 5 detik, dan pengguna terdaftar menikmati streaming live tanpa jeda.",
        },
        {
          question: "Instrumen finansial apa saja yang didukung oleh Gorengan Index?",
          answer:
            "Gorengan Index mendukung Saham Bursa Efek Indonesia (IDX), Aset Kripto (Cryptocurrency seperti BTC, ETH, SOL), Valuta Asing (Forex seperti USD/IDR, EUR/USD), serta Saham Global Amerika (US Equities).",
        },
        {
          question: "Apakah platform Gorengan Index gratis digunakan?",
          answer:
            "Ya, Gorengan Index 100% gratis digunakan untuk riset pasar dan pemantauan harga harian. Anda dapat membuka Market Board, melihat chart TradingView, dan menggunakan terminal trading tanpa biaya berlangganan.",
        },
      ],
    },
    footer: {
      brandTagline: "Gorengan Index — Screener Saham IDX, Crypto & FX Real-Time",
      disclaimer: "Data pasar untuk riset personal",
    },
  },
  terminal: {
    railTitle: "GI / TERMINAL",
    marketsCount: "{count} PASAR",
    mobileNav: {
      chart: "Grafik",
      markets: "Pasar",
      intel: "Berita",
    },
    workspace: {
      boardLabel: "02 / PAPAN",
      marketsHeading: "Pasar",
      symbolsCount: "{count} simbol",
      marketSnapshot: "RINGKASAN PASAR",
    },
  },
  watchlist: {
    tabs: {
      favorites: "FAVORIT",
      all: "SEMUA",
    },
    trendFilters: {
      all: "SEMUA",
      gainers: "NAIK",
      losers: "TURUN",
    },
    searchPlaceholder: "Cari simbol, nama, atau pasangan...",
    categories: {
      all: "SEMUA",
      crypto: "KRIPTO",
      fx: "FOREX",
      us: "US",
      idx: "IDX",
    },
    emptyFavorites: {
      title: "Belum ada favorit",
      desc: "Klik ikon bintang pada simbol manapun untuk melacaknya di sini.",
    },
    emptySearch: {
      title: "Simbol tidak ditemukan",
      desc: "Tidak ada simbol yang cocok dengan \"{query}\".",
    },
    favoriteActions: {
      remove: "Hapus dari watchlist",
      add: "Tambah ke watchlist",
    },
  },
  marketTable: {
    searchPlaceholder: "Cari pasar, simbol, atau pasangan...",
    columns: {
      symbol: "Simbol",
      name: "Nama",
      price: "Harga",
      change24h: "Perubahan 24j",
      high24h: "Tertinggi 24j",
      low24h: "Terendah 24j",
      volume24h: "Volume (24j)",
      range: "Rentang 24j",
    },
    sessionBadges: {
      closed: "TUTUP",
      holiday: "LIBUR",
      break: "ISTIRAHAT",
      preMarket: "PRA-PASAR",
      afterHours: "PASCA-PASAR",
      liveIex: "LIVE · IEX",
      delayed: "DELAY",
    },
    empty: {
      title: "Pasar tidak ditemukan",
      desc: "Tidak ada simbol yang sesuai dengan filter pencarian Anda.",
    },
    showingCount: "Menampilkan {visible} dari {total} pasar",
  },
  marketStats: {
    labels: {
      price: "HARGA",
      change24h: "PERUBAHAN 24J",
      high24h: "TERTINGGI 24J",
      low24h: "TERENDAH 24J",
      volume24h: "VOLUME (24J)",
      spread24h: "SPREAD 24J",
      marketBreadth: "DISTRIBUSI PASAR",
      gainers: "PENGUATAN",
      losers: "PELEMAHAN",
    },
  },
  intelligence: {
    tabs: {
      stats: "Statistik pasar",
      news: "Berita",
    },
    selectedMarket: "Pasar terpilih",
    sentimentTitle: "Indeks Sentimen",
  },
  sentiment: {
    title: "Fear & Greed Index",
    levels: {
      extremeFear: "Ketakutan Ekstrem",
      fear: "Ketakutan",
      neutral: "Netral",
      greed: "Keserakahan",
      extremeGreed: "Keserakahan Ekstrem",
      unavailable: "Tidak Tersedia",
    },
    labels: {
      scaleZero: "0 Ketakutan Ekstrem",
      scaleFifty: "50 Netral",
      scaleHundred: "100 Keserakahan Ekstrem",
      unavailableMsg: "Sentimen saat ini tidak tersedia.",
      noDataMsg: "Belum ada data sentimen.",
    },
  },
  news: {
    impact: {
      high: "TINGGI",
      medium: "SEDANG",
      low: "RENDAH",
    },
    sentiment: {
      bull: "BULL",
      bear: "BEAR",
      ntrl: "NTRL",
    },
    empty: "Belum ada artikel berita pasar saat ini.",
  },
  chart: {
    indicators: {
      ema20: "EMA 20",
      ema50: "EMA 50",
    },
    metrics: {
      prevClose: "PENUTUPAN:",
      dayHigh: "TERTINGGI:",
      dayLow: "TERENDAH:",
      vol: "VOL:",
      bid: "BID:",
      ask: "ASK:",
      spread: "SPREAD:",
      high24h: "Tertinggi 24j:",
      low24h: "Terendah 24j:",
    },
  },
  login: {
    backToMarkets: "Kembali ke pasar",
    workspaceEyebrow: "Ruang kerja Anda",
    titleMain: "Lanjutkan tepat di mana",
    titleAccent: "pasar bergerak.",
    description:
      "Masuk untuk membuka daftar pantau (watchlist), chart real-time, dan berita pasar di terminal institusional.",
    continueWithGoogle: "Lanjutkan dengan Google",
    connecting: "Menghubungkan…",
    footnote: "Autentikasi diverifikasi secara aman melalui Google OAuth.",
    footerText: "Gorengan Index · Data pasar untuk riset personal",
    asideTag: "PASAR / 01",
    asideTitleMain: "Satu tempat untuk pantau",
    asideTitleAccent: "semua pergerakan.",
    asideKeywords: "GRAFIK · WATCHLIST · BERITA",
    errorExpired: "Sesi autentikasi telah berakhir atau gagal. Silakan coba lagi.",
    errorStartFailed: "Proses masuk tidak dapat dimulai. Periksa koneksi Anda dan coba lagi.",
  },
  time: {
    justNow: "baru saja",
    minutesAgo: "{n}m lalu",
    hoursAgo: "{n}j lalu",
    daysAgo: "{n}h lalu",
  },
};
