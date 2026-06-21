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

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
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
    <div className="w-full h-auto bg-zinc-950 border border-zinc-800 rounded-md p-4 shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-zinc-400 font-mono text-sm tracking-widest flex items-center gap-4">
          SIG TREND ANALYTICS
          <div className="flex gap-1 bg-zinc-900 rounded p-1 overflow-x-auto">
            <button onClick={() => setTimeframe('5m')} className={`px-2 py-0.5 rounded text-xs ${timeframe === '5m' ? 'bg-yellow-500 text-black' : 'text-zinc-500 hover:text-white'}`}>5m</button>
            <button onClick={() => setTimeframe('1d')} className={`px-2 py-0.5 rounded text-xs ${timeframe === '1d' ? 'bg-yellow-500 text-black' : 'text-zinc-500 hover:text-white'}`}>1D</button>
            <button onClick={() => setTimeframe('1w')} className={`px-2 py-0.5 rounded text-xs ${timeframe === '1w' ? 'bg-yellow-500 text-black' : 'text-zinc-500 hover:text-white'}`}>1W</button>
            <button onClick={() => setTimeframe('1M')} className={`px-2 py-0.5 rounded text-xs ${timeframe === '1M' ? 'bg-yellow-500 text-black' : 'text-zinc-500 hover:text-white'}`}>1M</button>
            <button onClick={() => setTimeframe('1y')} className={`px-2 py-0.5 rounded text-xs ${timeframe === '1y' ? 'bg-yellow-500 text-black' : 'text-zinc-500 hover:text-white'}`}>1Y</button>
            <button onClick={() => setTimeframe('ALL')} className={`px-2 py-0.5 rounded text-xs ${timeframe === 'ALL' ? 'bg-yellow-500 text-black' : 'text-zinc-500 hover:text-white'}`}>ALL</button>
          </div>
        </h2>
        <span className={`text-xs font-mono px-2 py-1 rounded ${sentiment === 'BEARISH' ? 'bg-red-900/30 text-red-400' : sentiment === 'BULLISH' ? 'bg-green-900/30 text-green-400' : 'bg-zinc-800 text-zinc-400'}`}>
          {sentiment || 'STAGNANT'}
        </span>
      </div>
      <div ref={chartContainerRef} className="relative h-64 w-full" />
    </div>
  );
}
