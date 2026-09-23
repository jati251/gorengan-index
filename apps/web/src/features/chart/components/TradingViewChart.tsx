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

  const selectedTimeframe = useMarketStore((s) => s.selectedTimeframe);
  const showEma20 = useMarketStore((s) => s.showEma20);
  const showEma50 = useMarketStore((s) => s.showEma50);
  const showVolume = useMarketStore((s) => s.showVolume);

  const isFx = isFxSymbol(symbol);
  const isUs = isUsEquitySymbol(symbol);
  const isId = isIdxEquitySymbol(symbol);
  const fxMeta = getFxMetadata(symbol);

  // Precision: IDX stocks have 0 decimals (Rupiah integer), US stocks have 2 decimals, FX 3-5, Crypto 2
  const precision = isId ? 0 : isUs ? 2 : isFx ? (fxMeta?.displayDecimals ?? 5) : 2;
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
  }, [showEma20]);

  useEffect(() => {
    ema50SeriesRef.current?.applyOptions({ visible: showEma50 });
  }, [showEma50]);

  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: !isFx && showVolume });
  }, [isFx, showVolume]);

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
    const closeData: { time: Time; close: number }[] = [];

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

      closeData.push({ time: time as Time, close: c.close });
    }

    const formattedCandles = Array.from(uniqueCandles.values()).sort(
      (a, b) => Number(a.time) - Number(b.time)
    );
    const formattedVolumes = Array.from(uniqueVolumes.values()).sort(
      (a, b) => Number(a.time) - Number(b.time)
    );

    try {
      candleSeriesRef.current.setData(formattedCandles);
      volumeSeriesRef.current.setData(formattedVolumes);

      // Calculate and set EMAs
      if (ema20SeriesRef.current) {
        ema20SeriesRef.current.setData(calculateEMA(closeData, 20));
      }
      if (ema50SeriesRef.current) {
        ema50SeriesRef.current.setData(calculateEMA(closeData, 50));
      }

      // Prevent single fat candle stretching:
      // If we have >= 30 candles, fit content; otherwise maintain standard barSpacing
      if (formattedCandles.length >= 30) {
        chartRef.current?.timeScale().fitContent();
      } else {
        chartRef.current?.timeScale().applyOptions({ barSpacing: 9 });
      }
    } catch (err) {
      console.warn("Error setting candle data:", err);
    }
  }, [candlesData]);

  // Dynamically toggle secondsVisible when switching to sub-minute timeframes
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().applyOptions({
      secondsVisible: isSubMinuteTimeframe(selectedTimeframe),
    });
  }, [selectedTimeframe]);

  // Subscribe to realtime live candle stream from Zustand store
  useEffect(() => {
    let lastCandle: ReturnType<typeof useMarketStore.getState>["candles"][string] | undefined;
    const unsubscribe = useMarketStore.subscribe((state) => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

      const liveCandle =
        state.candles[`${symbol}:${selectedTimeframe}`] ||
        (selectedTimeframe === "1m" ? state.candles[`${symbol}:1m`] : undefined);

      if (!liveCandle || liveCandle === lastCandle) return;
      lastCandle = liveCandle;

      const time = toLocalChartTime(liveCandle.openTime) as Time;
      try {
        candleSeriesRef.current.update({
          time,
          open: liveCandle.open,
          high: liveCandle.high,
          low: liveCandle.low,
          close: liveCandle.close,
        });

        volumeSeriesRef.current.update({
          time,
          value: liveCandle.volume,
          color:
            liveCandle.close >= liveCandle.open
              ? CHART_COLORS.volumeUp
              : CHART_COLORS.volumeDown,
        });

        setLiveCandleState({
          key: `${symbol}:${selectedTimeframe}`,
          candle: {
            open: liveCandle.open,
            high: liveCandle.high,
            low: liveCandle.low,
            close: liveCandle.close,
            volume: liveCandle.volume,
            time,
          },
        });
      } catch {
        // Ignore duplicate or out-of-order live tick updates
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
