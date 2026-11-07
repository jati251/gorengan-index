"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from "lightweight-charts";
import { TIMEFRAME_MS, type Candle, type Timeframe } from "@gorengan/shared";
import {
  useCandlesQuery,
  fetchOlderCandles,
  getCandlesQueryKey,
} from "../api/useCandlesQuery";
import { useMarketStore } from "@/stores/marketStore";
import { toLocalChartTime } from "@/utils/formatters";
import { DataState } from "@/components/ui/data-state";
import { OhlcLegend, type OhlcData, type OhlcLegendHandle } from "./OhlcLegend";
import {
  calculateEMAWithState,
  stepIncrementalEMA,
  type EmaIncrementalState,
} from "../utils/indicators";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "@/features/i18n";
import {
  CHART_COLORS,
  createChartOptions,
  isSubMinuteTimeframe,
} from "../utils/chartConfig";
import { isFxSymbol, getFxMetadata } from "@/features/forex";
import { isUsEquitySymbol, isIdxEquitySymbol } from "@/features/equities";

function getChartPrecision(
  isId: boolean,
  isUs: boolean,
  isFx: boolean,
  fxDecimals?: number
): number {
  if (isId) return 0;
  if (isUs) return 2;
  if (isFx) return fxDecimals ?? 5;
  return 2;
}

function ensureSortedCandles(candles: Candle[]): Candle[] {
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].openTime < candles[i - 1].openTime) {
      return [...candles].sort((a, b) => a.openTime - b.openTime);
    }
  }
  return candles;
}

function upsertLiveBarInMemory(
  candles: Candle[],
  symbol: string,
  timeframe: Timeframe,
  bucketStartMs: number,
  bucketMs: number,
  bar: { open: number; high: number; low: number; close: number; volume: number }
): void {
  const len = candles.length;
  const liveCandle: Candle = {
    symbol,
    timeframe,
    openTime: bucketStartMs,
    closeTime: bucketStartMs + bucketMs - 1,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    finalized: false,
  };

  if (len === 0) {
    candles.push(liveCandle);
    return;
  }

  const last = candles[len - 1];
  if (last.openTime === bucketStartMs) {
    candles[len - 1] = liveCandle;
  } else if (bucketStartMs > last.openTime) {
    last.finalized = true;
    candles.push(liveCandle);
    if (candles.length > 2000) {
      candles.shift();
    }
  }
}

interface TradingViewChartProps {
  symbol: string;
  className?: string;
  terminalTheme?: boolean;
}

