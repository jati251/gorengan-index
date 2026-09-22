import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/services/apiClient";
import type { MarketsResponse } from "@gorengan/shared";

export function useMarketsQuery() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: () => apiGet<MarketsResponse>("/markets"),
    refetchInterval: 10000, // Background polling fallback
    staleTime: 5000,
  });
}
