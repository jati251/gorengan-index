"use client";

import React, { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from "lightweight-charts";
import { useCandlesQuery } from "../api/useCandlesQuery";
import { useMarketStore } from "../../../stores/marketStore";
import { toLocalChartTime } from "../../../utils/formatters";

interface TradingViewChartProps {
  symbol: string;
  className?: string;
}

export function TradingViewChart({ symbol, className }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const selectedTimeframe = useMarketStore((s) => s.selectedTimeframe);
  const { data: candlesData, isLoading } = useCandlesQuery(symbol, selectedTimeframe);

  // Initialize Lightweight Chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 420;

    const chart = createChart(containerRef.current, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#090d16" },
        textColor: "#64748b",
        fontFamily: "monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.4)" },
        horzLines: { color: "rgba(30, 41, 59, 0.4)" },
      },
      crosshair: {
        vertLine: { color: "rgba(100, 116, 139, 0.5)", width: 1, style: 3 },
        horzLine: { color: "rgba(100, 116, 139, 0.5)", width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: "rgba(30, 41, 59, 0.8)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(30, 41, 59, 0.8)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume_scale",
    });

    chart.priceScale("volume_scale").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

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
    };
  }, []);

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
        color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(244, 63, 94, 0.4)",
      });
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
      chartRef.current?.timeScale().fitContent();
    } catch (err) {
      console.warn("Error setting candle data:", err);
    }
  }, [candlesData]);

  // Dynamically toggle secondsVisible when switching to 1s/5s/15s timeframes
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
              ? "rgba(16, 185, 129, 0.4)"
              : "rgba(244, 63, 94, 0.4)",
        });
      } catch {
        // Ignore duplicate or out-of-order live tick updates
      }
    });

    return () => {
      unsubscribe();
    };
  }, [symbol, selectedTimeframe]);

  return (
    <div className={`relative w-full h-full min-h-[380px] ${className || ""}`}>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#090d16]/80 backdrop-blur-xs font-mono text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Loading Historical Candlesticks...
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full min-h-[380px]" />
    </div>
  );
}
