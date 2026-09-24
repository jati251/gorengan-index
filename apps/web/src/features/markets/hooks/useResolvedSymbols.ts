import { useMemo } from "react";
import { DEFAULT_SYMBOLS, type MarketSymbol } from "@gorengan/shared";
import { useSymbolsQuery } from "../api/useSymbolsQuery";

export interface ResolvedSymbolsResult {
  symbols: MarketSymbol[];
  symbolIds: string[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}

/**
 * Resolves market symbols by merging server-reported symbols with fallback defaults,
 * guaranteeing deduplicated canonical symbol identities across the application.
 */
export function useResolvedSymbols(): ResolvedSymbolsResult {
  const { data, isLoading, isError, refetch } = useSymbolsQuery();
  const serverSymbols = data?.symbols;

  const symbols = useMemo(() => {
    const symbolMap = new Map<string, MarketSymbol>();
    if (serverSymbols) {
      for (const s of serverSymbols) {
        if (s.id && !symbolMap.has(s.id)) {
          symbolMap.set(s.id, s);
        }
      }
      return Array.from(symbolMap.values());
    }
    if (!isLoading) {
      for (const defaultSym of DEFAULT_SYMBOLS) {
        if (defaultSym.id && !symbolMap.has(defaultSym.id)) {
          symbolMap.set(defaultSym.id, defaultSym);
        }
      }
    }
    return Array.from(symbolMap.values());
  }, [serverSymbols, isLoading]);

  const symbolIds = useMemo(() => symbols.map((s) => s.id), [symbols]);

  return {
    symbols,
    symbolIds,
    isLoading,
    isError,
    refetch,
  };
}
