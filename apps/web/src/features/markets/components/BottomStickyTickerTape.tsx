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
        "relative flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] cursor-pointer shrink-0 border font-mono transition-[background,border-color,box-shadow,color] duration-300",
        direction === "up" && "tape-glow-up",
        direction === "down" && "tape-glow-down",
        direction === "neutral" && (
          selected
            ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold shadow-[0_0_12px_rgba(63,223,151,0.25)]"
            : "bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.06] hover:border-white/[0.18] text-slate-300"
        )
      )}
      title={"Select " + ticker.symbol}
    >
      <span className="font-semibold text-slate-200">{ticker.symbol}</span>
      <span
        className={clsx(
          "font-semibold tabular-nums flex items-center gap-1 transition-colors duration-200",
          direction === "up" ? "text-emerald-300 drop-shadow-[0_0_8px_rgba(63,223,151,0.95)]" :
          direction === "down" ? "text-rose-300 drop-shadow-[0_0_8px_rgba(235,97,159,0.95)]" :
          "text-white"
        )}
      >
        <span>{price}</span>
        {/* Fixed-width arrow slot: width is permanently stable so card width NEVER shifts */}
        <span
          aria-hidden="true"
          className={clsx(
            "w-2.5 h-2.5 inline-flex items-center justify-center shrink-0 text-[8px] font-black leading-none transition-all duration-300",
            direction === "up"
              ? "text-emerald-300 opacity-100 scale-100 drop-shadow-[0_0_6px_#3fdf97]"
              : direction === "down"
                ? "text-rose-300 opacity-100 scale-100 drop-shadow-[0_0_6px_#eb619f]"
                : "opacity-0 scale-50"
          )}
        >
          {direction === "down" ? "▼" : "▲"}
        </span>
      </span>
      <span
        className={clsx(
          "font-semibold tabular-nums text-[10px] px-1.5 py-0.2 rounded border transition-colors duration-200",
          isPositive
            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
            : "text-rose-400 bg-rose-500/10 border-rose-500/25"
        )}
      >
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

    const updateWidth = () => {
      const half = content.scrollWidth / 2;
      if (half > 0 && Math.abs(widthRef.current - half) > 1) {
        widthRef.current = half;
      }
    };

    updateWidth();
    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(content);

    let frame = 0;
    let previousTime = 0;
    const SPEED = 36; // px per second

    const animate = (time: number) => {
      if (previousTime && !pausedRef.current && !document.hidden && !reducedMotion.matches && widthRef.current > 0) {
        const delta = Math.min((time - previousTime) / 1000, 0.05);
        offsetRef.current += SPEED * delta;
        if (offsetRef.current >= widthRef.current) {
          offsetRef.current -= widthRef.current;
        }
        content.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
      }
      previousTime = time;
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
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
