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

  // Priority buffers for the active chart symbol (always flushed at 60fps via rAF)
  const priorityTickersRef = useRef<Map<string, MarketTicker>>(new Map());
  const priorityQuotesRef = useRef<Map<string, FxQuoteTick>>(new Map());
  const pendingCandlesRef = useRef<Map<string, Candle>>(new Map());

  // Throttled buffers for background symbols in market tables
  const pendingTickersRef = useRef<Map<string, MarketTicker>>(new Map());
  const pendingQuotesRef = useRef<Map<string, FxQuoteTick>>(new Map());

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

  const flushPriority = useCallback(() => {
    const hasTickers = priorityTickersRef.current.size > 0;
    const hasQuotes = priorityQuotesRef.current.size > 0;
    const hasCandles = pendingCandlesRef.current.size > 0;
    if (!hasTickers && !hasQuotes && !hasCandles) return;

    const tickers = hasTickers ? [...priorityTickersRef.current.values()] : undefined;
    const quotes = hasQuotes ? [...priorityQuotesRef.current.values()] : undefined;
    const candles = hasCandles ? [...pendingCandlesRef.current.values()] : undefined;

    priorityTickersRef.current.clear();
    priorityQuotesRef.current.clear();
    pendingCandlesRef.current.clear();

    useMarketStore.getState().applyRealtimeBatch({ tickers, quotes, candles });
  }, []);

  const flushPending = useCallback(() => {
    const totalTickers = priorityTickersRef.current.size + pendingTickersRef.current.size;
    const totalQuotes = priorityQuotesRef.current.size + pendingQuotesRef.current.size;
    const totalCandles = pendingCandlesRef.current.size;
    if (totalTickers === 0 && totalQuotes === 0 && totalCandles === 0) return;

    const tickers =
      totalTickers > 0
        ? [...pendingTickersRef.current.values(), ...priorityTickersRef.current.values()]
        : undefined;
    const quotes =
      totalQuotes > 0
        ? [...pendingQuotesRef.current.values(), ...priorityQuotesRef.current.values()]
        : undefined;
    const candles = totalCandles > 0 ? [...pendingCandlesRef.current.values()] : undefined;

    priorityTickersRef.current.clear();
    priorityQuotesRef.current.clear();
    pendingTickersRef.current.clear();
    pendingQuotesRef.current.clear();
    pendingCandlesRef.current.clear();

    useMarketStore.getState().applyRealtimeBatch({ tickers, quotes, candles });
  }, []);

  const scheduleLiveFlush = useCallback(() => {
    if (rafIdRef.current != null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (isThrottledRef.current) {
        flushPriority();
      } else {
        flushPending();
      }
    });
  }, [flushPending, flushPriority]);

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
                if (!isThrottledRef.current || ticker.symbol === store.selectedSymbol) {
                  priorityTickersRef.current.set(ticker.symbol, ticker);
                  scheduleLiveFlush();
                } else {
                  pendingTickersRef.current.set(ticker.symbol, ticker);
                }
                break;
              }
              case "fx_quote": {
                const quote = parseFxQuote((raw.quote ?? {}) as Record<string, unknown>);
                if (!isThrottledRef.current || quote.instrument === store.selectedSymbol) {
                  priorityQuotesRef.current.set(quote.instrument, quote);
                  scheduleLiveFlush();
                } else {
                  pendingQuotesRef.current.set(quote.instrument, quote);
                }
                break;
              }
              case "candle": {
                const candle = parseCandle((raw.candle ?? {}) as Record<string, unknown>);
                const key = `${candle.symbol}:${candle.timeframe}`;
                pendingCandlesRef.current.set(key, candle);
                scheduleLiveFlush();
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
