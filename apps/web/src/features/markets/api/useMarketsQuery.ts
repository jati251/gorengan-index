import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/services/apiClient";
import { useMarketStore } from "@/stores/marketStore";
import type { MarketsResponse } from "@gorengan/shared";

export function useMarketsQuery() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: async () => {
      const res = await apiGet<MarketsResponse>("/markets");
      if (res?.markets && res.markets.length > 0) {
        useMarketStore.getState().setTickers(res.markets);
      }
      return res;
    },
    refetchInterval: 10000, // Background polling fallback
    staleTime: 5000,
  });
}

