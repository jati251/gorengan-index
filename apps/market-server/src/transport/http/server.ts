import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  Candle,
  HealthResponse,
  SymbolsResponse,
  MarketsResponse,
  MarketDetailResponse,
  CandlesResponse,
  Timeframe,
} from "@gorengan/shared";
import { timeframeToMs } from "@gorengan/shared";
import type { CandleRepository } from "../../persistence/candle-repository.js";
import type { MarketState } from "../../market/market-state.js";
import type { CandleEngine } from "../../market/candle-engine.js";
import type { MarketProvider } from "../../providers/market-provider.js";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

const WARMUP_TIMEFRAMES: readonly Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

function mergeWithLiveCandle(
  candles: Candle[],
  liveCandle: Candle | null,
  from: number | undefined,
  to: number | undefined,
  limit: number
): Candle[] {
  if (!liveCandle) return candles;
  if (from !== undefined && liveCandle.openTime < from) return candles;
  if (to !== undefined && liveCandle.openTime > to) return candles;

  if (candles.length === 0) {
    return [liveCandle];
  }

  const lastIdx = candles.length - 1;
  const last = candles[lastIdx];

  if (liveCandle.openTime === last.openTime) {
    const merged: Candle = {
      ...last,
      high: Math.max(last.high, liveCandle.high),
      low: Math.min(last.low, liveCandle.low),
      close: liveCandle.close,
      volume: Math.max(last.volume, liveCandle.volume),
      trades: Math.max(last.trades ?? 0, liveCandle.trades ?? 0),
      finalized: false,
    };
    const copy = candles.slice();
    copy[lastIdx] = merged;
    return copy;
  }

  if (liveCandle.openTime > last.openTime) {
    const next = [...candles, liveCandle];
    return next.length > limit ? next.slice(-limit) : next;
  }

  return candles;
}

