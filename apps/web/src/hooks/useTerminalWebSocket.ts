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
  const activeChannelsRef = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Throttled buffers for preview / guest mode
  const pendingTickersRef = useRef<Map<string, MarketTicker>>(new Map());
  const pendingQuotesRef = useRef<Map<string, FxQuoteTick>>(new Map());
  const pendingCandlesRef = useRef<Map<string, Candle>>(new Map());

  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const selectedTimeframe = useMarketStore((s) => s.selectedTimeframe);

  const symbolsRef = useRef(subscribedSymbols);

  const syncSubscriptions = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const state = useMarketStore.getState();
    const desired = new Set(symbolsRef.current.map(formatTickerChannel));
    if (state.selectedSymbol) {
      desired.add(formatTickerChannel(state.selectedSymbol));
      desired.add(formatCandleChannel(state.selectedSymbol, "1s"));
      if (state.selectedTimeframe !== "1s") {
        desired.add(formatCandleChannel(state.selectedSymbol, state.selectedTimeframe));
      }
    }
    desired.add("session:*");

    const removed = [...activeChannelsRef.current].filter((channel) => !desired.has(channel));
    const added = [...desired].filter((channel) => !activeChannelsRef.current.has(channel));
    if (removed.length) ws.send(JSON.stringify({ op: "unsubscribe", channels: removed }));
    if (added.length) ws.send(JSON.stringify({ op: "subscribe", channels: added }));
    activeChannelsRef.current = desired;
  }, []);

  const rafIdRef = useRef<number | null>(null);

  const flushPending = useCallback(() => {
    const store = useMarketStore.getState();
    if (pendingTickersRef.current.size) {
      store.setTickers([...pendingTickersRef.current.values()]);
      pendingTickersRef.current.clear();
    }
    for (const quote of pendingQuotesRef.current.values()) store.setFxQuote(quote);
    pendingQuotesRef.current.clear();
    for (const candle of pendingCandlesRef.current.values()) store.setCandle(candle);
    pendingCandlesRef.current.clear();
  }, []);

  const scheduleLiveFlush = useCallback(() => {
    if (rafIdRef.current != null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      flushPending();
    });
  }, [flushPending]);

  useEffect(() => {
    if (!isThrottled) return;
    const interval = setInterval(flushPending, throttleMs);
    return () => {
      clearInterval(interval);
      flushPending();
    };
  }, [isThrottled, throttleMs, flushPending]);

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

          activeChannelsRef.current.clear();
          syncSubscriptions();

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
                pendingTickersRef.current.set(ticker.symbol, ticker);
                if (!isThrottledRef.current) {
                  scheduleLiveFlush();
                }
                break;
              }
              case "fx_quote": {
                const quote = parseFxQuote((raw.quote ?? {}) as Record<string, unknown>);
                pendingQuotesRef.current.set(quote.instrument, quote);
                if (!isThrottledRef.current) {
                  scheduleLiveFlush();
                }
                break;
              }
              case "candle": {
                const candle = parseCandle((raw.candle ?? {}) as Record<string, unknown>);
                const key = `${candle.symbol}:${candle.timeframe}`;
                pendingCandlesRef.current.set(key, candle);
                if (!isThrottledRef.current) {
                  scheduleLiveFlush();
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
          activeChannelsRef.current.clear();
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
      activeChannelsRef.current.clear();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [syncSubscriptions, scheduleLiveFlush]);

  const symbolsKey = subscribedSymbols.join(",");
  useEffect(() => {
    symbolsRef.current = subscribedSymbols;
    syncSubscriptions();
  }, [symbolsKey, subscribedSymbols, selectedSymbol, selectedTimeframe, syncSubscriptions]);

  return { sendMessage };
}
