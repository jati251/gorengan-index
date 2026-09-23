import type { MarketSymbol } from "@gorengan/shared";
import type { MarketCategory } from "@/stores/marketStore";
import { isUsEquitySymbol, isIdxEquitySymbol } from "@/features/equities";
import { isFxSymbol } from "@/features/forex";

/**
 * Deduplicates an array of market symbols while preserving first-seen order.
 */
export function deduplicateMarketSymbols(symbols: MarketSymbol[]): MarketSymbol[] {
  const seen = new Set<string>();
  const res: MarketSymbol[] = [];
  for (const sym of symbols) {
    if (sym && sym.id && !seen.has(sym.id)) {
      seen.add(sym.id);
      res.push(sym);
    }
  }
  return res;
}

/**
 * Determines whether a symbol belongs to a designated market category.
 */
export function matchesMarketCategory(sym: MarketSymbol, category: MarketCategory): boolean {
  if (category === "all") return true;
  if (category === "us_stocks") {
    return sym.assetClass === "us_stocks" || isUsEquitySymbol(sym.id);
  }
  if (category === "idx_stocks") {
    return sym.assetClass === "idx_stocks" || isIdxEquitySymbol(sym.id);
  }
  if (category === "fx") {
    return sym.assetClass === "fx" || isFxSymbol(sym.id);
  }
  // Strict crypto & metal check — never match fx or equities
  if (sym.assetClass === "fx" || isFxSymbol(sym.id)) return false;
  if (sym.assetClass === "us_stocks" || isUsEquitySymbol(sym.id)) return false;
  if (sym.assetClass === "idx_stocks" || isIdxEquitySymbol(sym.id)) return false;
  return sym.assetClass === "crypto" || sym.assetClass === "metal";
}

/**
 * Filters symbols by search query against symbol ID, name, or base asset.
 */
export function filterSymbolsByQuery(
  symbols: MarketSymbol[],
  query: string
): MarketSymbol[] {
  const q = query.trim().toLowerCase();
  if (!q) return symbols;
  return symbols.filter(
    (sym) =>
      sym.id.toLowerCase().includes(q) ||
      sym.name.toLowerCase().includes(q) ||
      sym.base.toLowerCase().includes(q)
  );
}

/**
 * Obtains quick search autocomplete suggestions across symbols.
 */
export function getSymbolSearchSuggestions(
  symbols: MarketSymbol[],
  query: string,
  limit = 7
): MarketSymbol[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return symbols
    .filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.base.toLowerCase().includes(q)
    )
    .slice(0, limit);
}