export function createHttpServer(
  repository: CandleRepository,
  marketState: MarketState,
  candleEngine: CandleEngine,
  provider: MarketProvider
): http.Server {
  const startTime = Date.now();
  const historyRequests = new Map<string, { expires: number; promise: Promise<void> }>();
  const warmedSymbols = new Map<string, number>();

  const triggerHistoricalFetch = (
    symbol: string,
    timeframe: Timeframe,
    from: number | undefined,
    to: number | undefined,
    limit: number,
    priority: "high" | "normal" | "low"
  ): Promise<void> => {
    const isLatestWindow = from === undefined && to === undefined;
    const requestKey = isLatestWindow
      ? `${symbol}:${timeframe}:latest`
      : `${symbol}:${timeframe}:${from ?? "latest"}:${to ?? "now"}:${limit}`;

    const now = Date.now();
    const existing = historyRequests.get(requestKey);
    if (existing && existing.expires > now) {
      return existing.promise;
    }

    if (historyRequests.size >= 256) {
      const oldestKey = historyRequests.keys().next().value;
      if (oldestKey) historyRequests.delete(oldestKey);
    }

    const promise = (async () => {
      const seedTo = to ?? Date.now();
      const barsToFetch = Math.max(limit, 1000);
      const seedFrom = from ?? seedTo - Math.min(barsToFetch, 1000) * timeframeToMs(timeframe);
      const live = await provider.getHistoricalCandles({
        symbol,
        timeframe,
        from: seedFrom,
        to: seedTo,
        priority,
      });
      if (live.length > 0) {
        const matching = live.filter((c) => c.symbol === symbol && c.timeframe === timeframe);
        repository.saveCandles(matching.length > 0 ? matching : live);
      }
    })().catch((err) => {
      logger.warn({ err, symbol, timeframe }, "Historical refresh failed");
    });

    historyRequests.set(requestKey, {
      expires: now + (isLatestWindow ? 15_000 : 60_000),
      promise,
    });

    return promise;
  };

  const scheduleSymbolWarmup = (symbol: string, activeTimeframe: Timeframe): void => {
    const now = Date.now();
    const lastWarmup = warmedSymbols.get(symbol) ?? 0;
    if (now - lastWarmup < 120_000) return;
    warmedSymbols.set(symbol, now);

    setTimeout(() => {
      for (const tf of WARMUP_TIMEFRAMES) {
        if (tf === activeTimeframe) continue;
        if (
          Number.isFinite(repository.getHistorySyncAgeMs(symbol, tf)) &&
          repository.getExactCacheCount(symbol, tf) >= 50
        ) {
          continue;
        }
        void triggerHistoricalFetch(symbol, tf, undefined, undefined, 1000, "low");
      }
    }, 50);
  };

  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    const host = req.headers.host || `localhost:${config.PORT}`;
    const urlObj = new URL(req.url || "/", `http://${host}`);
    const rawPath = urlObj.pathname;
    const pathname = rawPath.replace(/^\/(?:api|v1)/, "") || "/";

    try {
      // 1. GET /api/health or /v1/health
      if (pathname === "/health") {
        const provStatus = provider.getStatus();
        const body: HealthResponse = {
          status: provStatus.connected && repository.databaseConnected ? "ok" : "degraded",
          version: "0.1.0",
          uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
          database: repository.databaseConnected ? "ok" : "error",
          providers: {
            [provider.id]: {
              connected: provStatus.connected,
              status: provStatus.status,
              lastEventAgoMs: Date.now() - provStatus.lastEventAt,
              subscriptions: provStatus.subscribedSymbols.length,
            },
          },
          timestamp: Date.now(),
        };
        sendJson(res, 200, body);
        return;
      }

      // 2. GET /api/symbols or /v1/symbols
      if (pathname === "/symbols") {
        const symbols = repository.getSymbols();
        const body: SymbolsResponse = { symbols };
        sendJson(res, 200, body);
        return;
      }

      // 3. GET /api/markets or /v1/markets
      if (pathname === "/markets") {
        const markets = marketState.getAllTickers();
        const body: MarketsResponse = {
          markets,
          timestamp: Date.now(),
        };
        sendJson(res, 200, body);
        return;
      }

      // 4. GET /api/markets/:symbol or /v1/markets/:symbol
      if (pathname.startsWith("/markets/")) {
        const rawSymbol = pathname.slice("/markets/".length);
        const symbol = decodeURIComponent(rawSymbol);
        const ticker = marketState.getTicker(symbol);
        const candle1m = candleEngine.getCurrentCandle(symbol, "1m");

        const body: MarketDetailResponse = {
          symbol,
          ticker,
          candle1m,
        };
        sendJson(res, 200, body);
        return;
      }

      // 5. GET /api/candles/:symbol or /v1/candles/:symbol
      if (pathname.startsWith("/candles/")) {
        const rawSymbol = pathname.slice("/candles/".length);
        const symbol = decodeURIComponent(rawSymbol);

        const timeframe = (urlObj.searchParams.get("timeframe") as Timeframe) || "1m";
        const fromStr = urlObj.searchParams.get("from");
        const toStr = urlObj.searchParams.get("to");
        const limitStr = urlObj.searchParams.get("limit");

        const from = fromStr ? Number(fromStr) : undefined;
        const to = toStr ? Number(toStr) : undefined;
        const parsedLimit = limitStr ? parseInt(limitStr, 10) : 500;
        const limit = Number.isNaN(parsedLimit) ? 500 : Math.min(Math.max(parsedLimit, 1), 2000);

        if (!/^[A-Z0-9:.-]{2,30}$/.test(symbol) || !timeframeToMs(timeframe) ||
            (from !== undefined && (!Number.isSafeInteger(from) || from < 0)) ||
            (to !== undefined && (!Number.isSafeInteger(to) || to < 0)) ||
            (from !== undefined && to !== undefined && from > to)) {
          sendJson(res, 400, { error: "Invalid symbol, timeframe or date range" });
          return;
        }
        const isLatestWindow = from === undefined && to === undefined;
        const exactCount = repository.getExactCacheCount(symbol, timeframe);
        const historySyncAgeMs = repository.getHistorySyncAgeMs(symbol, timeframe);
        const minSeededCount = Math.min(limit, 50);

        if (isLatestWindow && Number.isFinite(historySyncAgeMs) && exactCount >= minSeededCount) {
          // Stale-While-Revalidate: serve cached historical + live bars immediately in <1ms,
          // and refresh upstream asynchronously if historical sync is older than 30 seconds.
          if (historySyncAgeMs > 30_000) {
            void triggerHistoricalFetch(symbol, timeframe, undefined, undefined, limit, "normal");
          }
          scheduleSymbolWarmup(symbol, timeframe);
        } else {
          await triggerHistoricalFetch(symbol, timeframe, from, to, limit, "high");
          if (isLatestWindow) {
            scheduleSymbolWarmup(symbol, timeframe);
          }
        }

        const storedCandles = repository.getCandles(symbol, timeframe, from, to, limit);
        const liveCandle = candleEngine.getCurrentCandle(symbol, timeframe);
        const candles = mergeWithLiveCandle(storedCandles, liveCandle, from, to, limit);

        const body: CandlesResponse = {
          symbol,
          timeframe,
          candles,
        };
        sendJson(res, 200, body);
        return;
      }

      // 404
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found", path: pathname }));
    } catch (err) {
      logger.error({ err, path: pathname }, "REST API request error");
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  });

  return server;
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const jsonStr = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(jsonStr),
  });
  res.end(jsonStr);
}
