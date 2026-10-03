import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/services/apiClient";
import type { CandlesResponse, Timeframe } from "@gorengan/shared";

export function useCandlesQuery(symbol: string, timeframe: Timeframe = "1m") {
  return useQuery({
    queryKey: ["candles", symbol, timeframe],
    queryFn: () =>
      apiGet<CandlesResponse>(`/candles/${encodeURIComponent(symbol)}`, {
        timeframe,
        limit: 1000,
      }),
    enabled: !!symbol,
    staleTime: 15 * 1000,
  });
}

export async function fetchOlderCandles(
  symbol: string,
  timeframe: Timeframe,
  to: number,
  limit: number = 500
): Promise<CandlesResponse> {
  return apiGet<CandlesResponse>(`/candles/${encodeURIComponent(symbol)}`, {
    timeframe,
    to,
    limit,
  });
}
