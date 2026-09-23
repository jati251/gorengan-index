"use client";

import React, { useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useAnimationFrame } from "framer-motion";
import { useMarketStore } from "@/stores/marketStore";
import { formatPrice, formatPercent } from "@/utils/formatters";
import { formatFxPrice, isFxSymbol } from "@/features/forex";
import { formatEquityPrice, isUsEquitySymbol, isIdxEquitySymbol } from "@/features/equities";
import type { MarketTicker } from "@gorengan/shared";

export function BottomStickyTickerTape() {
  const tickers = useMarketStore((s) => s.tickers);
  const priceDirections = useMarketStore((s) => s.priceDirections);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);

  const [isHovered, setIsHovered] = useState(false);
  const x = useMotionValue(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const tickerList = useMemo(() => Object.values(tickers), [tickers]);

  // Duplicate items twice to allow continuous seamless 50% translation marquee
  const loopedTickers = useMemo(() => {
    if (tickerList.length === 0) return [];
    return [...tickerList, ...tickerList];
  }, [tickerList]);

  // Calm, steady, ultra-smooth ticker flow (~36 pixels per second)
  const SPEED = 36;

  useAnimationFrame((_, delta) => {
    if (isHovered) return;
    if (!contentRef.current) return;

    const halfWidth = contentRef.current.scrollWidth / 2;
    if (halfWidth <= 0) return;

    let currentX = x.get() - SPEED * (delta / 1000);
    if (currentX <= -halfWidth) {
      currentX += halfWidth;
    }
    x.set(currentX);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      aria-label="Real-time Market Ticker Tape"
      className="fixed bottom-[72px] xl:bottom-0 left-0 right-0 z-40 h-9 bg-[#173025] border-t border-white/[0.08] flex items-center font-mono select-none overflow-hidden "
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Marquee Track Container with Edge Fades */}
      <div className="relative flex-1 w-full overflow-hidden h-full flex items-center">
        {/* Left fade gradient */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#173025] via-[#173025]/80 to-transparent z-10" />

        {loopedTickers.length === 0 ? (
          <div className="px-4 text-xs text-slate-500 italic">
            Connecting to live market stream...
          </div>
        ) : (
          <motion.div
            ref={contentRef}
            style={{ x }}
            className="flex items-center gap-2 py-0.5 will-change-transform"
          >
            {loopedTickers.map((t: MarketTicker, idx: number) => {
              const isPositive = (t.changePercent24h ?? 0) >= 0;
              const isSelected = t.symbol === selectedSymbol;
              const direction = priceDirections[t.symbol];
              const isFx = isFxSymbol(t.symbol);
              const isUs = isUsEquitySymbol(t.symbol);
              const isId = isIdxEquitySymbol(t.symbol);

              let formattedPrice = `$${formatPrice(t.price)}`;
              if (isFx) {
                formattedPrice = formatFxPrice(t.price, t.symbol);
              } else if (isId) {
                formattedPrice = formatEquityPrice(t.price, t.symbol, "IDR");
              } else if (isUs) {
                formattedPrice = formatEquityPrice(t.price, t.symbol, "USD");
              }

              return (
                <motion.button
                  key={`${t.symbol}-${idx}`}
                  type="button"
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSelectedSymbol(t.symbol)}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] transition-all duration-300 cursor-pointer shrink-0 border ${
                    direction === "up"
                      ? "bg-emerald-500/25 border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.5)] scale-[1.02]"
                      : direction === "down"
                        ? "bg-rose-500/25 border-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.5)] scale-[1.02]"
                        : isSelected
                          ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold"
                          : "bg-white/[0.025] hover:bg-white/[0.08] border-white/[0.06] hover:border-white/[0.18] text-slate-300"
                  }`}
                  title={`Select ${t.symbol}`}
                >
                  <span className="font-semibold text-slate-200">{t.symbol}</span>
                  <span
                    className={`font-medium tabular-nums transition-colors duration-200 flex items-center gap-0.5 ${
                      direction === "up"
                        ? "text-emerald-300 font-bold drop-shadow-[0_0_8px_rgba(16,185,129,0.9)]"
                        : direction === "down"
                          ? "text-rose-300 font-bold drop-shadow-[0_0_8px_rgba(244,63,94,0.9)]"
                          : "text-white"
                    }`}
                  >
                    {formattedPrice}
                    {direction === "up" && (
                      <span className="text-[9px] text-emerald-300 font-extrabold animate-pulse">
                        ▲
                      </span>
                    )}
                    {direction === "down" && (
                      <span className="text-[9px] text-rose-300 font-extrabold animate-pulse">
                        ▼
                      </span>
                    )}
                  </span>
                  <span
                    className={`font-semibold tabular-nums text-[10px] px-1.5 py-0.2 rounded border ${
                      isPositive
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]"
                        : "text-rose-400 bg-rose-500/10 border-rose-500/25 drop-shadow-[0_0_6px_rgba(244,63,94,0.3)]"
                    }`}
                  >
                    {formatPercent(t.changePercent24h)}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        )}

        {/* Right fade gradient */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#173025] via-[#173025]/80 to-transparent z-10" />
      </div>
    </motion.div>
  );
}
