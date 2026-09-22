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
import type { WebSocketClientMessage, MarketTicker, Candle, FxQuoteTick } from "@gorengan/shared";
import { formatTickerChannel, formatCandleChannel } from "@gorengan/shared";

export interface UseTerminalWebSocketOptions {
  /** If true, buffers incoming high-frequency ticks and flushes them every `throttleMs` */
  isThrottled?: boolean;
  /** Buffer interval in milliseconds (default: 5000ms / 5s) */
  throttleMs?: number;
}

export function useTerminalWebSocket(
  subscribedSymbols: string[] = [],
  options: UseTerminalWebSocketOptions = {}
) {
  const { isThrottled = false, throttleMs = 5000 } = options;
  const isThrottledRef = useRef(isThrottled);
  useEffect(() => {
    isThrottledRef.current = isThrottled;
  }, [isThrottled]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Throttled buffers for preview / guest mode
  const pendingTickersRef = useRef<Map<string, MarketTicker>>(new Map());
  const pendingQuotesRef = useRef<Map<string, FxQuoteTick>>(new Map());
  const pendingCandlesRef = useRef<Map<string, Candle>>(new Map());
  const throttleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const selectedTimeframe = useMarketStore((s) => s.selectedTimeframe);

  const symbolsRef = useRef(subscribedSymbols);
  useEffect(() => {
    symbolsRef.current = subscribedSymbols;
  }, [subscribedSymbols]);

  // Periodic flush for throttled / guest preview mode
  useEffect(() => {
    if (isThrottled) {
      throttleIntervalRef.current = setInterval(() => {
        const store = useMarketStore.getState();

        if (pendingTickersRef.current.size > 0) {
          for (const ticker of pendingTickersRef.current.values()) {
            store.setTicker(ticker);
          }
          pendingTickersRef.current.clear();
        }

        if (pendingQuotesRef.current.size > 0) {
          for (const quote of pendingQuotesRef.current.values()) {
            store.setFxQuote(quote);
          }
          pendingQuotesRef.current.clear();
        }

        if (pendingCandlesRef.current.size > 0) {
          for (const candle of pendingCandlesRef.current.values()) {
            store.setCandle(candle);
          }
          pendingCandlesRef.current.clear();
        }
      }, throttleMs);

      return () => {
        if (throttleIntervalRef.current) {
          clearInterval(throttleIntervalRef.current);
          throttleIntervalRef.current = null;
        }
      };
    }
  }, [isThrottled, throttleMs]);

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
            // Only subscribe to 1s for crypto in unthrottled pro mode; for preview or FX, 1m is base
            if (!isThrottledRef.current && sym.endsWith("USDT")) {
              channels.push(formatCandleChannel(sym, "1s"));
            }
            channels.push(formatCandleChannel(sym, "1m"));
          }
          if (currentSelected && !currentSymbols.includes(currentSelected)) {
            channels.push(formatTickerChannel(currentSelected));
            channels.push(formatCandleChannel(currentSelected, currentTimeframe));
          }

          channels.push("session:*");

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
                if (isThrottledRef.current) {
                  pendingTickersRef.current.set(ticker.symbol, ticker);
                } else {
                  store.setTicker(ticker);
                }
                break;
              }
              case "fx_quote": {
                const quote = parseFxQuote((raw.quote ?? {}) as Record<string, unknown>);
                if (isThrottledRef.current) {
                  pendingQuotesRef.current.set(quote.instrument, quote);
                } else {
                  store.setFxQuote(quote);
                }
                break;
              }
              case "candle": {
                const candle = parseCandle((raw.candle ?? {}) as Record<string, unknown>);
                if (isThrottledRef.current) {
                  const key = `${candle.symbol}:${candle.timeframe}`;
                  pendingCandlesRef.current.set(key, candle);
                } else {
                  store.setCandle(candle);
                }
                break;
              }
              case "session": {
                const s = (raw.session ?? {}) as {
                  market: string;
                  state: string;
                  segment?: string;
                  next_transition_at?: number;
                  ts: number;
                };
                if (s.market && s.state) {
                  store.setSession({
                    market: s.market,
                    state: s.state,
                    segment: s.segment,
                    nextTransitionAt: s.next_transition_at,
                    ts: s.ts ?? Date.now(),
                  });
                }
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
        if (!isThrottledRef.current && sym.endsWith("USDT")) {
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
