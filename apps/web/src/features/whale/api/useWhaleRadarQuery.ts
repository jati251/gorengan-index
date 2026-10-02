import { useQuery } from "@tanstack/react-query";
import type { WhaleRadarData } from "../types";

export const WHALE_RADAR_QUERY_KEY = ["whale-radar"] as const;

export async function fetchWhaleRadar(signal?: AbortSignal): Promise<WhaleRadarData> {
  const response = await fetch("/api/whale-radar", {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load whale radar: ${response.statusText}`);
  }

  const data = (await response.json()) as WhaleRadarData;

  // Enrich any 0 amountUsd in transactions with live btcPrice
  if (data.btcPrice > 0 && Array.isArray(data.recentLargeTxs)) {
    for (const tx of data.recentLargeTxs) {
      if (!tx.amountUsd || tx.amountUsd === 0) {
        tx.amountUsd = tx.amountBtc * data.btcPrice;
      }
    }
  }

  return data;
}

export function useWhaleRadarQuery() {
  return useQuery<WhaleRadarData, Error>({
    queryKey: WHALE_RADAR_QUERY_KEY,
    queryFn: ({ signal }) => fetchWhaleRadar(signal),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}
