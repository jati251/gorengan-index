import type {
  MarketTicker,
  StatusEventMessage,
  ProviderStatusLevel,
} from "@gorengan/shared";

export class MarketState {
  private tickers = new Map<string, MarketTicker>();
  private providerStatuses = new Map<string, StatusEventMessage>();

  public setTicker(ticker: MarketTicker): void {
    this.tickers.set(ticker.symbol, ticker);
  }

  public getTicker(symbol: string): MarketTicker | null {
    return this.tickers.get(symbol) || null;
  }

  public getAllTickers(): MarketTicker[] {
    return Array.from(this.tickers.values());
  }

  public getTickersMap(): Record<string, MarketTicker> {
    const result: Record<string, MarketTicker> = {};
    for (const [sym, t] of this.tickers.entries()) {
      result[sym] = t;
    }
    return result;
  }

  public setProviderStatus(
    provider: string,
    connected: boolean,
    status: ProviderStatusLevel,
    lastEventAt: number,
    activeSymbols: string[]
  ): void {
    this.providerStatuses.set(provider, {
      type: "status",
      provider,
      connected,
      status,
      lastEventAt,
      activeSymbols,
    });
  }

  public getProviderStatus(provider: string): StatusEventMessage | null {
    return this.providerStatuses.get(provider) || null;
  }

  public getAllProviderStatuses(): Record<string, StatusEventMessage> {
    const result: Record<string, StatusEventMessage> = {};
    for (const [p, s] of this.providerStatuses.entries()) {
      result[p] = s;
    }
    return result;
  }
}
