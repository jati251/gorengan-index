import { useMemo } from "react";
import { DEFAULT_SYMBOLS, type MarketSymbol } from "@gorengan/shared";
import { useSymbolsQuery } from "../api/useSymbolsQuery";

export interface ResolvedSymbolsResult {
  symbols: MarketSymbol[];
  symbolIds: string[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Resolves market symbols by merging server-reported symbols with fallback defaults,
 * guaranteeing deduplicated canonical symbol identities across the application.
 */
export function useResolvedSymbols(): ResolvedSymbolsResult {
  const { data, isLoading, isError } = useSymbolsQuery();
  const serverSymbols = data?.symbols;

  const symbols = useMemo(() => {
    const symbolMap = new Map<string, MarketSymbol>();
    if (serverSymbols && serverSymbols.length > 0) {
      for (const s of serverSymbols) {
        if (s.id && !symbolMap.has(s.id)) {
          symbolMap.set(s.id, s);
        }
      }
    }
    for (const defaultSym of DEFAULT_SYMBOLS) {
      if (defaultSym.id && !symbolMap.has(defaultSym.id)) {
        symbolMap.set(defaultSym.id, defaultSym);
      }
    }
    return Array.from(symbolMap.values());
  }, [serverSymbols]);

  const symbolIds = useMemo(() => symbols.map((s) => s.id), [symbols]);

  return {
    symbols,
    symbolIds,
    isLoading,
    isError,
  };
}
