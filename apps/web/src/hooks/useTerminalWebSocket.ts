"use client";

import { useEffect, useRef, useCallback } from "react";
import { ENV } from "../config/env";
import { useMarketStore } from "../stores/marketStore";
import type {
  WebSocketClientMessage,
  MarketTicker,
  Candle,
  Timeframe,
  ProviderStatusLevel,
} from "@gorengan/shared";
import { formatTickerChannel, formatCandleChannel } from "@gorengan/shared";

export function useTerminalWebSocket(subscribedSymbols: string[] = []) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const selectedTimeframe = useMarketStore((s) => s.selectedTimeframe);

  const symbolsRef = useRef(subscribedSymbols);
  useEffect(() => {
    symbolsRef.current = subscribedSymbols;
  }, [subscribedSymbols]);

  const sendMessage = useCallback((msg: WebSocketClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Main persistent connection effect (runs once on mount)
  useEffect(() => {
    let isCancelled = false;

    function connect() {
      if (isCancelled) return;

      try {
        if (useMarketStore.getState().providerStatus !== "CONNECTING") {
          useMarketStore.getState().setProviderStatus("CONNECTING");
        }

        const ws = new WebSocket(ENV.WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isCancelled) {
            ws.close();
            return;
          }
          useMarketStore.getState().setProviderStatus("LIVE");

          // Build subscription list using latest state
          const currentSymbols = symbolsRef.current;
          const currentSelected = useMarketStore.getState().selectedSymbol;
          const currentTimeframe = useMarketStore.getState().selectedTimeframe;

          const channels: string[] = [];
          for (const sym of currentSymbols) {
            channels.push(formatTickerChannel(sym));
            channels.push(formatCandleChannel(sym, "1s"));
            channels.push(formatCandleChannel(sym, "1m"));
          }
          if (currentSelected && !currentSymbols.includes(currentSelected)) {
            channels.push(formatTickerChannel(currentSelected));
            channels.push(formatCandleChannel(currentSelected, currentTimeframe));
          }

          if (channels.length > 0) {
            ws.send(JSON.stringify({ op: "subscribe", channels }));
          }

          // Start ping heartbeat
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ op: "ping" }));
            }
          }, 15000);
        };

        ws.onmessage = (event) => {
          try {
            const raw = JSON.parse(event.data) as Record<string, unknown>;

            switch (raw.type) {
              case "ticker": {
                const t = (raw.ticker ?? {}) as Record<string, unknown>;
                const symbol = String(t.instrument ?? t.symbol ?? "");
                const ticker: MarketTicker = {
                  symbol,
                  price: Number(t.price ?? 0),
                  change24h: Number(t.change_24h ?? t.change24h ?? 0),
                  changePercent24h: Number(t.change_percent_24h ?? t.changePercent24h ?? 0),
                  high24h: Number(t.high_24h ?? t.high24h ?? t.price ?? 0),
                  low24h: Number(t.low_24h ?? t.low24h ?? t.price ?? 0),
                  volume24h: Number(t.volume_24h ?? t.volume24h ?? 0),
                  quoteVolume24h: Number(t.quote_volume_24h ?? t.quoteVolume24h ?? 0),
                  timestamp: t.updated_at_ns
                    ? Math.floor(Number(t.updated_at_ns) / 1_000_000)
                    : Number(t.timestamp ?? Date.now()),
                  provider: String(t.provider ?? "binance"),
                };
                useMarketStore.getState().setTicker(ticker);
                break;
              }
              case "candle": {
                const c = (raw.candle ?? {}) as Record<string, unknown>;
                const symbol = String(c.instrument ?? c.symbol ?? "");
                const timeframe = (c.interval ?? c.timeframe ?? "1s") as Timeframe;
                const openTime = c.open_time_ns
                  ? Math.floor(Number(c.open_time_ns) / 1_000_000)
                  : Number(c.openTime ?? Date.now());
                const closeTime = c.close_time_ns
                  ? Math.floor(Number(c.close_time_ns) / 1_000_000)
                  : Number(c.closeTime ?? Date.now());

                const candle: Candle = {
                  symbol,
                  timeframe,
                  openTime,
                  closeTime,
                  open: Number(c.open ?? 0),
                  high: Number(c.high ?? 0),
                  low: Number(c.low ?? 0),
                  close: Number(c.close ?? 0),
                  volume: Number(c.volume ?? 0),
                  trades: Number(c.trade_count ?? c.trades ?? 0),
                  finalized: Boolean(c.finalized),
                  provider: String(c.provider ?? "binance"),
                };
                useMarketStore.getState().setCandle(candle);
                break;
              }
              case "status": {
                const s = raw.status as Record<string, unknown> | undefined;
                if (typeof s === "object" && s !== null) {
                  const statusStr = String(s.status ?? "LIVE") as ProviderStatusLevel;
                  const lastEventAt = s.last_event_at_ns
                    ? Math.floor(Number(s.last_event_at_ns) / 1_000_000)
                    : Date.now();
                  useMarketStore.getState().setProviderStatus(statusStr, lastEventAt);
                } else if (typeof raw.status === "string") {
                  useMarketStore
                    .getState()
                    .setProviderStatus(raw.status as ProviderStatusLevel, Number(raw.lastEventAt));
                }
                break;
              }
              case "snapshot": {
                const tickers = (raw.tickers ?? {}) as Record<string, MarketTicker>;
                const candles = (raw.candles ?? {}) as Record<string, Candle>;
                useMarketStore.getState().setSnapshot(tickers, candles);
                break;
              }
              case "pong":
                break;
            }
          } catch {
            // Ignore malformed message
          }
        };

        ws.onclose = () => {
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }
          if (isCancelled) return;
          useMarketStore.getState().setProviderStatus("RECONNECTING");
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        };

        ws.onerror = () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        };
      } catch {
        if (!isCancelled) {
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        }
      }
    }

    connect();

    return () => {
      isCancelled = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, []); // Run only on mount

  // Sync subscriptions whenever subscribedSymbols changes without reconnecting
  const symbolsKey = subscribedSymbols.join(",");
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && subscribedSymbols.length > 0) {
      const channels: string[] = [];
      for (const sym of subscribedSymbols) {
        channels.push(formatTickerChannel(sym));
        channels.push(formatCandleChannel(sym, "1s"));
        channels.push(formatCandleChannel(sym, "1m"));
      }
      wsRef.current.send(JSON.stringify({ op: "subscribe", channels }));
    }
  }, [symbolsKey, subscribedSymbols]);

  // When timeframe or selectedSymbol changes, send subscribe for target candle without reconnecting
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedSymbol) {
      const channel = formatCandleChannel(selectedSymbol, selectedTimeframe);
      sendMessage({ op: "subscribe", channels: [channel] });
    }
  }, [selectedSymbol, selectedTimeframe, sendMessage]);

  return { sendMessage };
}
