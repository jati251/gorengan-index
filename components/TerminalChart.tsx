'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

interface TerminalChartProps {
  livePrice?: number;
  sentiment?: 'BULLISH' | 'BEARISH' | 'STAGNANT';
}

export default function TerminalChart({ livePrice, sentiment }: TerminalChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState<'5m' | '1d' | '1w' | '1M' | '1y' | 'ALL'>('1d');
  const [chartData, setChartData] = useState<any[]>([]);

  // Fetch Data from DB
  useEffect(() => {
    const fetchData = async () => {
      try {
        // If ALL is selected, we fetch 1y (Yearly) data which spans from 1980 to now
        const apiTimeframe = timeframe === 'ALL' ? '1y' : timeframe;
        const res = await fetch(`/api/chart?timeframe=${apiTimeframe}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            const formatted = json.data.map((d: any) => {
              const dt = new Date(d.timestamp);
              // For daily/weekly/monthly/yearly, lightweight-charts requires a string 'YYYY-MM-DD'
              if (['1d', '1w', '1M', '1y', 'ALL'].includes(timeframe)) {
                const yr = dt.getFullYear();
                const mo = String(dt.getMonth() + 1).padStart(2, '0');
                const da = String(dt.getDate()).padStart(2, '0');
                return {
                  time: `${yr}-${mo}-${da}`,
                  open: d.open,
                  high: d.high,
                  low: d.low,
                  close: d.close,
                };
              }
              // For intraday, use UNIX timestamp in seconds
              return {
                time: Math.floor(dt.getTime() / 1000) as any,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
              };
            });
            setChartData(formatted);
            // Auto-fit content if ALL is selected
            if (timeframe === 'ALL' && chartRef.current) {
              setTimeout(() => {
                chartRef.current.timeScale().fitContent();
              }, 100);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch chart data", err);
      }
    };
    fetchData();
  }, [timeframe]);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888',
        fontFamily: 'monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 256,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      rightPriceScale: {
        borderVisible: false,
      },
      crosshair: {
        mode: 0, // Normal crosshair
        vertLine: { color: '#555', width: 1, style: 1, labelBackgroundColor: '#222' },
        horzLine: { color: '#555', width: 1, style: 1, labelBackgroundColor: '#222' },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00ff66',
      downColor: '#ff3333',
      borderVisible: false,
      wickUpColor: '#00ff66',
      wickDownColor: '#ff3333',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || entries[0].target !== chartContainerRef.current) {
        return;
      }
      const newRect = entries[0].contentRect;
      chart.applyOptions({ width: newRect.width });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Update Data when chartData or livePrice changes
  useEffect(() => {
    if (!seriesRef.current || chartData.length === 0) return;

    const dataCopy = [...chartData];

    // Overlay Live Price onto the last candle
    if (livePrice) {
      const lastCandle = { ...dataCopy[dataCopy.length - 1] }; // copy so we don't mutate state directly
      const nowTs = Math.floor(Date.now() / 1000);
      
      if (timeframe === '5m') {
        const lastCandleTime = lastCandle.time as number;
        if (nowTs - lastCandleTime > 300) {
          dataCopy.push({
            time: nowTs as any,
            open: lastCandle.close,
            high: Math.max(lastCandle.close, livePrice),
            low: Math.min(lastCandle.close, livePrice),
            close: livePrice
          });
        } else {
          lastCandle.close = livePrice;
          lastCandle.high = Math.max(lastCandle.high, livePrice);
          lastCandle.low = Math.min(lastCandle.low, livePrice);
          dataCopy[dataCopy.length - 1] = lastCandle;
        }
      } else {
        // For 1d / 1M, just update the close of the current active candle safely
        lastCandle.close = livePrice;
        lastCandle.high = Math.max(lastCandle.high, livePrice);
        lastCandle.low = Math.min(lastCandle.low, livePrice);
        dataCopy[dataCopy.length - 1] = lastCandle;
      }
    }

    seriesRef.current.setData(dataCopy);
  }, [chartData, livePrice, timeframe]);

  return (
    <div className="bg-black border border-zinc-800 rounded-md p-4 shadow-xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-zinc-400 font-mono text-sm tracking-widest shrink-0">SIG TREND ANALYTICS</h2>
        
        <div className="flex flex-wrap gap-2 font-mono text-xs w-full md:w-auto">
          {['5m', '1d', '1w', '1M', '1y', 'ALL'].map(tf => (
            <button 
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 rounded transition-colors ${timeframe === tf ? 'bg-yellow-500 text-black font-bold' : 'text-zinc-500 hover:text-white'}`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
        
        <div className={`text-xs font-bold px-2 py-1 rounded bg-black/50 border shrink-0 ${
          sentiment === 'BULLISH' ? 'text-green-500 border-green-900' :
          sentiment === 'BEARISH' ? 'text-red-500 border-red-900' : 'text-zinc-500 border-zinc-800'
        }`}>
          {sentiment || 'STAGNANT'}
        </div>
      </div>
      <div ref={chartContainerRef} className="relative h-64 w-full" />
    </div>
  );
}
