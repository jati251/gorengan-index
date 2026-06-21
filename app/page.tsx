'use client';

import React, { useEffect, useState } from 'react';
import HeaderTicker from '@/components/HeaderTicker';
import TerminalChart from '@/components/TerminalChart';
import GorenganCalculator from '@/components/GorenganCalculator';
import MarketNewsWidget from '@/components/MarketNewsWidget';
import ReportPriceModal from '@/components/ReportPriceModal';
import { RegionalIndex } from '@/data/gorenganData';

interface DashboardData {
  timestamp: string;
  macro: {
    kursIDR: number;
    isRaining: boolean;
    temperature: number;
    wheatIndex: number;
    palmOilIndex: number;
    btcIdrPrice: number;
    marketSentiment: string;
  };
  newsHeadlines: string[];
  regions: RegionalIndex[];
  volatilityIndex: number;
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [timeOffset, setTimeOffset] = useState<number>(0);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/gorengan-engine', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        
        // Calculate offset between API true time and local browser time
        const apiTime = new Date(json.timestamp).getTime();
        const localTime = Date.now();
        setTimeOffset(apiTime - localTime);
      }
    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Ticking clock every second synced with API offset
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date(Date.now() + timeOffset));
    }, 1000);
    return () => clearInterval(clockInterval);
  }, [timeOffset]);

  if (loading || !data) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-green-500 font-mono text-xl">
        INITIALIZING NATIONAL GORENGAN TERMINAL...
      </div>
    );
  }

  // Use DKI Jakarta as the primary benchmark index for the chart
  const benchmarkData = data.regions.find(r => r.region === 'DKI Jakarta') || data.regions[0];
  const benchmarkPrice = benchmarkData.bakwanPrice;
  const benchmarkSentiment = benchmarkData.sentiment;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 font-sans text-zinc-300 selection:bg-yellow-400 selection:text-black">
      <main className="flex-1 w-full flex flex-col items-center">
        <HeaderTicker />
        
        <div className="w-full max-w-7xl px-4 py-6 flex flex-col gap-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter text-white mb-1">THE GORENGAN INDEX <span className="text-sm font-mono text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">NATIONAL</span></h1>
            <p className="text-zinc-500 font-mono text-sm">INDONESIA PURCHASING POWER TERMINAL // SIG-26</p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-col items-end gap-2 font-mono text-sm">
            <ReportPriceModal />
            <div className="text-right">
              <div className="text-zinc-500">SYSTEM TIME (WIB)</div>
              <div className="text-yellow-400">
                {currentTime.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })}
              </div>
            </div>
          </div>
        </header>

        {/* Macro Indicators */}
        <section className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-black border border-zinc-800 p-4 rounded-md">
            <div className="text-[10px] text-zinc-500 font-mono mb-1">KURS USD/IDR</div>
            <div className="text-lg text-white font-mono">Rp {data.macro.kursIDR.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-black border border-zinc-800 p-4 rounded-md">
            <div className="text-[10px] text-zinc-500 font-mono mb-1">BTC/IDR PARITY</div>
            <div className="text-lg text-white font-mono">{(data.macro.btcIdrPrice / 1000000).toFixed(1)}M</div>
          </div>
          <div className="bg-black border border-zinc-800 p-4 rounded-md">
            <div className="text-[10px] text-zinc-500 font-mono mb-1">GLOBAL WHEAT (TEPUNG)</div>
            <div className={`text-lg font-mono ${data.macro.wheatIndex > 105 ? 'text-red-400' : 'text-green-400'}`}>
              IDX: {data.macro.wheatIndex.toFixed(1)}
            </div>
          </div>
          <div className="bg-black border border-zinc-800 p-4 rounded-md">
            <div className="text-[10px] text-zinc-500 font-mono mb-1">PALM OIL (MINYAK)</div>
            <div className={`text-lg font-mono ${data.macro.palmOilIndex > 105 ? 'text-red-400' : 'text-green-400'}`}>
              IDX: {data.macro.palmOilIndex.toFixed(1)}
            </div>
          </div>
          <div className="bg-black border border-zinc-800 p-4 rounded-md">
            <div className="text-[10px] text-zinc-500 font-mono mb-1">WEATHER/DEMAND</div>
            <div className={`text-lg font-mono ${data.macro.isRaining ? 'text-green-400' : 'text-yellow-400'}`}>
              {data.macro.isRaining ? 'RAIN' : 'CLEAR'} ({data.macro.temperature}°C)
            </div>
          </div>
          <div className="bg-black border border-zinc-800 p-4 rounded-md">
            <div className="text-[10px] text-zinc-500 font-mono mb-1">SENTIMENT</div>
            <div className={`text-lg font-mono ${data.macro.marketSentiment.includes('BULLISH') ? 'text-green-400' : 'text-red-400'}`}>
              {data.macro.marketSentiment.replace('_', ' ')}
            </div>
          </div>
        </section>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 flex flex-col gap-8">
            <TerminalChart livePrice={benchmarkPrice} sentiment={benchmarkSentiment} />
            
            <div className="bg-black border border-zinc-800 rounded-md p-4 shadow-xl flex flex-col h-[500px]">
              <h2 className="text-zinc-400 font-mono text-sm tracking-widest mb-4 shrink-0">NATIONAL PROVINCIAL SPOT PRICES (SORTED BY BAKWAN)</h2>
              <div className="overflow-auto grow custom-scrollbar">
                <table className="w-full text-left font-mono text-sm">
                  <thead className="sticky top-0 bg-black z-10">
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="pb-2">PROVINCE</th>
                      <th className="pb-2">UMP 24</th>
                      <th className="pb-2 text-yellow-400">BAKWAN</th>
                      <th className="pb-2 text-yellow-400">TAHU</th>
                      <th className="pb-2 text-yellow-400">TEMPE</th>
                      <th className="pb-2">SHRINK</th>
                      <th className="pb-2">TREND</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.regions.map((r, i) => (
                      <tr key={r.region} className="border-b border-zinc-900/50 hover:bg-zinc-900 transition-colors">
                        <td className="py-3 text-white">
                          <span className="text-zinc-600 mr-2 text-xs">{i+1}.</span>{r.region}
                        </td>
                        <td className="py-3 text-zinc-400">{(r.ump / 1000000).toFixed(1)}M</td>
                        <td className="py-3 font-bold">Rp {r.bakwanPrice.toLocaleString('id-ID')}</td>
                        <td className="py-3 text-zinc-300">Rp {r.tahuPrice.toLocaleString('id-ID')}</td>
                        <td className="py-3 text-zinc-300">Rp {r.tempePrice.toLocaleString('id-ID')}</td>
                        <td className="py-3">{r.sizePercentage}%</td>
                        <td className={`py-3 ${r.sentiment === 'BEARISH' ? 'text-red-400' : r.sentiment === 'BULLISH' ? 'text-green-400' : 'text-zinc-500'}`}>
                          {r.sentiment}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* BTC Parity Widget */}
            <div className="bg-black border border-zinc-800 p-4 rounded-md">
              <h3 className="text-zinc-500 font-mono text-xs mb-4 flex justify-between">
                <span>BITCOIN PARITY (BTC/BAKWAN)</span>
                <span className="text-yellow-500">LIVE</span>
              </h3>
              <div className="text-3xl font-mono text-yellow-400 mb-2">
                {Math.floor(data.macro.btcIdrPrice / benchmarkPrice).toLocaleString('id-ID')}
              </div>
              <div className="text-xs font-mono text-zinc-500">
                1 BTC setara dengan {Math.floor(data.macro.btcIdrPrice / benchmarkPrice).toLocaleString('id-ID')} potong Bakwan.
              </div>
            </div>

            {/* Existing Calculator Widget */}
            <GorenganCalculator regions={data.regions} />

            {/* News Feed Widget */}
            <MarketNewsWidget headlines={data.newsHeadlines} />
          </div>

        </div>
        </div>
      </main>
    </div>
  );
}
