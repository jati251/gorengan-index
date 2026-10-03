"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useNow } from "@/hooks/useNow";
import { useMarketStore } from "@/stores/marketStore";
import { useResolvedSymbols } from "@/features/markets/hooks/useResolvedSymbols";
import type { OrderBookLevel, OrderBookData, OrderBookViewMode } from "../types";

const MAX_LEVELS = 15;

function parseRawLevels(raw: [string, string][], isAscending = true): { price: number; size: number }[] {
  const parsed = raw.map(([p, q]) => ({
    price: parseFloat(p),
    size: parseFloat(q),
  }));

  if (isAscending) {
    parsed.sort((a, b) => a.price - b.price);
  } else {
    parsed.sort((a, b) => b.price - a.price);
  }

  return parsed;
}

function computeLevelsWithDepth(
  items: { price: number; size: number }[],
  maxDepth: number
): OrderBookLevel[] {
  let runningTotal = 0;
  return items.map((item) => {
    runningTotal += item.size;
    const depthPercent = maxDepth > 0 ? Math.min(100, Math.round((runningTotal / maxDepth) * 100)) : 0;
    return {
      price: item.price,
      size: item.size,
      total: runningTotal,
      depthPercent,
    };
  });
}

interface RawLiveDepth {
  bids: [string, string][];
  asks: [string, string][];
  timestamp: number;
  symbol: string;
}

/**
 * Hook to stream and manage live Order Book depth data.
 * Directly consumes Binance depth20@100ms WebSocket for crypto,
 * Unsupported venues expose an unavailable state.
 */
export function useOrderBook() {
  const now = useNow();
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const ticker = useMarketStore((s) => s.tickers[selectedSymbol]);
  const fxQuote = useMarketStore((s) => s.fxQuotes[selectedSymbol]);
  const { symbols } = useResolvedSymbols();

  const [viewMode, setViewMode] = useState<OrderBookViewMode>("all");
  const [liveDepth, setLiveDepth] = useState<RawLiveDepth | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "live" | "closed">("connecting");

  const activeWsRef = useRef<WebSocket | null>(null);

  // Identify symbol metadata
  const symbolMeta = useMemo(() => {
    return symbols.find((s) => s.id === selectedSymbol);
  }, [symbols, selectedSymbol]);

  const displayDecimals = useMemo(() => {
    if (symbolMeta?.displayDecimals !== undefined) {
      return symbolMeta.displayDecimals;
    }
    const currentPrice = ticker?.price ?? fxQuote?.mid ?? 0;
    if (currentPrice > 1000) return 2;
    if (currentPrice > 1) return 4;
    return 6;
  }, [symbolMeta, ticker, fxQuote]);

  // Determine provider symbol and asset class
  const isCrypto = useMemo(() => {
    return (
      symbolMeta?.assetClass === "crypto" ||
      symbolMeta?.provider === "binance" ||
      selectedSymbol.endsWith("-USDT") ||
      selectedSymbol.endsWith("USDT")
    );
  }, [symbolMeta, selectedSymbol]);

  const binanceSymbol = useMemo(() => {
    if (symbolMeta?.providerSymbol) {
      return symbolMeta.providerSymbol.toLowerCase();
    }
    return selectedSymbol.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  }, [symbolMeta, selectedSymbol]);

  // WebSocket connection for Binance Live Depth (Only for crypto)
  useEffect(() => {
    if (!isCrypto) {
      if (activeWsRef.current) {
        activeWsRef.current.close();
        activeWsRef.current = null;
      }
      return;
    }

    const wsUrl = `wss://data-stream.binance.vision:9443/ws/${binanceSymbol}@depth20@100ms`;
    let disposed = false;
    let attempts = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
    if (disposed) return;
    const ws = new WebSocket(wsUrl);
    activeWsRef.current = ws;

    ws.onopen = () => {
      if (activeWsRef.current === ws) {
        attempts = 0;
        setWsStatus("live");
      }
    };

    ws.onmessage = (event) => {
      if (activeWsRef.current !== ws) return;

      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data.bids) && Array.isArray(data.asks) && [...data.bids, ...data.asks].every((row: unknown) => Array.isArray(row) && Number.isFinite(Number(row[0])) && Number(row[0]) > 0 && Number.isFinite(Number(row[1])) && Number(row[1]) > 0)) {
          setLiveDepth({
            symbol: binanceSymbol,
            bids: data.bids,
            asks: data.asks,
            timestamp: Date.now(),
          });
        }
      } catch {
        // Ignore parse error
      }
    };

    ws.onerror = () => {
      if (activeWsRef.current === ws) {
        setWsStatus("closed");
      }
    };

    ws.onclose = () => {
      if (!disposed && activeWsRef.current === ws) {
        setWsStatus("closed");
        retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempts++));
      }
    };
    };
    connect();

    return () => {
      disposed = true;
      clearTimeout(retry);
      activeWsRef.current?.close();
      activeWsRef.current = null;
    };
  }, [binanceSymbol, isCrypto]);

  // Compute Bids & Asks directly in render (Rule 2: Don't use useEffect for derived state)
  const { bids, asks, source } = useMemo(() => {
    if (isCrypto && liveDepth && liveDepth.symbol === binanceSymbol && now - liveDepth.timestamp < 15000 && wsStatus === "live" && liveDepth.bids.length > 0 && liveDepth.asks.length > 0) {
      const rawBids = parseRawLevels(liveDepth.bids.slice(0, MAX_LEVELS), false);
      const rawAsks = parseRawLevels(liveDepth.asks.slice(0, MAX_LEVELS), true);

      const maxBidSum = rawBids.reduce((acc, curr) => acc + curr.size, 0);
      const maxAskSum = rawAsks.reduce((acc, curr) => acc + curr.size, 0);
      const maxDepth = Math.max(maxBidSum, maxAskSum);

      return {
        bids: computeLevelsWithDepth(rawBids, maxDepth),
        asks: computeLevelsWithDepth(rawAsks, maxDepth),
        source: "binance_live" as const,
      };
    }

    return { bids: [], asks: [], source: isCrypto && wsStatus === "connecting" ? "connecting" as const : "unavailable" as const };
  }, [isCrypto, liveDepth, binanceSymbol, wsStatus, now]);

  // Computed Spread & Pricing
  const bestBidPrice = bids[0]?.price ?? 0;
  const bestAskPrice = asks[0]?.price ?? 0;
  const spread = bestAskPrice > 0 && bestBidPrice > 0 ? Math.max(0, bestAskPrice - bestBidPrice) : 0;
  const spreadPercent = bestAskPrice > 0 ? (spread / bestAskPrice) * 100 : 0;
  const lastPrice = ticker?.price ?? fxQuote?.mid ?? (bestBidPrice + bestAskPrice) / 2;
  const timestamp = liveDepth?.timestamp ?? ticker?.timestamp ?? 0;
  const isLoading = source === "connecting" && bids.length === 0;

  const data: OrderBookData = {
    symbol: selectedSymbol,
    bids,
    asks,
    spread,
    spreadPercent,
    lastPrice,
    timestamp,
    isLoading,
    source,
    displayDecimals,
  };

  return {
    ...data,
    viewMode,
    setViewMode,
  };
}
