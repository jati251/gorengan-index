import { EventEmitter } from "node:events";
import type { Candle, MarketSymbol, Timeframe } from "@gorengan/shared";
import { DEFAULT_SYMBOLS } from "@gorengan/shared";
import type { MarketProvider, ProviderStatus } from "../market-provider.js";
import { BinanceProvider } from "../binance/binance-provider.js";
import { YahooMarketProvider } from "../yahoo/yahoo-provider.js";
import { generateBaselineCandles } from "../../market/baseline-data.js";
import { logger } from "../../utils/logger.js";

export class CompositeMarketProvider extends EventEmitter implements MarketProvider {
  public readonly id = "composite";

  private binanceProvider: BinanceProvider;
  private yahooProvider: YahooMarketProvider;

  constructor(symbols?: MarketSymbol[]) {
    super();
    const allSymbols = symbols || DEFAULT_SYMBOLS;

    const cryptoSymbols = allSymbols
      .filter((s) => s.assetClass === "crypto" || s.assetClass === "metal" || s.provider === "binance")
      .map((s) => s.id);

    const nonCryptoSymbols = allSymbols.filter(
      (s) => s.assetClass !== "crypto" && s.assetClass !== "metal" && s.provider !== "binance"
    );

    this.binanceProvider = new BinanceProvider(cryptoSymbols);
    this.yahooProvider = new YahooMarketProvider(nonCryptoSymbols);

    // Forward events from child providers
    this.binanceProvider.on("ticker", (ticker) => this.emit("ticker", ticker));
    this.binanceProvider.on("trade", (trade) => this.emit("trade", trade));
    this.binanceProvider.on("status", (status) => this.emit("status", status));
    this.binanceProvider.on("error", (err) => this.emit("error", err));

    this.yahooProvider.on("ticker", (ticker) => this.emit("ticker", ticker));
    this.yahooProvider.on("trade", (trade) => this.emit("trade", trade));
    this.yahooProvider.on("status", (status) => this.emit("status", status));
    this.yahooProvider.on("error", (err) => this.emit("error", err));
  }

  public async connect(): Promise<void> {
    logger.info("Connecting Composite Market Provider (Binance + Yahoo)");
    await Promise.allSettled([
      this.binanceProvider.connect(),
      this.yahooProvider.connect(),
    ]);
  }

  public async disconnect(): Promise<void> {
    logger.info("Disconnecting Composite Market Provider");
    await Promise.allSettled([
      this.binanceProvider.disconnect(),
      this.yahooProvider.disconnect(),
    ]);
  }

  public async getSymbols(): Promise<MarketSymbol[]> {
    return DEFAULT_SYMBOLS;
  }

  public async subscribe(symbols: string[]): Promise<void> {
    const crypto: string[] = [];
    const nonCrypto: string[] = [];

    for (const sym of symbols) {
      if (this.isCryptoSymbol(sym)) {
        crypto.push(sym);
      } else {
        nonCrypto.push(sym);
      }
    }

    if (crypto.length > 0) await this.binanceProvider.subscribe(crypto);
    if (nonCrypto.length > 0) await this.yahooProvider.subscribe(nonCrypto);
  }

  public async unsubscribe(symbols: string[]): Promise<void> {
    const crypto = symbols.filter((s) => this.isCryptoSymbol(s));
    const nonCrypto = symbols.filter((s) => !this.isCryptoSymbol(s));

    if (crypto.length > 0) await this.binanceProvider.unsubscribe(crypto);
    if (nonCrypto.length > 0) await this.yahooProvider.unsubscribe(nonCrypto);
  }

  public async getHistoricalCandles(params: {
    symbol: string;
    timeframe: Timeframe;
    from: number;
    to: number;
  }): Promise<Candle[]> {
    let candles: Candle[] = [];

    try {
      if (this.isCryptoSymbol(params.symbol)) {
        candles = await this.binanceProvider.getHistoricalCandles(params);
      } else {
        candles = await this.yahooProvider.getHistoricalCandles(params);
      }
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, symbol: params.symbol },
        "Primary historical candle provider returned error"
      );
    }

    if (candles.length > 0) {
      return candles;
    }

    // Safety fallback: guaranteed baseline candles so chart is never blank
    logger.info(
      { symbol: params.symbol, timeframe: params.timeframe },
      "Generating baseline fallback candles for chart display"
    );
    return generateBaselineCandles(params.symbol, params.timeframe, params.from, params.to, 500);
  }

  public getStatus(): ProviderStatus {
    const binanceStatus = this.binanceProvider.getStatus();
    const yahooStatus = this.yahooProvider.getStatus();

    return {
      provider: this.id,
      connected: binanceStatus.connected || yahooStatus.connected,
      status: binanceStatus.connected ? "LIVE" : yahooStatus.connected ? "LIVE" : "OFFLINE",
      lastEventAt: Math.max(binanceStatus.lastEventAt, yahooStatus.lastEventAt),
      reconnectCount: binanceStatus.reconnectCount + yahooStatus.reconnectCount,
      subscribedSymbols: [
        ...binanceStatus.subscribedSymbols,
        ...yahooStatus.subscribedSymbols,
      ],
    };
  }

  private isCryptoSymbol(symbol: string): boolean {
    return symbol.endsWith("-USDT") && !symbol.includes(":");
  }
}