export function TradingViewChart({ symbol, className, terminalTheme = false }: TradingViewChartProps) {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema20StateRef = useRef<EmaIncrementalState | null>(null);
  const ema50StateRef = useRef<EmaIncrementalState | null>(null);
  const legendRef = useRef<OhlcLegendHandle | null>(null);

  const activeBarRef = useRef<{
    bucketStartMs: number;
    chartTime: Time;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null>(null);
  const last1sOpenTimeRef = useRef<number>(0);
  const lastViewKeyRef = useRef<string>("");
  const lastRenderedCountRef = useRef<number>(0);

  const selectedTimeframe = useMarketStore((s) => s.selectedTimeframe);
  const showEma20 = useMarketStore((s) => s.showEma20);
  const showEma50 = useMarketStore((s) => s.showEma50);
  const showVolume = useMarketStore((s) => s.showVolume);
  const { dict } = useTranslation();

  const isFx = isFxSymbol(symbol);
  const isUs = isUsEquitySymbol(symbol);
  const isId = isIdxEquitySymbol(symbol);
  const fxMeta = getFxMetadata(symbol);

  // Precision: IDX stocks have 0 decimals (Rupiah integer), US stocks have 2 decimals, FX 3-5, Crypto 2
  const precision = getChartPrecision(isId, isUs, isFx, fxMeta?.displayDecimals);
  const minMove = precision === 0 ? 1 : 1 / Math.pow(10, precision);

  const {
    data: candlesData,
    isLoading,
    isFetching,
    isPlaceholderData,
    isError,
    refetch,
  } = useCandlesQuery(symbol, selectedTimeframe);
  const candlesDataRef = useRef(candlesData);
  const allCandlesRef = useRef<Candle[]>([]);
  const isLoadingOlderRef = useRef<boolean>(false);
  const hasMoreOlderRef = useRef<boolean>(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [liveFallbackViewKey, setLiveFallbackViewKey] = useState<string>("");

  const symbolRef = useRef(symbol);
  const timeframeRef = useRef(selectedTimeframe);

  // Derived latest candle from historical candles query for initial OhlcLegend render
  const queryLatestCandle = useMemo<OhlcData | null>(() => {
    const candles = candlesData?.candles;
    if (!candles || candles.length === 0) return null;
    const last = candles[candles.length - 1];
    return {
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      volume: last.volume,
      time: toLocalChartTime(last.openTime) as Time,
    };
  }, [candlesData]);

  // Single-pass O(N) helper to format and render candles to Lightweight Chart series
  const renderCandlesToSeries = useCallback((candles: Candle[], fitViewport = false) => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) {
      return;
    }

    if (candles.length === 0) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      ema20SeriesRef.current?.setData([]);
      ema50SeriesRef.current?.setData([]);
      ema20StateRef.current = null;
      ema50StateRef.current = null;
      lastRenderedCountRef.current = 0;
      return;
    }

    const sorted = ensureSortedCandles(candles);

    const formattedCandles: CandlestickData<Time>[] = [];
    const formattedVolumes: HistogramData<Time>[] = [];
    const closeData: { time: Time; close: number }[] = [];

    let prevTime = -1;
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      const timeNum = toLocalChartTime(c.openTime);
      const time = timeNum as Time;
      const candlePoint: CandlestickData<Time> = {
        time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      };
      const volPoint: HistogramData<Time> = {
        time,
        value: c.volume,
        color: c.close >= c.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
      };

      if (timeNum === prevTime && formattedCandles.length > 0) {
        const lastIdx = formattedCandles.length - 1;
        formattedCandles[lastIdx] = candlePoint;
        formattedVolumes[lastIdx] = volPoint;
        closeData[lastIdx] = { time, close: c.close };
      } else if (timeNum > prevTime) {
        formattedCandles.push(candlePoint);
        formattedVolumes.push(volPoint);
        closeData.push({ time, close: c.close });
        prevTime = timeNum;
      }
    }

    try {
      candleSeriesRef.current.setData(formattedCandles);
      volumeSeriesRef.current.setData(formattedVolumes);

      // Track active latest bar for live synthesizing
      const lastFormatted = formattedCandles[formattedCandles.length - 1];
      const lastRaw = sorted[sorted.length - 1];
      if (lastFormatted && lastRaw) {
        const bucketStartMs = lastRaw.openTime;
        activeBarRef.current = {
          bucketStartMs,
          chartTime: lastFormatted.time,
          open: lastFormatted.open,
          high: lastFormatted.high,
          low: lastFormatted.low,
          close: lastFormatted.close,
          volume: Number(formattedVolumes[formattedVolumes.length - 1]?.value ?? 0),
        };
      }

      // Calculate EMAs and capture O(1) incremental states for real-time streaming
      const ema20 = calculateEMAWithState(closeData, 20);
      ema20StateRef.current = ema20.state;
      if (ema20SeriesRef.current) {
        ema20SeriesRef.current.setData(ema20.points);
      }

      const ema50 = calculateEMAWithState(closeData, 50);
      ema50StateRef.current = ema50.state;
      if (ema50SeriesRef.current) {
        ema50SeriesRef.current.setData(ema50.points);
      }

      if (fitViewport) {
        if (formattedCandles.length >= 30) {
          chartRef.current?.timeScale().fitContent();
        } else {
          chartRef.current?.timeScale().applyOptions({ barSpacing: 12 });
        }
        chartRef.current?.timeScale().scrollToPosition(0, false);
      }
      lastRenderedCountRef.current = formattedCandles.length;
    } catch (err) {
      console.warn("Error setting candle data:", err);
    }
  }, []);

  // Initialize Lightweight Chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 420;

    const chart = createChart(
      containerRef.current,
      createChartOptions(width, height, isSubMinuteTimeframe(selectedTimeframe), terminalTheme)
    );

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.candleUp,
      downColor: CHART_COLORS.candleDown,
      borderVisible: false,
      wickUpColor: CHART_COLORS.candleUp,
      wickDownColor: CHART_COLORS.candleDown,
      priceLineVisible: true,
      priceFormat: {
        type: "price",
        precision,
        minMove,
      },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume_scale",
      visible: (!isFx || isUs || isId) && showVolume,
    });

    chart.priceScale("volume_scale").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const ema20Series = chart.addSeries(LineSeries, {
      color: CHART_COLORS.ema20,
      lineWidth: 2,
      priceLineVisible: false,
      title: "EMA 20",
    });

    const ema50Series = chart.addSeries(LineSeries, {
      color: CHART_COLORS.ema50,
      lineWidth: 2,
      priceLineVisible: false,
      title: "EMA 50",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;
    ema20SeriesRef.current = ema20Series;
    ema50SeriesRef.current = ema50Series;

    // Handle crosshair move for dynamic OHLC Legend without re-rendering TradingViewChart
    chart.subscribeCrosshairMove((param) => {
      if (
        !param.time ||
        param.point === undefined ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        legendRef.current?.setHoveredCandle(null);
        return;
      }

      const candleData = param.seriesData.get(candlestickSeries) as
        | CandlestickData<Time>
        | undefined;
      const volData = param.seriesData.get(volumeSeries) as
        | HistogramData<Time>
        | undefined;

      if (candleData) {
        legendRef.current?.setHoveredCandle({
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData?.value ?? 0,
          time: param.time,
        });
      } else {
        legendRef.current?.setHoveredCandle(null);
      }
    });

    // Handle container resize and recover from narrow initial hydration widths
    let lastWidth = width;
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width: rw, height: rh } = entries[0].contentRect;
      if (rw > 0 && rh > 0) {
        const expandedFromNarrow = lastWidth < 360 && rw >= 360;
        lastWidth = rw;
        if (!chart.autoSizeActive()) {
          chart.resize(rw, rh, true);
        }
        if (expandedFromNarrow && lastRenderedCountRef.current > 0) {
          if (lastRenderedCountRef.current >= 30) {
            chart.timeScale().fitContent();
          }
          chart.timeScale().scrollToPosition(0, false);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    // Handle infinite scrolling / lazy load older candles when panning left
    chart.timeScale().subscribeVisibleLogicalRangeChange(async (logicalRange) => {
      if (!logicalRange) return;
      if (
        logicalRange.from < 15 &&
        !isLoadingOlderRef.current &&
        hasMoreOlderRef.current &&
        allCandlesRef.current.length > 0
      ) {
        isLoadingOlderRef.current = true;
        setIsLoadingOlder(true);

        try {
          const currentAll = allCandlesRef.current;
          const oldestCandle = currentAll[0];
          if (!oldestCandle) {
            hasMoreOlderRef.current = false;
            return;
          }

          const targetTo = oldestCandle.openTime - 1;
          const olderResponse = await fetchOlderCandles(
            symbolRef.current,
            timeframeRef.current,
            targetTo,
            500
          );

          const olderCandles = olderResponse?.candles ?? [];
          const strictlyOlder = olderCandles.filter((c) => c.openTime < oldestCandle.openTime);

          if (strictlyOlder.length === 0) {
            hasMoreOlderRef.current = false;
          } else {
            const combined = [...strictlyOlder, ...allCandlesRef.current];
            const seen = new Set<number>();
            const unique: Candle[] = [];
            for (const c of combined) {
              if (!seen.has(c.openTime)) {
                seen.add(c.openTime);
                unique.push(c);
              }
            }
            unique.sort((a, b) => a.openTime - b.openTime);
            allCandlesRef.current = unique;

            renderCandlesToSeries(unique, false);
          }
        } catch (err) {
          console.warn("Failed to load older historical candles:", err);
        } finally {
          isLoadingOlderRef.current = false;
          setIsLoadingOlder(false);
        }
      }
    });

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema20SeriesRef.current = null;
      ema50SeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chart instance must only be created once on mount; selectedTimeframe changes are handled by a separate effect
  }, []);

  // Sync indicator visibility
  useEffect(() => {
    ema20SeriesRef.current?.applyOptions({ visible: showEma20 });
    ema50SeriesRef.current?.applyOptions({ visible: showEma50 });
    volumeSeriesRef.current?.applyOptions({ visible: !isFx && showVolume });
  }, [showEma20, showEma50, showVolume, isFx]);

  // Update chart historical data whenever TanStack query resolves or timeframe changes
  useEffect(() => {
    candlesDataRef.current = candlesData;
    symbolRef.current = symbol;
    timeframeRef.current = selectedTimeframe;

    if (!candleSeriesRef.current || !volumeSeriesRef.current) {
      return;
    }

    const viewKey = `${symbol}:${selectedTimeframe}`;
    const isNewView = lastViewKeyRef.current !== viewKey;

    if (isNewView) {
      chartRef.current?.timeScale().applyOptions({
        secondsVisible: isSubMinuteTimeframe(selectedTimeframe),
      });
      hasMoreOlderRef.current = true;
      isLoadingOlderRef.current = false;
    }

    const incoming = candlesData?.candles ?? [];
    if (incoming.length === 0) {
      if (isNewView) {
        allCandlesRef.current = [];
        activeBarRef.current = null;
        renderCandlesToSeries([], false);
      }
      return;
    }

    const merged = incoming.slice();
    // Preserve any newer live bar already streamed for this exact viewKey
    if (activeBarRef.current) {
      const bucketMs = TIMEFRAME_MS[selectedTimeframe] ?? 60_000;
      upsertLiveBarInMemory(
        merged,
        symbol,
        selectedTimeframe,
        activeBarRef.current.bucketStartMs,
        bucketMs,
        activeBarRef.current
      );
    }

    allCandlesRef.current = merged;
    const upgradedFromSparse = lastRenderedCountRef.current < 30 && merged.length >= 30;
    lastViewKeyRef.current = viewKey;

    renderCandlesToSeries(merged, isNewView || upgradedFromSparse);
  }, [candlesData, symbol, selectedTimeframe, renderCandlesToSeries]);

  // Subscribe to realtime live candle stream & tick updates from Zustand store
  useEffect(() => {
    let lastProcessedVersion = "";
    activeBarRef.current = null;
    last1sOpenTimeRef.current = 0;

    const currentViewKey = `${symbol}:${selectedTimeframe}`;
    const bucketMs = TIMEFRAME_MS[selectedTimeframe] ?? 60_000;

    const pushLiveUpdates = (
      chartTime: Time,
      open: number,
      high: number,
      low: number,
      close: number,
      volume: number,
      bucketStartMs: number
    ) => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

      candleSeriesRef.current.update({
        time: chartTime,
        open,
        high,
        low,
        close,
      });

      volumeSeriesRef.current.update({
        time: chartTime,
        value: volume,
        color: close >= open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
      });

      if (ema20StateRef.current && ema20SeriesRef.current) {
        const pt20 = stepIncrementalEMA(ema20StateRef.current, chartTime, close);
        if (pt20) ema20SeriesRef.current.update(pt20);
      }

      if (ema50StateRef.current && ema50SeriesRef.current) {
        const pt50 = stepIncrementalEMA(ema50StateRef.current, chartTime, close);
        if (pt50) ema50SeriesRef.current.update(pt50);
      }

      upsertLiveBarInMemory(
        allCandlesRef.current,
        symbol,
        selectedTimeframe,
        bucketStartMs,
        bucketMs,
        { open, high, low, close, volume }
      );

      legendRef.current?.setLiveCandle({
        open,
        high,
        low,
        close,
        volume,
        time: chartTime,
      });

      if (!candlesDataRef.current?.candles?.length) {
        setLiveFallbackViewKey((prev) => (prev === currentViewKey ? prev : currentViewKey));
      }
    };

    const unsubscribe = useMarketStore.subscribe((state) => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

      const directCandle = state.candles[`${symbol}:${selectedTimeframe}`];
      const candle1s = state.candles[`${symbol}:1s`];
      const ticker = state.tickers[symbol];

      if (!directCandle && !candle1s && !ticker) return;

      const versionKey = `${directCandle?.openTime}_${directCandle?.close}_${directCandle?.volume}_${candle1s?.openTime}_${candle1s?.close}_${candle1s?.volume}_${ticker?.price}_${ticker?.timestamp}`;
      if (versionKey === lastProcessedVersion) return;
      lastProcessedVersion = versionKey;

      if (selectedTimeframe === "1s") {
        const live = candle1s || directCandle;
        const tickPrice = live?.close ?? ticker?.price;
        if (tickPrice == null || !Number.isFinite(tickPrice)) return;

        const openTime =
          live?.openTime ?? Math.floor((ticker?.timestamp ?? Date.now()) / 1000) * 1000;
        if (allCandlesRef.current.length > 0) {
          const lastHist = allCandlesRef.current[allCandlesRef.current.length - 1];
          if (openTime < lastHist.openTime) return;
        }

        const time = toLocalChartTime(openTime) as Time;
        const prevBar = activeBarRef.current;
        const isSameSecond = prevBar && prevBar.bucketStartMs === openTime;

        const open = isSameSecond ? prevBar.open : (live?.open ?? tickPrice);
        const high = Math.max(
          isSameSecond ? prevBar.high : tickPrice,
          live?.high ?? tickPrice,
          tickPrice
        );
        const low = Math.min(
          isSameSecond ? prevBar.low : tickPrice,
          live?.low ?? tickPrice,
          tickPrice
        );
        const close = tickPrice;
        const volume = Math.max(isSameSecond ? prevBar.volume : 0, live?.volume ?? 0);

        activeBarRef.current = {
          bucketStartMs: openTime,
          chartTime: time,
          open,
          high,
          low,
          close,
          volume,
        };

        try {
          pushLiveUpdates(time, open, high, low, close, volume, openTime);
        } catch {
          // Ignore duplicate / out-of-order ticks
        }
        return;
      }

      // For any non-1s timeframe (5s, 15s, 30s, 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w):
      const tickTimeMs =
        Math.max(
          candle1s?.openTime ?? 0,
          ticker?.timestamp ?? 0,
          directCandle?.openTime ?? 0
        ) || Date.now();

      let bucketStartMs = Math.floor(tickTimeMs / bucketMs) * bucketMs;
      if (allCandlesRef.current.length > 0) {
        const lastHist = allCandlesRef.current[allCandlesRef.current.length - 1];
        if (tickTimeMs >= lastHist.openTime && tickTimeMs < lastHist.openTime + bucketMs) {
          bucketStartMs = lastHist.openTime;
        } else if (bucketStartMs < lastHist.openTime) {
          return;
        }
      }

      const isDirectMatching = Boolean(directCandle && directCandle.openTime === bucketStartMs);
      const is1sMatching = Boolean(
        candle1s &&
          candle1s.openTime >= bucketStartMs &&
          candle1s.openTime < bucketStartMs + bucketMs
      );

      const tickPrice =
        (is1sMatching ? candle1s?.close : undefined) ??
        ticker?.price ??
        (isDirectMatching ? directCandle?.close : undefined);
      if (tickPrice == null || !Number.isFinite(tickPrice)) return;

      const tickHigh = Math.max(
        tickPrice,
        isDirectMatching && directCandle ? directCandle.high : tickPrice,
        is1sMatching && candle1s ? candle1s.high : tickPrice
      );
      const tickLow = Math.min(
        tickPrice,
        isDirectMatching && directCandle ? directCandle.low : tickPrice,
        is1sMatching && candle1s ? candle1s.low : tickPrice
      );

      const chartTime = toLocalChartTime(bucketStartMs) as Time;

      let deltaVol = 0;
      if (is1sMatching && candle1s && candle1s.openTime !== last1sOpenTimeRef.current) {
        last1sOpenTimeRef.current = candle1s.openTime;
        deltaVol = candle1s.volume ?? 0;
      }

      let bar = activeBarRef.current;

      if (!bar && allCandlesRef.current.length > 0) {
        const lastHist = allCandlesRef.current[allCandlesRef.current.length - 1];
        const lastHistBucketMs =
          lastHist.openTime === bucketStartMs
            ? lastHist.openTime
            : Math.floor(lastHist.openTime / bucketMs) * bucketMs;
        if (lastHistBucketMs === bucketStartMs) {
          bar = {
            bucketStartMs,
            chartTime,
            open: lastHist.open,
            high: Math.max(lastHist.high, tickHigh, tickPrice),
            low: Math.min(lastHist.low, tickLow, tickPrice),
            close: tickPrice,
            volume: isDirectMatching && directCandle
              ? Math.max(lastHist.volume, directCandle.volume)
              : lastHist.volume + deltaVol,
          };
        }
      }

      if (!bar || bucketStartMs > bar.bucketStartMs) {
        const openPrice =
          isDirectMatching && directCandle
            ? directCandle.open
            : is1sMatching && candle1s
              ? candle1s.open
              : tickPrice;
        bar = {
          bucketStartMs,
          chartTime,
          open: openPrice,
          high: Math.max(openPrice, tickHigh, tickPrice),
          low: Math.min(openPrice, tickLow, tickPrice),
          close: tickPrice,
          volume:
            isDirectMatching && directCandle
              ? Math.max(directCandle.volume, deltaVol)
              : deltaVol,
        };
      } else if (bucketStartMs === bar.bucketStartMs) {
        const newHigh = Math.max(
          bar.high,
          tickHigh,
          tickPrice,
          isDirectMatching && directCandle ? directCandle.high : tickPrice
        );
        const newLow = Math.min(
          bar.low,
          tickLow,
          tickPrice,
          isDirectMatching && directCandle ? directCandle.low : tickPrice
        );
        const newVol =
          isDirectMatching && directCandle
            ? Math.max(bar.volume + deltaVol, directCandle.volume)
            : bar.volume + deltaVol;

        bar = {
          ...bar,
          chartTime,
          open: bar.open,
          high: newHigh,
          low: newLow,
          close: tickPrice,
          volume: newVol,
        };
      } else {
        return;
      }

      activeBarRef.current = bar;

      try {
        pushLiveUpdates(
          bar.chartTime,
          bar.open,
          bar.high,
          bar.low,
          bar.close,
          bar.volume,
          bar.bucketStartMs
        );
      } catch {
        // Ignore duplicate or out-of-order lightweight charts ticks
      }
    });

    return () => {
      // Non-destructively merge the latest live bar into existing full historical cache on switch
      if (activeBarRef.current && !isPlaceholderData) {
        const finalBar = activeBarRef.current;
        queryClient.setQueryData<{ symbol: string; timeframe: Timeframe; candles: Candle[] }>(
          getCandlesQueryKey(symbol, selectedTimeframe),
          (old) => {
            if (!old?.candles || old.candles.length < 30) return old;
            const nextCandles = old.candles.slice();
            upsertLiveBarInMemory(
              nextCandles,
              symbol,
              selectedTimeframe,
              finalBar.bucketStartMs,
              bucketMs,
              finalBar
            );
            return {
              ...old,
              candles: nextCandles.slice(-1000),
            };
          }
        );
      }
      activeBarRef.current = null;
      last1sOpenTimeRef.current = 0;
      unsubscribe();
    };
  }, [symbol, selectedTimeframe, queryClient, isPlaceholderData]);

  const hasLiveFallbackBar = liveFallbackViewKey === `${symbol}:${selectedTimeframe}`;
  const hasCandles = Boolean(candlesData?.candles?.length || hasLiveFallbackBar);
  const showBlockingLoader = isLoading && !hasCandles;

  return (
    <div className={`relative w-full h-full min-h-0 select-none ${className || ""}`}>
      {/* Subtle Symbol Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.035] font-mono text-7xl font-black text-slate-100 tracking-wider">
        {symbol.replace("-", "/")}
      </div>

      {/* Institutional Top-Left OHLC Overlay (isolated from parent re-renders) */}
      {hasCandles && (
        <OhlcLegend
          key={`${symbol}:${selectedTimeframe}`}
          legendRef={legendRef}
          initialData={queryLatestCandle}
          symbol={symbol}
          timeframe={selectedTimeframe}
          showEma20={showEma20}
          showEma50={showEma50}
          showVolume={showVolume}
        />
      )}

      {/* Non-blocking background sync / older history indicator */}
      {(isLoadingOlder || (isFetching && isPlaceholderData)) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/90 border border-amber-500/40 text-[11px] font-mono font-semibold text-amber-400 backdrop-blur-md shadow-lg pointer-events-none animate-pulse">
          <RefreshCw size={12} className="animate-spin" />
          <span>{dict.chart.loadingOlder}</span>
        </div>
      )}

      {showBlockingLoader ? (
        <div className="absolute inset-0 z-10 bg-[#2a2839]">
          <DataState loading />
        </div>
      ) : !hasCandles ? (
        <div className="chart-empty-state" role="status">
          <DataState error={isError} onRetry={() => refetch()} />
        </div>
      ) : null}

      <div ref={containerRef} className="w-full h-full min-h-0" />
    </div>
  );
}
