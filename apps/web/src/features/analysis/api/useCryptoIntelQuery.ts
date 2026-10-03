import { useQuery } from "@tanstack/react-query";
import type { CryptoFlow } from "../utils/cryptoFlow";

export const CRYPTO_INTEL_QUERY_KEY = (symbol: string) => ["crypto-intel", symbol] as const;

export async function fetchCryptoIntel(symbol: string, signal?: AbortSignal): Promise<CryptoFlow> {
  const response = await fetch(`/api/crypto-intel?symbol=${encodeURIComponent(symbol)}`, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load crypto intel: ${response.statusText}`);
  }

  return (await response.json()) as CryptoFlow;
}

export function useCryptoIntelQuery(symbol: string, enabled = true) {
  const isSupported = /^[A-Z0-9]{2,15}-USDT$/.test(symbol);

  return useQuery<CryptoFlow, Error>({
    queryKey: CRYPTO_INTEL_QUERY_KEY(symbol),
    queryFn: ({ signal }) => fetchCryptoIntel(symbol, signal),
    enabled: enabled && isSupported,
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
