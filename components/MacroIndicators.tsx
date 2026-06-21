import React from "react";

interface MacroData {
  kursIDR: number;
  btcIdrPrice: number;
  wheatIndex: number;
  palmOilIndex: number;
  isRaining: boolean;
  temperature: number;
  marketSentiment: string;
}

export default function MacroIndicators({ macro }: { macro: MacroData }) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-6 gap-4">
      <div className="bg-black border border-zinc-800 p-4 rounded-md">
        <div className="text-[10px] text-zinc-500 font-mono mb-1">
          KURS USD/IDR
        </div>
        <div className="text-lg text-white font-mono">
          Rp {macro.kursIDR.toLocaleString("id-ID")}
        </div>
      </div>
      <div className="bg-black border border-zinc-800 p-4 rounded-md">
        <div className="text-[10px] text-zinc-500 font-mono mb-1">
          BTC/IDR PARITY
        </div>
        <div className="text-lg text-white font-mono">
          {(macro.btcIdrPrice / 1000000).toFixed(1)}M
        </div>
      </div>
      <div className="bg-black border border-zinc-800 p-4 rounded-md">
        <div className="text-[10px] text-zinc-500 font-mono mb-1">
          GLOBAL WHEAT (TEPUNG)
        </div>
        <div
          className={`text-lg font-mono ${macro.wheatIndex > 105 ? "text-red-400" : "text-green-400"}`}
        >
          IDX: {macro.wheatIndex.toFixed(1)}
        </div>
      </div>
      <div className="bg-black border border-zinc-800 p-4 rounded-md">
        <div className="text-[10px] text-zinc-500 font-mono mb-1">
          PALM OIL (MINYAK)
        </div>
        <div
          className={`text-lg font-mono ${macro.palmOilIndex > 105 ? "text-red-400" : "text-green-400"}`}
        >
          IDX: {macro.palmOilIndex.toFixed(1)}
        </div>
      </div>
      <div className="bg-black border border-zinc-800 p-4 rounded-md">
        <div className="text-[10px] text-zinc-500 font-mono mb-1">
          WEATHER/DEMAND
        </div>
        <div
          className={`text-lg font-mono ${macro.isRaining ? "text-green-400" : "text-yellow-400"}`}
        >
          {macro.isRaining ? "RAIN" : "CLEAR"} (
          {macro.temperature}°C)
        </div>
      </div>
      <div className="bg-black border border-zinc-800 p-4 rounded-md">
        <div className="text-[10px] text-zinc-500 font-mono mb-1">
          SENTIMENT
        </div>
        <div
          className={`text-lg font-mono ${macro.marketSentiment.includes("BULLISH") ? "text-green-400" : "text-red-400"}`}
        >
          {macro.marketSentiment.replace("_", " ")}
        </div>
      </div>
    </section>
  );
}
