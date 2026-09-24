"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Calculator, Activity, ArrowUpRight, BarChart3, CandlestickChart, ChartNoAxesCombined, ChevronDown, Focus, LayoutGrid, Layers3, Newspaper, PanelLeft, PieChart, Plus, Search, X } from "lucide-react";
import { MarketHeaderTicker, MarketOverviewTable, MarketStats, BottomStickyTickerTape, useResolvedSymbols, useMarketsQuery } from "@/features/markets";
import { TradingViewChart, ChartHeader } from "@/features/chart";
import { WatchlistSidebar } from "@/features/watchlist";
import { OrderBook } from "@/features/orderbook";
import { NewsFeed, SentimentGauge } from "@/features/news";
import { CalculatorPanel, ExchangeRateReference } from "@/features/analysis/components/CalculatorPanel";
import { AnalysisPanel } from "@/features/analysis/components/AnalysisPanel";
import { CryptoIntelPanel } from "@/features/analysis/components/CryptoIntelPanel";
import { MarketComposition } from "@/features/analysis/components/MarketComposition";
import { MarketMovers, MarketPulse } from "@/features/analysis/components/MarketPulse";
import { useTerminalWebSocket } from "@/hooks/useTerminalWebSocket";
import { useMarketStore } from "@/stores/marketStore";
import { useWorkspaceStore, widgetKinds, type WidgetKind } from "@/stores/workspaceStore";
import { useTranslation } from "@/features/i18n";

