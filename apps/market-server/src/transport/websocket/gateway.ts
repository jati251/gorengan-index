import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type {
  WebSocketClientMessage,
  WebSocketServerMessage,
  MarketTicker,
  Candle,
  StatusEventMessage,
} from "@gorengan/shared";
import { formatTickerChannel, formatCandleChannel, parseChannel } from "@gorengan/shared";
import type { MarketState } from "../../market/market-state.js";
import type { CandleEngine } from "../../market/candle-engine.js";
import { logger } from "../../utils/logger.js";

export class MarketWebSocketGateway {
  private wss: WebSocketServer;
  private clientSubs = new Map<WebSocket, Set<string>>();
  private topicSubs = new Map<string, Set<WebSocket>>();
  private marketState: MarketState;
  private candleEngine: CandleEngine;

  constructor(server: Server, marketState: MarketState, candleEngine: CandleEngine) {
    this.marketState = marketState;
    this.candleEngine = candleEngine;

    this.wss = new WebSocketServer({
      noServer: true,
    });

    server.on("upgrade", (request, socket, head) => {
      const pathname = new URL(request.url || "/", "http://localhost").pathname;
      if (
        pathname === "/ws" ||
        pathname === "/v1/stream" ||
        pathname === "/stream" ||
        pathname.startsWith("/ws")
      ) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
      }
    });

    this.wss.on("connection", (ws, req) => {
      const ip = req.socket.remoteAddress;
      logger.info({ ip }, "Client connected to terminal WebSocket gateway");

      this.clientSubs.set(ws, new Set());

      // Send initial snapshot of all active tickers and statuses upon connection
      const snapshot: WebSocketServerMessage = {
        type: "snapshot",
        tickers: this.marketState.getTickersMap(),
        candles: this.candleEngine.getAllCurrentCandles(),
        statuses: this.marketState.getAllProviderStatuses(),
      };
      this.sendJson(ws, snapshot);

      ws.on("message", (data: WebSocket.Data) => {
        this.handleClientMessage(ws, data);
      });

      ws.on("close", () => {
        this.handleClientDisconnect(ws);
      });

      ws.on("error", (err) => {
        logger.warn({ err }, "WebSocket client error");
      });
    });

    logger.info("WebSocket gateway initialized on path /ws");
  }

  public publishTicker(ticker: MarketTicker): void {
    const channel = formatTickerChannel(ticker.symbol);
    const subscribers = this.topicSubs.get(channel);
    if (!subscribers || subscribers.size === 0) return;

    const payload: WebSocketServerMessage = {
      type: "ticker",
      symbol: ticker.symbol,
      ts: ticker.timestamp,
      ticker,
    };
    const serialized = JSON.stringify(payload);

    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  }

  public publishCandle(candle: Candle): void {
    const channel = formatCandleChannel(candle.symbol, candle.timeframe);
    const subscribers = this.topicSubs.get(channel);
    if (!subscribers || subscribers.size === 0) return;

    const payload: WebSocketServerMessage = {
      type: "candle",
      symbol: candle.symbol,
      timeframe: candle.timeframe,
      candle,
    };
    const serialized = JSON.stringify(payload);

    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  }

  public publishStatus(status: StatusEventMessage): void {
    const channel = `status:${status.provider}`;
    const payloadSerialized = JSON.stringify(status);

    const subscribers = this.topicSubs.get(channel);
    if (subscribers) {
      for (const ws of subscribers) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payloadSerialized);
        }
      }
    }

    // Also broadcast status to all connected clients
    for (const ws of this.clientSubs.keys()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payloadSerialized);
      }
    }
  }

  public close(): void {
    this.wss.close();
  }

  private handleClientMessage(ws: WebSocket, data: WebSocket.Data): void {
    try {
      const text = typeof data === "string" ? data : data.toString("utf8");
      const msg = JSON.parse(text) as WebSocketClientMessage;

      if (msg.op === "ping") {
        this.sendJson(ws, { type: "pong", ts: Date.now() });
        return;
      }

      if (msg.op === "subscribe") {
        if (!Array.isArray(msg.channels)) return;
        const subs = this.clientSubs.get(ws);
        if (!subs) return;

        for (const channel of msg.channels) {
          subs.add(channel);
          let topicSet = this.topicSubs.get(channel);
          if (!topicSet) {
            topicSet = new Set();
            this.topicSubs.set(channel, topicSet);
          }
          topicSet.add(ws);

          // Immediate snapshot for newly subscribed topic
          this.sendImmediateTopicSnapshot(ws, channel);
        }
        return;
      }

      if (msg.op === "unsubscribe") {
        if (!Array.isArray(msg.channels)) return;
        const subs = this.clientSubs.get(ws);
        if (!subs) return;

        for (const channel of msg.channels) {
          subs.delete(channel);
          const topicSet = this.topicSubs.get(channel);
          if (topicSet) {
            topicSet.delete(ws);
            if (topicSet.size === 0) {
              this.topicSubs.delete(channel);
            }
          }
        }
      }
    } catch (err) {
      logger.warn({ err }, "Invalid client message received");
      this.sendJson(ws, { type: "error", message: "Malformed JSON payload" });
    }
  }

  private sendImmediateTopicSnapshot(ws: WebSocket, channel: string): void {
    const parsed = parseChannel(channel);
    if (!parsed) return;

    if (parsed.type === "ticker" && parsed.symbol) {
      const ticker = this.marketState.getTicker(parsed.symbol);
      if (ticker) {
        this.sendJson(ws, {
          type: "ticker",
          symbol: ticker.symbol,
          ts: ticker.timestamp,
          ticker,
        });
      }
    } else if (parsed.type === "candle" && parsed.symbol) {
      const candle = this.candleEngine.getCurrentCandle(
        parsed.symbol,
        parsed.timeframe || "1m"
      );
      if (candle) {
        this.sendJson(ws, {
          type: "candle",
          symbol: candle.symbol,
          timeframe: candle.timeframe,
          candle,
        });
      }
    }
  }

  private handleClientDisconnect(ws: WebSocket): void {
    const subs = this.clientSubs.get(ws);
    if (subs) {
      for (const channel of subs) {
        const topicSet = this.topicSubs.get(channel);
        if (topicSet) {
          topicSet.delete(ws);
          if (topicSet.size === 0) {
            this.topicSubs.delete(channel);
          }
        }
      }
    }
    this.clientSubs.delete(ws);
    logger.debug("Client disconnected from WebSocket gateway");
  }

  private sendJson(ws: WebSocket, payload: WebSocketServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }
}
