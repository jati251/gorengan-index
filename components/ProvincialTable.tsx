import React from "react";
import { RegionalIndex } from "@/data/gorenganData";

export default function ProvincialTable({ regions }: { regions: RegionalIndex[] }) {
  return (
    <div className="bg-black border border-zinc-800 rounded-md p-4 shadow-xl flex flex-col h-[500px]">
      <h2 className="text-zinc-400 font-mono text-sm tracking-widest mb-4 shrink-0">
        NATIONAL PROVINCIAL SPOT PRICES (SORTED BY BAKWAN)
      </h2>
      <div className="overflow-auto grow custom-scrollbar">
        <table className="w-full text-left font-mono text-sm min-w-[700px]">
          <thead className="sticky top-0 bg-black z-10">
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="pb-2 px-2 whitespace-nowrap">PROVINCE</th>
              <th className="pb-2 px-2 whitespace-nowrap">UMP 24</th>
              <th className="pb-2 px-2 whitespace-nowrap text-yellow-400">
                BAKWAN
              </th>
              <th className="pb-2 px-2 whitespace-nowrap text-yellow-400">
                TAHU
              </th>
              <th className="pb-2 px-2 whitespace-nowrap text-yellow-400">
                TEMPE
              </th>
              <th className="pb-2 px-2 whitespace-nowrap">SHRINK</th>
              <th className="pb-2 px-2 whitespace-nowrap">TREND</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((r, i) => (
              <tr
                key={r.region}
                className="border-b border-zinc-900/50 hover:bg-zinc-900 transition-colors"
              >
                <td className="py-3 px-2 text-white whitespace-nowrap">
                  <span className="text-zinc-600 mr-2 text-xs">{i + 1}.</span>
                  {r.region}
                </td>
                <td className="py-3 px-2 text-zinc-400 whitespace-nowrap">
                  {(r.ump / 1000000).toFixed(1)}M
                </td>
                <td className="py-3 px-2 font-bold whitespace-nowrap">
                  Rp {r.bakwanPrice.toLocaleString("id-ID")}
                </td>
                <td className="py-3 px-2 text-zinc-300 whitespace-nowrap">
                  Rp {r.tahuPrice.toLocaleString("id-ID")}
                </td>
                <td className="py-3 px-2 text-zinc-300 whitespace-nowrap">
                  Rp {r.tempePrice.toLocaleString("id-ID")}
                </td>
                <td className="py-3 px-2 whitespace-nowrap">
                  {r.sizePercentage}%
                </td>
                <td
                  className={`py-3 px-2 whitespace-nowrap ${r.sentiment === "BEARISH" ? "text-red-400" : r.sentiment === "BULLISH" ? "text-green-400" : "text-zinc-500"}`}
                >
                  {r.sentiment}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
