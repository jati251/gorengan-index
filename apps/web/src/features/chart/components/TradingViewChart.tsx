"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { TIMEFRAME_MS } from "@gorengan/shared";
import { useCandlesQuery } from "../api/useCandlesQuery";
import { useMarketStore } from "@/stores/marketStore";
import { toLocalChartTime } from "@/utils/formatters";
import { ChartSkeleton } from "./ChartSkeleton";
import { OhlcLegend, type OhlcData } from "./OhlcLegend";
import { calculateEMA } from "../utils/indicators";
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

interface TradingViewChartProps {
  symbol: string;
  className?: string;
}

export function TradingViewChart({ symbol, className }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const activeBarRef = useRef<{
    bucketStartMs: number;
    chartTime: Time;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null>(null);

  const selectedTimeframe = useMarketStore((s) => s.selectedTimeframe);
  const showEma20 = useMarketStore((s) => s.showEma20);
  const showEma50 = useMarketStore((s) => s.showEma50);
  const showVolume = useMarketStore((s) => s.showVolume);

  const isFx = isFxSymbol(symbol);
  const isUs = isUsEquitySymbol(symbol);
  const isId = isIdxEquitySymbol(symbol);
  const fxMeta = getFxMetadata(symbol);

  // Precision: IDX stocks have 0 decimals (Rupiah integer), US stocks have 2 decimals, FX 3-5, Crypto 2
  const precision = getChartPrecision(isId, isUs, isFx, fxMeta?.displayDecimals);
  const minMove = precision === 0 ? 1 : 1 / Math.pow(10, precision);

  const { data: candlesData, isLoading, isError } = useCandlesQuery(symbol, selectedTimeframe);

  // OHLC overlay state on hover and streaming updates
  const [hoveredCandle, setHoveredCandle] = useState<OhlcData | null>(null);
  const [liveCandleState, setLiveCandleState] = useState<{
    key: string;
    candle: OhlcData;
  } | null>(null);

  // Derived latest candle from historical candles query
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

  // Initialize Lightweight Chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 420;

    const chart = createChart(
      containerRef.current,
      createChartOptions(width, height, isSubMinuteTimeframe(selectedTimeframe))
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

    // Handle crosshair move for dynamic OHLC Legend
    chart.subscribeCrosshairMove((param) => {
      if (
        !param.time ||
        param.point === undefined ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        setHoveredCandle(null);
        return;
      }

      const candleData = param.seriesData.get(candlestickSeries) as
        | CandlestickData<Time>
        | undefined;
      const volData = param.seriesData.get(volumeSeries) as
        | HistogramData<Time>
        | undefined;

      if (candleData) {
        setHoveredCandle({
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData?.value ?? 0,
          time: param.time,
        });
      } else {
        setHoveredCandle(null);
      }
    });

    // Handle container resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width: rw, height: rh } = entries[0].contentRect;
      if (rw > 0 && rh > 0) {
        chart.applyOptions({ width: rw, height: rh });
      }
    });

    resizeObserver.observe(containerRef.current);

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

  // Update chart historical data whenever TanStack query resolves
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !candlesData?.candles) {
      return;
    }

    const candles = candlesData.candles;
    if (candles.length === 0) return;

    // Ensure sorted by time ascending
    const sorted = [...candles].sort((a, b) => a.openTime - b.openTime);

    // Deduplicate by second timestamp to satisfy Lightweight Charts strict monotonic ordering
    const uniqueCandles = new Map<number, CandlestickData<Time>>();
    const uniqueVolumes = new Map<number, HistogramData<Time>>();

    for (const c of sorted) {
      const time = toLocalChartTime(c.openTime);
      uniqueCandles.set(time, {
        time: time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      });

      uniqueVolumes.set(time, {
        time: time as Time,
        value: c.volume,
        color: c.close >= c.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
      });
    }

    const formattedCandles = Array.from(uniqueCandles.values()).sort(
      (a, b) => Number(a.time) - Number(b.time)
    );
    const formattedVolumes = Array.from(uniqueVolumes.values()).sort(
      (a, b) => Number(a.time) - Number(b.time)
    );

    // Derived from strictly sorted and unique candle list to guarantee monotonic EMA times
    const closeData = formattedCandles.map((c) => ({
      time: c.time,
      close: c.close,
    }));

    try {
      candleSeriesRef.current.setData(formattedCandles);
      volumeSeriesRef.current.setData(formattedVolumes);

      // Track active latest bar for live synthesizing
      const lastFormatted = formattedCandles[formattedCandles.length - 1];
      const lastRaw = sorted[sorted.length - 1];
      if (lastFormatted && lastRaw) {
        const bucketMs = TIMEFRAME_MS[selectedTimeframe] ?? 60_000;
        const bucketStartMs = Math.floor(lastRaw.openTime / bucketMs) * bucketMs;
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

      // Calculate and set EMAs
      if (ema20SeriesRef.current) {
        ema20SeriesRef.current.setData(calculateEMA(closeData, 20));
      }
      if (ema50SeriesRef.current) {
        ema50SeriesRef.current.setData(calculateEMA(closeData, 50));
      }

      // Prevent single fat candle stretching while keeping candles centered and in view
      if (formattedCandles.length >= 30) {
        chartRef.current?.timeScale().fitContent();
      } else {
        chartRef.current?.timeScale().applyOptions({ barSpacing: 12 });
      }
      chartRef.current?.timeScale().scrollToPosition(0, false);
    } catch (err) {
      console.warn("Error setting candle data:", err);
    }
  }, [candlesData, selectedTimeframe]);

  // Dynamically toggle secondsVisible and re-align view when switching to sub-minute timeframes
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().applyOptions({
      secondsVisible: isSubMinuteTimeframe(selectedTimeframe),
    });
    // Immediately fit and scroll to real time so 1s chart does not appear empty/off-screen
    requestAnimationFrame(() => {
      chartRef.current?.timeScale().fitContent();
      chartRef.current?.timeScale().scrollToPosition(0, false);
    });
  }, [selectedTimeframe]);

  // Subscribe to realtime live candle stream & tick updates from Zustand store
  useEffect(() => {
    let lastProcessedVersion = "";
    const bucketMs = TIMEFRAME_MS[selectedTimeframe] ?? 60_000;

    const unsubscribe = useMarketStore.subscribe((state) => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

      const directCandle = state.candles[`${symbol}:${selectedTimeframe}`];
      const candle1s = state.candles[`${symbol}:1s`];
      const ticker = state.tickers[symbol];

      // If we have no price source at all, return
      if (!directCandle && !candle1s && !ticker) return;

      // Deduplicate rapid no-op triggers
      const versionKey = `${directCandle?.openTime}_${directCandle?.close}_${candle1s?.openTime}_${candle1s?.close}_${ticker?.price}_${ticker?.timestamp}`;
      if (versionKey === lastProcessedVersion) return;
      lastProcessedVersion = versionKey;

      if (selectedTimeframe === "1s" && (directCandle || candle1s)) {
        const live = directCandle || candle1s!;
        const time = toLocalChartTime(live.openTime) as Time;
        try {
          candleSeriesRef.current.update({
            time,
            open: live.open,
            high: live.high,
            low: live.low,
            close: live.close,
          });
          volumeSeriesRef.current.update({
            time,
            value: live.volume,
            color: live.close >= live.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
          });
          setLiveCandleState({
            key: `${symbol}:1s`,
            candle: {
              open: live.open,
              high: live.high,
              low: live.low,
              close: live.close,
              volume: live.volume,
              time,
            },
          });
        } catch {
          // Ignore duplicate / out-of-order ticks
        }
        return;
      }

      // For any non-1s timeframe (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w):
      // If direct candle exists (e.g. finalized 1m broadcast), use it
      if (directCandle) {
        const time = toLocalChartTime(directCandle.openTime) as Time;
        try {
          candleSeriesRef.current.update({
            time,
            open: directCandle.open,
            high: directCandle.high,
            low: directCandle.low,
            close: directCandle.close,
          });
          volumeSeriesRef.current.update({
            time,
            value: directCandle.volume,
            color: directCandle.close >= directCandle.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
          });
          setLiveCandleState({
            key: `${symbol}:${selectedTimeframe}`,
            candle: {
              open: directCandle.open,
              high: directCandle.high,
              low: directCandle.low,
              close: directCandle.close,
              volume: directCandle.volume,
              time,
            },
          });
        } catch {
          // Ignore
        }
        return;
      }

      // Otherwise, synthesize/update active open bar from incoming 1s candle or live ticker
      const tickPrice = candle1s?.close ?? ticker?.price;
      if (tickPrice == null || !Number.isFinite(tickPrice)) return;

      const tickHigh = candle1s?.high ?? tickPrice;
      const tickLow = candle1s?.low ?? tickPrice;
      const tickVol = candle1s?.volume ?? 0;
      const tickTimeMs = candle1s?.openTime ?? ticker?.timestamp ?? Date.now();

      const bucketStartMs = Math.floor(tickTimeMs / bucketMs) * bucketMs;
      const chartTime = toLocalChartTime(bucketStartMs) as Time;

      let bar = activeBarRef.current;
      if (!bar || bucketStartMs > bar.bucketStartMs) {
        // Start new candle bucket
        bar = {
          bucketStartMs,
          chartTime,
          open: candle1s?.open ?? tickPrice,
          high: Math.max(tickPrice, tickHigh),
          low: Math.min(tickPrice, tickLow),
          close: tickPrice,
          volume: tickVol,
        };
      } else {
        // Update existing open bucket
        bar = {
          ...bar,
          chartTime,
          high: Math.max(bar.high, tickPrice, tickHigh),
          low: Math.min(bar.low, tickPrice, tickLow),
          close: tickPrice,
          volume: bar.volume + tickVol,
        };
      }
      activeBarRef.current = bar;

      try {
        candleSeriesRef.current.update({
          time: bar.chartTime,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        });

        volumeSeriesRef.current.update({
          time: bar.chartTime,
          value: bar.volume,
          color: bar.close >= bar.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
        });

        setLiveCandleState({
          key: `${symbol}:${selectedTimeframe}`,
          candle: {
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            time: bar.chartTime,
          },
        });
      } catch {
        // Ignore duplicate or out-of-order lightweight charts ticks
      }
    });

    return () => {
      unsubscribe();
    };
  }, [symbol, selectedTimeframe]);

  // Active OHLC data to display in the legend: hovered point -> current live candle -> latest historical bar
  const currentLiveCandle =
    liveCandleState?.key === `${symbol}:${selectedTimeframe}`
      ? liveCandleState.candle
      : null;
  const displayOhlc = hoveredCandle || currentLiveCandle || queryLatestCandle;
  const hasCandles = Boolean(candlesData?.candles?.length || currentLiveCandle);

  return (
    <div className={`relative w-full h-full min-h-0 select-none ${className || ""}`}>
      {/* Subtle Symbol Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.035] font-mono text-7xl font-black text-slate-100 tracking-wider">
        {symbol.replace("-", "/")}
      </div>

      {/* Institutional Top-Left OHLC Overlay */}
      {displayOhlc && (
        <OhlcLegend
          data={displayOhlc}
          symbol={symbol}
          timeframe={selectedTimeframe}
          showEma20={showEma20}
          showEma50={showEma50}
          showVolume={showVolume}
        />
      )}

      {isLoading ? (
        <div className="absolute inset-0 z-10 bg-[#2a2839]">
          <ChartSkeleton />
        </div>
      ) : !hasCandles ? (
        <div className="chart-empty-state" role="status">
          <span>NO CHART DATA</span>
          <p>{isError ? "Chart unavailable. Try another timeframe." : `No candles yet for ${symbol} at ${selectedTimeframe}.`}</p>
        </div>
      ) : null}

      <div ref={containerRef} className="w-full h-full min-h-0" />
    </div>
  );
}
