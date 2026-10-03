import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
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

export function createHttpServer(
  repository: CandleRepository,
  marketState: MarketState,
  candleEngine: CandleEngine,
  provider: MarketProvider
): http.Server {
  const startTime = Date.now();
  const historyRequests = new Map<string, { expires: number; promise: Promise<void> }>();

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
        const requestKey = `${symbol}:${timeframe}:${from ?? "latest"}:${to ?? "now"}:${limit}`;
        const cached = historyRequests.get(requestKey);
        if (cached && cached.expires > Date.now()) await cached.promise;
        else {
          if (historyRequests.size >= 128) historyRequests.delete(historyRequests.keys().next().value!);
          const promise = (async () => {
            const seedTo = to ?? Date.now();
            const seedFrom = from ?? seedTo - Math.min(limit, 1000) * timeframeToMs(timeframe);
            const live = await provider.getHistoricalCandles({ symbol, timeframe, from: seedFrom, to: seedTo });
            repository.saveCandles(live.filter((c) => c.symbol === symbol && c.timeframe === timeframe));
          })().catch((err) => { logger.warn({ err, symbol }, "Historical refresh failed"); });
          historyRequests.set(requestKey, { expires: Date.now() + 15000, promise });
          await promise;
        }
        const candles = repository.getCandles(symbol, timeframe, from, to, limit);

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
