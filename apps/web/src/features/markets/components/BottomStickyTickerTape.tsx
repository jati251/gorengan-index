"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { useMarketStore, type PriceDirection } from "@/stores/marketStore";
import { formatPrice, formatPercent } from "@/utils/formatters";
import { formatFxPrice, isFxSymbol } from "@/features/forex";
import { formatEquityPrice, isUsEquitySymbol, isIdxEquitySymbol } from "@/features/equities";
import type { MarketTicker } from "@gorengan/shared";

interface TapeItemProps {
  ticker: MarketTicker;
  direction: PriceDirection;
  selected: boolean;
  copy: number;
  onSelect: (symbol: string) => void;
}

const TapeItem = React.memo(function TapeItem({ ticker, direction, selected, copy, onSelect }: TapeItemProps) {
  const isPositive = (ticker.changePercent24h ?? 0) >= 0;
  const isFx = isFxSymbol(ticker.symbol);
  const isUs = isUsEquitySymbol(ticker.symbol);
  const isId = isIdxEquitySymbol(ticker.symbol);
  const price = isFx
    ? formatFxPrice(ticker.price, ticker.symbol)
    : isId
      ? formatEquityPrice(ticker.price, ticker.symbol, "IDR")
      : isUs
        ? formatEquityPrice(ticker.price, ticker.symbol, "USD")
        : "$" + formatPrice(ticker.price);

  return (
    <button
      type="button"
      tabIndex={copy === 0 ? 0 : -1}
      onClick={() => onSelect(ticker.symbol)}
      className={clsx(
        "flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] cursor-pointer shrink-0 border",
        direction === "up" ? "bg-emerald-500/25 border-emerald-400" :
        direction === "down" ? "bg-rose-500/25 border-rose-400" :
        selected ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold" :
        "bg-white/[0.025] hover:bg-white/[0.08] border-white/[0.06] hover:border-white/[0.18] text-slate-300"
      )}
      title={"Select " + ticker.symbol}
    >
      <span className="font-semibold text-slate-200">{ticker.symbol}</span>
      <span key={ticker.price} data-direction={direction} className={clsx("price-pixel-flash font-medium tabular-nums flex items-center gap-0.5 px-1", direction === "up" ? "font-bold" : direction === "down" ? "font-bold" : "text-white")}>
        {price}
        {direction === "up" && <span className="text-[9px] text-emerald-300 font-extrabold">▲</span>}
        {direction === "down" && <span className="text-[9px] text-rose-300 font-extrabold">▼</span>}
      </span>
      <span className={clsx("font-semibold tabular-nums text-[10px] px-1.5 py-0.2 rounded border", isPositive ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" : "text-rose-400 bg-rose-500/10 border-rose-500/25")}>
        {formatPercent(ticker.changePercent24h)}
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

  const pausedRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const offsetRef = useRef(0);

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

  const tickerList = useMemo(() => Object.values(tickers), [tickers]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || tickerList.length === 0) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new ResizeObserver(() => {
      widthRef.current = content.scrollWidth / 2;
      if (widthRef.current > 0) offsetRef.current %= widthRef.current;
    });
    observer.observe(content);
    widthRef.current = content.scrollWidth / 2;
    let frame = 0;
    let previousTime = 0;
    const animate = (time: number) => {
      if (previousTime && !pausedRef.current && !document.hidden && !reducedMotion.matches && widthRef.current > 0) {
        offsetRef.current = (offsetRef.current + 36 * Math.min((time - previousTime) / 1000, 0.05)) % widthRef.current;
        content.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
      }
      previousTime = time;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [tickerList.length]);

  return (
    <div
      aria-label="Real-time Market Ticker Tape"
      className="fixed bottom-[72px] xl:bottom-0 left-0 right-0 z-40 h-9 bg-[#3c3f5f] border-t border-white/[0.08] flex items-center font-mono select-none overflow-hidden "
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onFocusCapture={() => { pausedRef.current = true; }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) pausedRef.current = false; }}
    >
      {/* Marquee Track Container with Edge Fades */}
      <div className="relative flex-1 w-full overflow-hidden h-full flex items-center">
        {/* Left fade gradient */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#3c3f5f] via-[#3c3f5f]/80 to-transparent z-10" />

        {tickerList.length === 0 ? (
          <div className="px-4 text-xs text-slate-500 italic">
            Connecting to live market stream...
          </div>
        ) : (
          <div
            ref={contentRef}
            className="flex w-max items-center py-0.5 will-change-transform"
          >
            {([0, 1] as const).map((copy) => (
              <div key={copy} aria-hidden={copy === 1 ? true : undefined} className="flex shrink-0 items-center gap-2 pr-2">
                {tickerList.map((ticker) => (
                  <TapeItem
                    key={ticker.symbol}
                    ticker={ticker}
                    direction={priceDirections[ticker.symbol] || "neutral"}
                    selected={ticker.symbol === selectedSymbol}
                    copy={copy}
                    onSelect={setSelectedSymbol}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Right fade gradient */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#3c3f5f] via-[#3c3f5f]/80 to-transparent z-10" />
      </div>
    </div>
  );
}
