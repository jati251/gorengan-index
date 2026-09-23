"use client";

import React, { useEffect, useState, useMemo } from "react";
import { clsx } from "clsx";
import { useMarketStore, type PriceDirection } from "@/stores/marketStore";
import { formatPrice, formatPercent } from "@/utils/formatters";
import { formatFxPrice, isFxSymbol } from "@/features/forex";
import { formatEquityPrice, isUsEquitySymbol, isIdxEquitySymbol } from "@/features/equities";
import { DEFAULT_SYMBOLS, type MarketSymbol, type MarketTicker } from "@gorengan/shared";

interface TapeItemProps {
  symbol: MarketSymbol;
  ticker?: MarketTicker;
  direction: PriceDirection;
  selected: boolean;
  copy: number;
  onSelect: (symbol: string) => void;
}

function formatTapePrice(
  price: number | undefined,
  symbolId: string,
  isFx: boolean,
  isId: boolean,
  isUs: boolean
): string {
  if (price == null || !Number.isFinite(price) || price <= 0) return "--";
  if (isFx) return formatFxPrice(price, symbolId);
  if (isId) return formatEquityPrice(price, symbolId, "IDR");
  if (isUs) return formatEquityPrice(price, symbolId, "USD");
  return `$${formatPrice(price)}`;
}

function getTapeDirectionColor(direction?: "up" | "down" | "neutral"): string {
  if (direction === "up") return "text-emerald-300 drop-shadow-[0_0_8px_rgba(63,223,151,0.95)]";
  if (direction === "down") return "text-rose-300 drop-shadow-[0_0_8px_rgba(235,97,159,0.95)]";
  return "text-white";
}

function getTapeArrowClass(direction?: "up" | "down" | "neutral"): string {
  if (direction === "up") return "text-emerald-300 opacity-100 scale-100 drop-shadow-[0_0_6px_#3fdf97]";
  if (direction === "down") return "text-rose-300 opacity-100 scale-100 drop-shadow-[0_0_6px_#eb619f]";
  return "opacity-0 scale-50";
}

const TapeItem = React.memo(function TapeItem({
  symbol,
  ticker,
  direction,
  selected,
  copy,
  onSelect,
}: TapeItemProps) {
  const isPositive = (ticker?.changePercent24h ?? 0) >= 0;
  const isFx = isFxSymbol(symbol.id);
  const isUs = isUsEquitySymbol(symbol.id);
  const isId = isIdxEquitySymbol(symbol.id);

  const priceFormatted = formatTapePrice(ticker?.price, symbol.id, isFx, isId, isUs);

  return (
    <button
      type="button"
      tabIndex={copy === 0 ? 0 : -1}
      onClick={() => onSelect(symbol.id)}
      className={clsx(
        "relative flex items-center justify-between w-[172px] min-w-[172px] max-w-[172px] px-2 py-1 rounded text-[11px] cursor-pointer shrink-0 border font-mono transition-colors duration-200",
        direction === "up" && "tape-glow-up",
        direction === "down" && "tape-glow-down",
        direction === "neutral" && (
          selected
            ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold shadow-[0_0_12px_rgba(63,223,151,0.25)]"
            : "bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.06] hover:border-white/[0.18] text-slate-300"
        )
      )}
      title={"Select " + symbol.id}
    >
      {/* 1. Fixed-width Symbol */}
      <span className="w-[50px] min-w-[50px] max-w-[50px] font-semibold text-slate-200 truncate text-left">
        {symbol.id}
      </span>

      {/* 2. Fixed-width Price & Stable 10px Arrow */}
      <span
        className={clsx(
          "w-[68px] min-w-[68px] max-w-[68px] font-semibold tabular-nums flex items-center justify-end gap-0.5 transition-colors duration-200",
          getTapeDirectionColor(direction)
        )}
      >
        <span className="truncate text-right">{priceFormatted}</span>
        <span
          aria-hidden="true"
          className={clsx(
            "w-2.5 h-2.5 inline-flex items-center justify-center shrink-0 text-[8px] font-black leading-none transition-all duration-300",
            getTapeArrowClass(direction)
          )}
        >
          {direction === "down" ? "▼" : "▲"}
        </span>
      </span>

      {/* 3. Fixed-width 24h Change Badge */}
      <span
        className={clsx(
          "w-[44px] min-w-[44px] max-w-[44px] font-semibold tabular-nums text-[10px] text-center py-0.2 rounded border transition-colors duration-200 shrink-0",
          isPositive
            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
            : "text-rose-400 bg-rose-500/10 border-rose-500/25"
        )}
      >
        {ticker ? formatPercent(ticker.changePercent24h) : "0.00%"}
      </span>
    </button>
  );
});

export function BottomStickyTickerTape() {
  const [market, setMarket] = useState(() => {
    const state = useMarketStore.getState();
    return { tickers: state.tickers, priceDirections: state.priceDirections };
  });
  const { tickers, priceDirections } = market;
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);
  const [isPaused, setIsPaused] = useState(false);

  // Throttle store updates to 250ms to keep React updates lightweight and eliminate stutter
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useMarketStore.subscribe((state, previous) => {
      if (state.tickers === previous.tickers && state.priceDirections === previous.priceDirections) return;
      if (timer) return;
      timer = setTimeout(() => {
        const latest = useMarketStore.getState();
        setMarket({ tickers: latest.tickers, priceDirections: latest.priceDirections });
        timer = undefined;
      }, 250);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Use immutable universe of symbols - constant width from frame 0, strictly invariant
  const symbols = useMemo(() => DEFAULT_SYMBOLS, []);

  return (
    <div
      aria-label="Real-time Market Ticker Tape"
      className="fixed bottom-[calc(70px+env(safe-area-inset-bottom,0px))] xl:bottom-0 left-0 right-0 z-40 h-9 bg-[#3c3f5f] border-t border-white/[0.08] flex items-center font-mono select-none overflow-hidden"
      style={{
        WebkitTransform: "translateZ(0)",
        transform: "translateZ(0)",
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Marquee Track Container with Edge Fades */}
      <div className="relative flex-1 w-full overflow-hidden h-full flex items-center">
        {/* Left fade gradient */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#3c3f5f] via-[#3c3f5f]/80 to-transparent z-10" />

        {/* Hardware-accelerated CSS marquee track */}
        <div
          className={clsx("tape-marquee-track", isPaused && "is-paused")}
          style={{
            WebkitBackfaceVisibility: "hidden",
            backfaceVisibility: "hidden",
          }}
        >
          {([0, 1] as const).map((copy) => (
            <div
              key={copy}
              aria-hidden={copy === 1 ? true : undefined}
              className="flex shrink-0 items-center gap-2 pr-2"
            >
              {symbols.map((sym) => (
                <TapeItem
                  key={sym.id}
                  symbol={sym}
                  ticker={tickers[sym.id]}
                  direction={priceDirections[sym.id] || "neutral"}
                  selected={sym.id === selectedSymbol}
                  copy={copy}
                  onSelect={setSelectedSymbol}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Right fade gradient */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#3c3f5f] via-[#3c3f5f]/80 to-transparent z-10" />
      </div>
    </div>
  );
}