const widgetIcons = { cryptoIntel: Activity, calculator: Calculator, overview: LayoutGrid, chart: CandlestickChart, analysis: Activity, prediction: ChartNoAxesCombined, composition: PieChart, markets: BarChart3, orderbook: Layers3, pulse: Activity, news: Newspaper };
const compactQuery = "(max-width: 1199px)";
const subscribeCompact = (callback: () => void) => {
  const query = window.matchMedia(compactQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const getCompact = () => window.matchMedia(compactQuery).matches;
const getServerCompact = () => true;

export default function TerminalPage() {
  const { dict, locale } = useTranslation();
  const id = locale === "id";
  const isCompact = useSyncExternalStore(subscribeCompact, getCompact, getServerCompact);
  const { symbols, symbolIds, isLoading, isError, refetch: refetchSymbols } = useResolvedSymbols();
  useMarketsQuery();
  useTerminalWebSocket(symbolIds, { isThrottled: true, throttleMs: isCompact ? 250 : 100 });
  const symbol = useMarketStore((state) => state.selectedSymbol);
  const category = useMarketStore((state) => state.selectedCategory);
  const { tabs, active, focus, open, close, toggleFocus } = useWorkspaceStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const symbolDialog = useRef<HTMLDialogElement>(null);
  const tabList = useRef<HTMLDivElement>(null);

  useEffect(() => { void useWorkspaceStore.persist.rehydrate(); }, []);
  useEffect(() => {
    tabList.current?.querySelector<HTMLButtonElement>(`#workspace-tab-${active}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, isCompact]);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); addRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);

  const labels: Record<WidgetKind, string> = { cryptoIntel: "Crypto Intel", ...(id
    ? { calculator: "Kalkulator", overview: "Ringkasan", chart: "Chart", analysis: "Analisa", prediction: "Prediksi", composition: "Komposisi", markets: "Pasar", orderbook: "Order book", pulse: "Statistik", news: "Berita" }
    : { calculator: "Calculator", overview: "Overview", chart: "Chart", analysis: "Analysis", prediction: "Prediction", composition: "Composition", markets: "Markets", orderbook: "Order book", pulse: "Statistics", news: "News" }) };
  const descriptions: Record<WidgetKind, string> = { cryptoIntel: id ? "Pantau transaksi besar, momentum, derivatif, dan risiko crypto." : "Track large trades, momentum, derivatives and crypto risk.", ...(id
    ? { calculator: "Konversi kurs dan simulasikan hasil transaksi.", overview: "Pasar, indikator, dan pergerakan dalam satu workspace.", chart: "Pergerakan harga dan volume instrumen pilihan.", analysis: "Baca tren, momentum, dan rentang harga historis.", prediction: "Jelajahi skenario harga berdasarkan candle historis.", composition: "Lihat distribusi instrumen dan arah pergerakan pasar.", markets: "Temukan instrumen dan susun daftar pantauan.", orderbook: "Pantau penawaran beli dan jual.", pulse: "Statistik instrumen dan sentimen pasar.", news: "Ikuti berita terbaru yang memengaruhi pasar." }
    : { calculator: "Convert currencies and simulate trade outcomes.", overview: "Markets, signals and price action in one workspace.", chart: "Price action and volume for your selected instrument.", analysis: "Read the trend, momentum and historical price range.", prediction: "Explore price scenarios based on historical candles.", composition: "Explore instrument distribution and market breadth.", markets: "Find instruments and build your watchlist.", orderbook: "Inspect bids and asks for your selected instrument.", pulse: "Instrument statistics and market sentiment.", news: "Follow the stories moving the markets." }) };

  const openChart = () => { open("chart"); symbolDialog.current?.close(); };
  const switchTab = (kind: WidgetKind) => {
    open(kind);
    setMenuOpen(false);
  };
  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, kind: WidgetKind) => {
    const index = tabs.indexOf(kind);
    const next = event.key === "ArrowRight" ? tabs[(index + 1) % tabs.length] : event.key === "ArrowLeft" ? tabs[(index - 1 + tabs.length) % tabs.length] : event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length - 1] : null;
    if (next) { event.preventDefault(); open(next); tabList.current?.querySelector<HTMLButtonElement>(`#workspace-tab-${next}`)?.focus(); }
  };
  const chart = <section className="desk-panel chart-panel"><ChartHeader /><div className="desk-chart-canvas"><TradingViewChart key={symbol} symbol={symbol} terminalTheme className="w-full h-full" /></div></section>;
  const marketBoard = <section className="desk-panel market-board"><div className="desk-panel-head"><div><span className="desk-eyebrow">{id ? "Semua instrumen" : "All instruments"}</span><h2>{dict.terminal.workspace.marketsHeading}</h2></div><span className="desk-count">{symbols.length}</span></div><MarketOverviewTable symbols={symbols} isLoading={isLoading} onSelectSymbol={openChart} /></section>;

  return <main className={`terminal-app ${focus ? "desk-focus" : ""}`}>
    <MarketHeaderTicker />
    <div className="desk-tabbar">
      <div className="desk-tabs" role="tablist" aria-label={id ? "Tab workspace" : "Workspace tabs"} ref={tabList}>
        {tabs.map((kind) => {
          const Icon = widgetIcons[kind];
          return <div className={`desk-tab ${active === kind ? "is-active" : ""}`} key={kind}>
            <button type="button" role="tab" id={`workspace-tab-${kind}`} aria-controls="workspace-panel" aria-selected={active === kind} tabIndex={active === kind ? 0 : -1} onClick={() => open(kind)} onKeyDown={(event) => onTabKey(event, kind)}><Icon size={15} aria-hidden="true" /><span>{labels[kind]}</span></button>
            {kind !== "overview" && <button type="button" className="desk-tab-close" aria-label={`${id ? "Tutup" : "Close"} ${labels[kind]}`} onClick={() => { close(kind); tabList.current?.querySelector<HTMLButtonElement>(`#workspace-tab-${useWorkspaceStore.getState().active}`)?.focus(); }}><X size={13} /></button>}
          </div>;
        })}
      </div>
      <div className="desk-widget-picker" ref={menuRef}>
        <button type="button" className="desk-add-widget" ref={addRef} aria-label={id ? "Tambah widget" : "Add widget"} aria-expanded={menuOpen} aria-controls="widget-picker" onClick={() => setMenuOpen((value) => !value)}><Plus size={17} /><span>Widget</span></button>
        {menuOpen && <div className="desk-widget-menu" id="widget-picker"><p>{id ? "Pilih widget workspace" : "Choose a workspace widget"}</p>{widgetKinds.filter((kind) => kind !== "overview").map((kind) => {
          const Icon = widgetIcons[kind];
          return <button type="button" key={kind} onClick={() => switchTab(kind)}><Icon size={17} /><span>{labels[kind]}</span>{tabs.includes(kind) && <small>{id ? "Terbuka" : "Open"}</small>}</button>;
        })}</div>}
      </div>
    </div>

    <div className="desk-toolbar">
      <div><span className="desk-eyebrow">{id ? "Workspace pribadi" : "Personal workspace"}</span><h1>{labels[active]}<span>/</span><button type="button" onClick={() => symbolDialog.current?.showModal()} aria-label={id ? "Pilih instrumen" : "Choose instrument"}>{symbol}<ChevronDown size={14} /></button></h1></div>
      <div className="desk-toolbar-actions"><ExchangeRateReference onOpen={() => open("calculator")} /><button type="button" className="desk-button" aria-label={id ? "Cari aset" : "Find asset"} onClick={() => symbolDialog.current?.showModal()}><Search size={15} /><span>{id ? "Cari aset" : "Find asset"}</span></button><button type="button" className="desk-button desk-focus-toggle" aria-pressed={focus} onClick={toggleFocus}><Focus size={15} /><span>{id ? "Fokus" : "Focus"}</span></button></div>
    </div>

    <div className="workspace-grid">
      {!isCompact && <aside className="watch-panel"><div className="watch-panel-heading"><PanelLeft size={15} /><h2>Watchlist</h2><span>{symbols.length}</span></div><WatchlistSidebar isLoading={isLoading} key={category} symbols={symbols} onSelectSymbol={openChart} /></aside>}
      <section id="workspace-panel" role="tabpanel" aria-labelledby={`workspace-tab-${active}`} className="workspace-content">
        <p className="workspace-description">{descriptions[active]}</p>
        {isError && <div className="desk-data-note" role="status"><span>{id ? "Daftar instrumen cadangan digunakan." : "Using the fallback instrument list."}</span><button type="button" onClick={() => refetchSymbols()}>{id ? "Muat ulang daftar" : "Reload instruments"}</button></div>}
        {active === "overview" && <><MarketPulse loading={isLoading} symbols={symbols} />{chart}<div className="overview-analysis"><AnalysisPanel mode="summary" /><button type="button" className="projection-entry" onClick={() => open("prediction")}><ChartNoAxesCombined size={25} /><span className="desk-eyebrow">{id ? "Langkah berikutnya" : "Look ahead"}</span><strong>{id ? "Baca skenario harga" : "Explore price scenarios"}</strong><p>{id ? "Proyeksi 5, 10, atau 20 candle dengan rentang volatilitas historis." : "Project 5, 10 or 20 candles with a historical volatility range."}</p><span>{id ? "Buka prediksi" : "Open prediction"}<ArrowUpRight size={16} /></span></button></div>{isCompact && <MarketComposition symbols={symbols} loading={isLoading} />}{marketBoard}</>}
        {active === "chart" && <>{chart}<AnalysisPanel mode="summary" /></>}
        {active === "calculator" && <CalculatorPanel />}
        {active === "cryptoIntel" && <CryptoIntelPanel />}
        {active === "analysis" && <AnalysisPanel />}
        {active === "prediction" && <AnalysisPanel mode="prediction" />}
        {active === "composition" && <><MarketPulse loading={isLoading} symbols={symbols} /><MarketComposition symbols={symbols} loading={isLoading} /><MarketMovers symbols={symbols} onSelect={openChart} /></>}
        {active === "markets" && marketBoard}
        {active === "orderbook" && <section className="desk-panel standalone-widget"><div className="desk-panel-head"><h2>{labels.orderbook}</h2><span className="desk-muted">{symbol}</span></div><OrderBook className="flex-1 min-h-0" /></section>}
        {active === "pulse" && <section className="desk-panel stats-widget"><div className="desk-panel-head"><h2>{labels.pulse}</h2><span>{symbol}</span></div><div className="desk-panel-body"><MarketStats /><SentimentGauge /></div></section>}
        {active === "news" && <section className="desk-panel standalone-widget"><div className="desk-panel-head"><h2>{labels.news}</h2></div><NewsFeed /></section>}
      </section>
      {!isCompact && <aside className="context-panel">{active === "composition"
        ? <section className="desk-panel"><div className="desk-panel-head"><div><span className="desk-eyebrow">{symbol}</span><h2>{labels.pulse}</h2></div></div><div className="desk-panel-body"><MarketStats /><SentimentGauge /></div></section>
        : <>{active === "chart" ? <section className="desk-panel context-orderbook"><div className="desk-panel-head"><h2>{labels.orderbook}</h2></div><OrderBook className="flex-1 min-h-0" /></section> : <MarketComposition symbols={symbols} compact loading={isLoading} />}<MarketMovers symbols={symbols} onSelect={openChart} /></>}</aside>}
    </div>
    <dialog ref={symbolDialog} className="desk-symbol-dialog" aria-labelledby="symbol-dialog-title" onClick={(event) => { if (event.target === event.currentTarget) symbolDialog.current?.close(); }}>
      <div className="desk-dialog-content"><div className="desk-panel-head"><div><span className="desk-eyebrow">{id ? "Cari dan pantau" : "Search and track"}</span><h2 id="symbol-dialog-title">{id ? "Pilih instrumen" : "Choose instrument"}</h2></div><button type="button" className="desk-icon-button" aria-label={id ? "Tutup pencarian" : "Close search"} onClick={() => symbolDialog.current?.close()}><X size={18} /></button></div><WatchlistSidebar isLoading={isLoading} key={category} symbols={symbols} onSelectSymbol={openChart} /></div>
    </dialog>
    <BottomStickyTickerTape />
  </main>;
}
