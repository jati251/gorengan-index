import { useQuery } from "@tanstack/react-query";

export interface ExchangeRate {
  rate: number;
  date: string;
  fetchedAt: string;
  source: string;
}

export function useExchangeRate() {
  return useQuery<ExchangeRate>({
    queryKey: ["usd-idr"],
    queryFn: async () => {
      const response = await fetch("/api/exchange-rate");
      if (!response.ok) throw new Error("Exchange rate unavailable");
      return response.json() as Promise<ExchangeRate>;
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
    retry: 1,
  });
}

