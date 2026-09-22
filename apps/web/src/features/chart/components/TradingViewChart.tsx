"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
} from "lightweight-charts";
import { useCandlesQuery } from "../api/useCandlesQuery";
import { useMarketStore } from "../../../stores/marketStore";
import {
  toLocalChartTime,
  formatPrice,
  formatPercent,
  formatVolume,
} from "../../../utils/formatters";
import { ChartSkeleton } from "../../../components/ui/skeleton";

interface TradingViewChartProps {
  symbol: string;
  className?: string;
}

interface OhlcItem {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: Time;
}

function calculateEMA(
  data: { time: Time; close: number }[],
  period: number
): LineData<Time>[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const result: LineData<Time>[] = [];

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  result.push({ time: data[period - 1].time, value: ema });

  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push({ time: data[i].time, value: ema });
  }
  return result;
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

  const { data: candlesData, isLoading } = useCandlesQuery(symbol, selectedTimeframe);

  // OHLC overlay state on hover
  const [hoveredCandle, setHoveredCandle] = useState<OhlcItem | null>(null);
  const [latestCandle, setLatestCandle] = useState<OhlcItem | null>(null);

  // Initialize Lightweight Chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 420;

    const chart = createChart(containerRef.current, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#070a13" },
        textColor: "#64748b",
        fontFamily: "monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.3)" },
        horzLines: { color: "rgba(30, 41, 59, 0.3)" },
      },
      crosshair: {
        vertLine: {
          color: "rgba(100, 116, 139, 0.6)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#1e293b",
        },
        horzLine: {
          color: "rgba(100, 116, 139, 0.6)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#1e293b",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(30, 41, 59, 0.8)",
        scaleMargins: { top: 0.1, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "rgba(30, 41, 59, 0.8)",
        timeVisible: true,
        secondsVisible: ["1s", "5s", "15s", "30s"].includes(selectedTimeframe),
        barSpacing: 9,
        minBarSpacing: 3,
        rightOffset: 12,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
      priceLineVisible: true,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume_scale",
    });

    chart.priceScale("volume_scale").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const ema20Series = chart.addSeries(LineSeries, {
      color: "#06b6d4",
      lineWidth: 2,
      priceLineVisible: false,
      title: "EMA 20",
    });

    const ema50Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
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
    volumeSeriesRef.current?.applyOptions({ visible: showVolume });
  }, [showVolume]);

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
        color: c.close >= c.open ? "rgba(16, 185, 129, 0.45)" : "rgba(244, 63, 94, 0.45)",
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
        const ema20Data = calculateEMA(closeData, 20);
        ema20SeriesRef.current.setData(ema20Data);
      }
      if (ema50SeriesRef.current) {
        const ema50Data = calculateEMA(closeData, 50);
        ema50SeriesRef.current.setData(ema50Data);
      }

      // Prevent single fat candle stretching:
      // If we have >= 30 candles, fit content; otherwise maintain standard barSpacing
      if (formattedCandles.length >= 30) {
        chartRef.current?.timeScale().fitContent();
      } else {
        chartRef.current?.timeScale().applyOptions({ barSpacing: 9 });
        chartRef.current?.timeScale().scrollToPosition(5, false);
      }

      // Update latest candle for OHLC legend
      const last = formattedCandles[formattedCandles.length - 1];
      const lastVol = formattedVolumes[formattedVolumes.length - 1];
      if (last) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- this runs once after data load, not on every render
        setLatestCandle({
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
          volume: lastVol?.value ?? 0,
          time: last.time,
        });
      }
    } catch (err) {
      console.warn("Error setting candle data:", err);
    }
  }, [candlesData]);

  // Dynamically toggle secondsVisible when switching to sub-minute timeframes
  useEffect(() => {
    if (!chartRef.current) return;
    const isSubMinute = ["1s", "5s", "15s", "30s"].includes(selectedTimeframe);
    chartRef.current.timeScale().applyOptions({
      secondsVisible: isSubMinute,
    });
  }, [selectedTimeframe]);

  // Subscribe to realtime live candle stream from Zustand store
  useEffect(() => {
    const unsubscribe = useMarketStore.subscribe((state) => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

      const liveCandle =
        state.candles[`${symbol}:${selectedTimeframe}`] ||
        (selectedTimeframe === "1m" ? state.candles[`${symbol}:1m`] : undefined);

      if (!liveCandle) return;

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
              ? "rgba(16, 185, 129, 0.45)"
              : "rgba(244, 63, 94, 0.45)",
        });

        setLatestCandle({
          open: liveCandle.open,
          high: liveCandle.high,
          low: liveCandle.low,
          close: liveCandle.close,
          volume: liveCandle.volume,
          time,
        });
      } catch {
        // Ignore duplicate or out-of-order live tick updates
      }
    });

    return () => {
      unsubscribe();
    };
  }, [symbol, selectedTimeframe]);

  // Active OHLC data to display in the legend
  const displayOhlc = hoveredCandle || latestCandle;
  const isUp = useMemo(() => {
    if (!displayOhlc) return true;
    return displayOhlc.close >= displayOhlc.open;
  }, [displayOhlc]);

  const changePercent = useMemo(() => {
    if (!displayOhlc || !displayOhlc.open) return 0;
    return ((displayOhlc.close - displayOhlc.open) / displayOhlc.open) * 100;
  }, [displayOhlc]);

  return (
    <div className={`relative w-full h-full min-h-[420px] select-none ${className || ""}`}>
      {/* Subtle Symbol Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.035] font-mono text-7xl font-black text-slate-100 tracking-wider">
        {symbol.replace("-", "/")}
      </div>

      {/* Institutional Top-Left OHLC Overlay */}
      {displayOhlc && (
        <div className="absolute top-2 left-3 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] pointer-events-none bg-[#070a13]/85 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-800/60 shadow-lg">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <span>{symbol}</span>
            <span className="text-slate-500 font-normal">[{selectedTimeframe}]</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">O</span>
            <span className="text-slate-200 font-medium">${formatPrice(displayOhlc.open)}</span>

            <span className="text-slate-500">H</span>
            <span className="text-emerald-400 font-medium">${formatPrice(displayOhlc.high)}</span>

            <span className="text-slate-500">L</span>
            <span className="text-rose-400 font-medium">${formatPrice(displayOhlc.low)}</span>

            <span className="text-slate-500">C</span>
            <span className={isUp ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
              ${formatPrice(displayOhlc.close)}
            </span>

            <span className="text-slate-500">Vol</span>
            <span className="text-slate-300 font-medium">{formatVolume(displayOhlc.volume)}</span>

            <span
              className={`font-semibold px-1 rounded text-[10px] ${
                isUp ? "bg-emerald-950/80 text-emerald-400" : "bg-rose-950/80 text-rose-400"
              }`}
            >
              {formatPercent(changePercent)}
            </span>
          </div>

          {/* Active Indicator tags in Legend */}
          <div className="hidden sm:flex items-center gap-2 border-l border-slate-800/80 pl-2">
            {showEma20 && <span className="text-[#06b6d4] font-medium text-[10px]">EMA(20)</span>}
            {showEma50 && <span className="text-[#f59e0b] font-medium text-[10px]">EMA(50)</span>}
            {showVolume && <span className="text-slate-400 font-medium text-[10px]">VOL</span>}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-[#070a13]">
          <ChartSkeleton />
        </div>
      )}

      {/* Chart Canvas Container */}
      <div ref={containerRef} className="w-full h-full min-h-[420px]" />
    </div>
  );
}
