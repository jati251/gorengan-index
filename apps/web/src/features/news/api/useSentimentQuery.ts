import { useQuery } from "@tanstack/react-query";
import type { SentimentData } from "../types";

export function useSentimentQuery() {
  return useQuery({
    queryKey: ["market-sentiment"],
    queryFn: async ({ signal }): Promise<SentimentData> => {
      const response = await fetch("/api/sentiment", { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
      if (!response.ok) throw new Error("sentiment unavailable");
      return response.json();
    },
    refetchInterval: 120 * 1000, // Refresh every 2 minutes
    staleTime: 90 * 1000,
  });
}
