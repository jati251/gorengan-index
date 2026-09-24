"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
}

/**
 * Hook to stream and manage live Order Book depth data.
 * Directly consumes Binance depth20@100ms WebSocket for crypto,
 * or derives synthetic Level-1 quote ladder for FX / stocks during render.
 */
export function useOrderBook() {
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

    const wsUrl = `wss://stream.binance.com:9443/ws/${binanceSymbol}@depth20@100ms`;
    const ws = new WebSocket(wsUrl);
    activeWsRef.current = ws;

    ws.onopen = () => {
      if (activeWsRef.current === ws) {
        setWsStatus("live");
      }
    };

    ws.onmessage = (event) => {
      if (activeWsRef.current !== ws) return;

      try {
        const data = JSON.parse(event.data);
        if (data.bids && data.asks) {
          setLiveDepth({
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
      if (activeWsRef.current === ws) {
        setWsStatus("closed");
      }
    };

    return () => {
      ws.close();
      if (activeWsRef.current === ws) {
        activeWsRef.current = null;
      }
    };
  }, [binanceSymbol, isCrypto]);

  // Compute Bids & Asks directly in render (Rule 2: Don't use useEffect for derived state)
  const { bids, asks, source } = useMemo(() => {
    if (isCrypto && liveDepth && liveDepth.bids.length > 0) {
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

    // Synthetic Ladder for non-crypto or while awaiting WebSocket
    const basePrice =
      ticker?.price ||
      (fxQuote ? fxQuote.mid : 0) ||
      (selectedSymbol.startsWith("ID:") ? 5000 : 100);

    const spreadFactor = selectedSymbol.startsWith("ID:") ? 0.005 : 0.0003;
    const halfSpread = basePrice * spreadFactor;
    const bestBid = basePrice - halfSpread;
    const bestAsk = basePrice + halfSpread;

    const syntheticBids: { price: number; size: number }[] = [];
    const syntheticAsks: { price: number; size: number }[] = [];

    const tickStep = basePrice * 0.0005;

    for (let i = 0; i < 10; i++) {
      const bidP = Math.max(0.000001, bestBid - i * tickStep);
      const askP = bestAsk + i * tickStep;
      const sizeMultiplier = Math.max(0.1, 1 + Math.sin(i * 1.2) * 0.5 + i * 0.2);
      const baseQty = basePrice > 1000 ? 0.5 : basePrice > 10 ? 50 : 5000;

      syntheticBids.push({
        price: bidP,
        size: Math.round(baseQty * sizeMultiplier * 100) / 100,
      });

      syntheticAsks.push({
        price: askP,
        size: Math.round(baseQty * (sizeMultiplier * 0.95) * 100) / 100,
      });
    }

    const maxBidSum = syntheticBids.reduce((a, b) => a + b.size, 0);
    const maxAskSum = syntheticAsks.reduce((a, b) => a + b.size, 0);
    const maxDepth = Math.max(maxBidSum, maxAskSum);

    return {
      bids: computeLevelsWithDepth(syntheticBids, maxDepth),
      asks: computeLevelsWithDepth(syntheticAsks, maxDepth),
      source: isCrypto && wsStatus === "connecting" ? ("connecting" as const) : ("synthetic" as const),
    };
  }, [isCrypto, liveDepth, ticker?.price, fxQuote, selectedSymbol, wsStatus]);

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
