"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CandlesResponse } from "@gorengan/shared";
import { apiGet } from "@/services/apiClient";
import { useMarketStore } from "@/stores/marketStore";
import { analyzeCandles, cleanCandles } from "../utils/analysis";

export function useAnalysis() {
  const symbol = useMarketStore((s) => s.selectedSymbol);
  const timeframe = useMarketStore((s) => s.selectedTimeframe);
  const query = useQuery({
    queryKey: ["candles", symbol, timeframe],
    queryFn: () => apiGet<CandlesResponse>(`/candles/${encodeURIComponent(symbol)}`, { timeframe, limit: 1000 }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const candles = useMemo(() => {
    if (query.data?.symbol !== symbol || query.data?.timeframe !== timeframe || query.isPlaceholderData) return [];
    return cleanCandles(query.data.candles, symbol, timeframe);
  }, [query.data, query.isPlaceholderData, symbol, timeframe]);
  const analysis = useMemo(() => analyzeCandles(candles), [candles]);
  return { ...query, candles, analysis, symbol, timeframe };
}
