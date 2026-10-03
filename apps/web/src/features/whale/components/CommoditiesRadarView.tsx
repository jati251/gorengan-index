"use client";

import { ArrowUpRight, Sparkles, TrendingDown, TrendingUp, Droplet, Coins } from "lucide-react";
import type { WhaleRadarData } from "../types";
import { formatPercent } from "../utils/formatters";
import { useTranslation } from "@/features/i18n";
import { useMarketStore } from "@/stores/marketStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface CommoditiesRadarViewProps {
  data: WhaleRadarData;
}

export function CommoditiesRadarView({ data }: CommoditiesRadarViewProps) {
  const { locale } = useTranslation();
  const id = locale === "id";
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);
  const openWorkspace = useWorkspaceStore((s) => s.open);

  const { commodities } = data;
  const { gold, silver, oil, allCommodities } = commodities;

  const handleSelectSymbol = (symbolId: string) => {
    setSelectedSymbol(symbolId);
    openWorkspace("chart");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Macro Commodities Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Gold Spotlight */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-1">
            <span className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Coins size={15} />
              <span>{id ? "Emas Fisik (Gold / XAU)" : "Physical Gold (XAU)"}</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">1 Troy Oz</span>
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100 flex items-center justify-between">
            <span>${gold.paxg.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            <span className={`text-xs font-semibold font-mono flex items-center ${gold.paxg.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {gold.paxg.change24h >= 0 ? <TrendingUp size={13} className="mr-0.5" /> : <TrendingDown size={13} className="mr-0.5" />}
              {formatPercent(gold.paxg.changePercent24h)}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between">
            <span>ETF GLD: ${gold.gld.price.toFixed(2)}</span>
            <button
              type="button"
              onClick={() => handleSelectSymbol("PAXG-USDT")}
              className="text-amber-400 hover:text-amber-300 font-sans inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Chart</span>
              <ArrowUpRight size={12} />
            </button>
          </div>
        </div>

        {/* Silver Spotlight */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-1">
            <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Sparkles size={15} />
              <span>{id ? "Perak Fisik (Silver / XAG)" : "Physical Silver (XAG)"}</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">iShares SLV</span>
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100 flex items-center justify-between">
            <span>${silver.slv.price.toFixed(2)}</span>
            <span className={`text-xs font-semibold font-mono flex items-center ${silver.slv.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {silver.slv.change24h >= 0 ? <TrendingUp size={13} className="mr-0.5" /> : <TrendingDown size={13} className="mr-0.5" />}
              {formatPercent(silver.slv.changePercent24h)}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between">
            <span>Gold/Silver Ratio: {gold.goldSilverRatio}x</span>
            <button
              type="button"
              onClick={() => handleSelectSymbol("US:SLV")}
              className="text-cyan-400 hover:text-cyan-300 font-sans inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Chart</span>
              <ArrowUpRight size={12} />
            </button>
          </div>
        </div>

        {/* Crude Oil Spotlight */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-1">
            <span className="flex items-center gap-1.5 text-orange-400 font-bold">
              <Droplet size={15} />
              <span>{id ? "Minyak Mentah (Crude Oil)" : "Crude Oil (WTI & Brent)"}</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">USO & BNO</span>
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100 flex items-center justify-between">
            <span>${oil.uso.price.toFixed(2)}</span>
            <span className={`text-xs font-semibold font-mono flex items-center ${oil.uso.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {oil.uso.change24h >= 0 ? <TrendingUp size={13} className="mr-0.5" /> : <TrendingDown size={13} className="mr-0.5" />}
              {formatPercent(oil.uso.changePercent24h)}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between">
            <span>Brent BNO: ${oil.bno.price.toFixed(2)}</span>
            <button
              type="button"
              onClick={() => handleSelectSymbol("US:USO")}
              className="text-orange-400 hover:text-orange-300 font-sans inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Chart</span>
              <ArrowUpRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* 3 Pillar Deep Dive Grid: Gold vs Silver vs Oil */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pillar 1: Emas (Gold) */}
        <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono flex items-center gap-1">
                <Coins size={13} />
                <span>GOLD / XAU</span>
              </span>
              <span className="text-[11px] text-zinc-400 font-mono font-semibold">
                ${gold.paxg.price.toFixed(2)}/oz
              </span>
            </div>

            <h4 className="text-base font-bold text-zinc-100">
              {id ? "Emas: Benteng Nilai 5.000 Tahun" : "Gold: 5,000-Year Store of Value"}
            </h4>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {id
                ? "Aset lindung nilai inflasi dan krisis geopolitik global. Didukung oleh cadangan emas fisik batangan murni di brankas London (HSBC & Brink's)."
                : "Primary monetary hedge against fiat inflation and geopolitical crises. Supported by 100% allocated bullion in London vaults."}
            </p>

            <div className="space-y-2 pt-2 border-t border-zinc-800/80 text-xs">
              <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-200">PAXG-USDT</div>
                  <div className="text-[10px] text-zinc-500">1 Troy oz Physical Gold (24/7)</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectSymbol("PAXG-USDT")}
                  className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>Buka</span>
                  <ArrowUpRight size={11} />
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-200">US:GLD (SPDR Gold)</div>
                  <div className="text-[10px] text-zinc-500">874 Tonnes Bullion · $72B AUM</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectSymbol("US:GLD")}
                  className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>Buka</span>
                  <ArrowUpRight size={11} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/60 text-[11px] text-zinc-400 space-y-1 mt-4">
            <div className="flex justify-between">
              <span>{id ? "Cadangan Brankas HSBC" : "HSBC Vault Reserves"}</span>
              <span className="font-mono text-zinc-200 font-bold">874.5 T</span>
            </div>
            <div className="flex justify-between">
              <span>{id ? "Korelasi thd Bitcoin" : "Bitcoin Correlation"}</span>
              <span className="font-mono text-cyan-400 font-bold">+0.48 (Hedge)</span>
            </div>
          </div>
        </div>

        {/* Pillar 2: Perak (Silver) */}
        <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono flex items-center gap-1">
                <Sparkles size={13} />
                <span>SILVER / XAG</span>
              </span>
              <span className="text-[11px] text-zinc-400 font-mono font-semibold">
                ${silver.slv.price.toFixed(2)}
              </span>
            </div>

            <h4 className="text-base font-bold text-zinc-100">
              {id ? "Perak: Moneter & Industri Hijau" : "Silver: Monetary & Industrial"}
            </h4>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {id
                ? "Dua mesin penggerak: aset lindung nilai moneter sekaligus komponen esensial industri fotovoltaik sel surya, semikonduktor AI, dan kendaraan listrik."
                : "Dual growth engines: monetary store of value and essential industrial material for solar photovoltaics, EV electronics, and AI hardware."}
            </p>

            <div className="space-y-2 pt-2 border-t border-zinc-800/80 text-xs">
              <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-200">US:SLV (BlackRock iShares)</div>
                  <div className="text-[10px] text-zinc-500">14,200 Tonnes Silver · JPMorgan Vault</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectSymbol("US:SLV")}
                  className="px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>Buka</span>
                  <ArrowUpRight size={11} />
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-200">{id ? "Rasio Emas / Perak" : "Gold / Silver Ratio"}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{gold.goldSilverRatio}x (Historical benchmark)</div>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {gold.goldSilverRatio > 80 ? "Silver Cheap" : "Balanced"}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/60 text-[11px] text-zinc-400 space-y-1 mt-4">
            <div className="flex justify-between">
              <span>{id ? "Volume Harian SLV" : "Daily Volume SLV"}</span>
              <span className="font-mono text-zinc-200 font-bold">{silver.slv.volume24h.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>{id ? "Permintaan Industri Global" : "Industrial Demand"}</span>
              <span className="font-mono text-emerald-400 font-bold">58% Total</span>
            </div>
          </div>
        </div>

        {/* Pillar 3: Minyak (Crude Oil) */}
        <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/30 font-mono flex items-center gap-1">
                <Droplet size={13} />
                <span>CRUDE OIL / WTI & BRENT</span>
              </span>
              <span className="text-[11px] text-zinc-400 font-mono font-semibold">
                ${oil.uso.price.toFixed(2)}
              </span>
            </div>

            <h4 className="text-base font-bold text-zinc-100">
              {id ? "Minyak: Energi Penggerak Dunia" : "Crude Oil: Global Energy Benchmark"}
            </h4>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {id
                ? "Darah utama ekonomi global. Memantau harga minyak mentah WTI (USO) dan Brent (BNO) serta raksasa produsen minyak ExxonMobil & Chevron (XLE)."
                : "The lifeblood of the global industrial economy. Tracks domestic WTI, seaborne Brent contracts, and equity giants like Exxon & Chevron."}
            </p>

            <div className="space-y-2 pt-2 border-t border-zinc-800/80 text-xs">
              <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-200">US:USO (WTI Crude Oil)</div>
                  <div className="text-[10px] text-zinc-500">Benchmark Minyak Mentah AS</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectSymbol("US:USO")}
                  className="px-2 py-1 rounded bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>Buka</span>
                  <ArrowUpRight size={11} />
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-200">US:XLE (Oil & Gas SPDR)</div>
                  <div className="text-[10px] text-zinc-500">ExxonMobil, Chevron, ConocoPhillips</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectSymbol("US:XLE")}
                  className="px-2 py-1 rounded bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>Buka</span>
                  <ArrowUpRight size={11} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/60 text-[11px] text-zinc-400 space-y-1 mt-4">
            <div className="flex justify-between">
              <span>{id ? "Sentimen Pasar Energi" : "Energy Sentiment"}</span>
              <span className={`font-mono font-bold ${oil.marketSentiment === "BULLISH" ? "text-emerald-400" : "text-rose-400"}`}>
                {oil.marketSentiment}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{id ? "Volume XLE (Raksasa Energi)" : "XLE 24h Volume"}</span>
              <span className="font-mono text-zinc-200 font-bold">{oil.xle.volume24h.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Commodities Table */}
      <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
        <h4 className="text-sm font-bold text-zinc-200">
          {id ? "Daftar Lengkap Pasar Komoditas & Aset Riil (Live Quotes)" : "Complete Commodities & Hard Assets Market Board"}
        </h4>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800 font-mono text-[11px]">
                <th className="py-2.5 px-3">Ticker / {id ? "Nama" : "Name"}</th>
                <th className="py-2.5 px-3">{id ? "Jenis Aset" : "Asset Type"}</th>
                <th className="py-2.5 px-3">{id ? "Harga Pasar" : "Market Price"}</th>
                <th className="py-2.5 px-3">24h Change</th>
                <th className="py-2.5 px-3">Volume</th>
                <th className="py-2.5 px-3">{id ? "Penerbit & Kustodian" : "Issuer & Vault"}</th>
                <th className="py-2.5 px-3 text-right">{id ? "Aksi" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {allCommodities.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-zinc-200 flex items-center gap-1.5">
                      <span>{item.symbol}</span>
                      <span className="text-[10px] text-zinc-500 font-normal font-sans">({item.id})</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-sans">{item.name}</div>
                  </td>

                  <td className="py-2.5 px-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      item.assetType === "GOLD"
                        ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                        : item.assetType === "SILVER"
                        ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                        : "bg-orange-500/10 text-orange-300 border-orange-500/20"
                    }`}>
                      {item.assetType}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 font-bold text-zinc-100">
                    ${item.price >= 1000 ? item.price.toLocaleString("en-US", { minimumFractionDigits: 2 }) : item.price.toFixed(2)}
                    <span className="text-[10px] text-zinc-500 font-normal font-sans ml-1">{item.unit}</span>
                  </td>

                  <td className={`py-2.5 px-3 font-semibold ${item.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatPercent(item.changePercent24h)}
                  </td>

                  <td className="py-2.5 px-3 text-zinc-300">
                    {item.volume24h.toLocaleString()}
                  </td>

                  <td className="py-2.5 px-3 text-zinc-400 font-sans text-[11px]">
                    <div>{item.issuer}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{item.backingReserves}</div>
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSelectSymbol(item.id)}
                      className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-sans inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Chart</span>
                      <ArrowUpRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
