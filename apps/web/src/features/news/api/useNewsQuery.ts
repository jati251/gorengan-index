import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../../services/apiClient";
import type { NewsArticle } from "../types";

export function useNewsQuery() {
  return useQuery({
    queryKey: ["market-news"],
    queryFn: () => apiGet<NewsArticle[]>("/news"),
    refetchInterval: 60 * 1000, // Refresh every 60 seconds
    staleTime: 45 * 1000,
  });
}
