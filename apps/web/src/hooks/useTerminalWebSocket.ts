"use client";

import { useEffect, useRef, useCallback } from "react";
import { ENV } from "../config/env";
import { useMarketStore } from "../stores/marketStore";
import type {
  WebSocketServerMessage,
  WebSocketClientMessage,
} from "@gorengan/shared";
import { formatTickerChannel, formatCandleChannel } from "@gorengan/shared";

export function useTerminalWebSocket(subscribedSymbols: string[] = []) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const selectedTimeframe = useMarketStore((s) => s.selectedTimeframe);

  const sendMessage = useCallback((msg: WebSocketClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    function connect() {
      if (isCancelled) return;

      try {
        useMarketStore.getState().setProviderStatus("CONNECTING");
        const ws = new WebSocket(ENV.WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isCancelled) {
            ws.close();
            return;
          }
          useMarketStore.getState().setProviderStatus("LIVE");

          // Build channels list
          const channels: string[] = [];
          for (const sym of subscribedSymbols) {
            channels.push(formatTickerChannel(sym));
            channels.push(formatCandleChannel(sym, "1m"));
          }
          if (selectedSymbol && !subscribedSymbols.includes(selectedSymbol)) {
            channels.push(formatTickerChannel(selectedSymbol));
            channels.push(formatCandleChannel(selectedSymbol, "1m"));
          }

          if (channels.length > 0) {
            ws.send(JSON.stringify({ op: "subscribe", channels }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as WebSocketServerMessage;

            switch (data.type) {
              case "ticker":
                useMarketStore.getState().setTicker(data.ticker);
                break;
              case "candle":
                useMarketStore.getState().setCandle(data.candle);
                break;
              case "status":
                useMarketStore.getState().setProviderStatus(data.status, data.lastEventAt);
                break;
              case "snapshot":
                useMarketStore.getState().setSnapshot(data.tickers, data.candles);
                break;
              case "pong":
                break;
            }
          } catch {
            // Ignore malformed message
          }
        };

        ws.onclose = () => {
          if (isCancelled) return;
          useMarketStore.getState().setProviderStatus("RECONNECTING");
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (!isCancelled) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      }
    }

    connect();

    return () => {
      isCancelled = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [subscribedSymbols, selectedSymbol]);

  // When timeframe or selectedSymbol changes, send subscribe for target candle
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedSymbol) {
      const channel = formatCandleChannel(selectedSymbol, selectedTimeframe);
      sendMessage({ op: "subscribe", channels: [channel] });
    }
  }, [selectedSymbol, selectedTimeframe, sendMessage]);

  return { sendMessage };
}
