import { useQuery } from "@tanstack/react-query";
import type { NewsArticle } from "../types";

export function useNewsQuery() {
  return useQuery({
    queryKey: ["market-news"],
    queryFn: async ({ signal }): Promise<NewsArticle[]> => {
      const response = await fetch("/api/news", { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
      if (!response.ok) throw new Error("news unavailable");
      return response.json();
    },
    refetchInterval: 60 * 1000, // Refresh every 60 seconds
    staleTime: 45 * 1000,
  });
}
