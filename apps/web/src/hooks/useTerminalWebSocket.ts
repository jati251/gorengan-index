"use client";

import { useEffect, useRef, useCallback } from "react";
import { ENV } from "@/config/env";
import { useMarketStore } from "@/stores/marketStore";
import {
  parseTicker,
  parseFxQuote,
  parseCandle,
  parseStatus,
  type WsServerMessage,
} from "@/services/wsMessageParser";
import type { WebSocketClientMessage, MarketTicker, Candle } from "@gorengan/shared";
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
            // Only subscribe to 1s for crypto; for FX, 1m is the base timeframe
            if (sym.endsWith("USDT")) {
              channels.push(formatCandleChannel(sym, "1s"));
            }
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
            const raw = JSON.parse(event.data) as WsServerMessage;
            const store = useMarketStore.getState();

            switch (raw.type) {
              case "ticker": {
                const ticker = parseTicker((raw.ticker ?? {}) as Record<string, unknown>);
                store.setTicker(ticker);
                break;
              }
              case "fx_quote": {
                const quote = parseFxQuote((raw.quote ?? {}) as Record<string, unknown>);
                store.setFxQuote(quote);
                break;
              }
              case "candle": {
                const candle = parseCandle((raw.candle ?? {}) as Record<string, unknown>);
                store.setCandle(candle);
                break;
              }
              case "status": {
                const parsed = parseStatus(raw);
                if (parsed) {
                  store.setProviderStatus(parsed.status, parsed.lastEventAt);
                }
                break;
              }
              case "snapshot": {
                const tickers = (raw.tickers ?? {}) as Record<string, MarketTicker>;
                const candles = (raw.candles ?? {}) as Record<string, Candle>;
                store.setSnapshot(tickers, candles);
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
        if (sym.endsWith("USDT")) {
          channels.push(formatCandleChannel(sym, "1s"));
        }
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
