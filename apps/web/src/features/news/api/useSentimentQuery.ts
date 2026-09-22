import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/services/apiClient";
import type { SentimentData } from "../types";

export function useSentimentQuery() {
  return useQuery({
    queryKey: ["market-sentiment"],
    queryFn: () => apiGet<SentimentData>("/sentiment"),
    refetchInterval: 120 * 1000, // Refresh every 2 minutes
    staleTime: 90 * 1000,
  });
}
