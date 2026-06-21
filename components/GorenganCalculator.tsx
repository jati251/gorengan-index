'use client';

import React, { useState } from 'react';
import { calculateNetWorth, getSocialClass, RegionalIndex } from '@/data/gorenganData';

interface GorenganCalculatorProps {
  regions: RegionalIndex[];
}

export default function GorenganCalculator({ regions }: GorenganCalculatorProps) {
  const [salary, setSalary] = useState<number>(5067381); // Default Jakarta UMP
  const [selectedRegion, setSelectedRegion] = useState<string>("DKI Jakarta");

  const activeRegion = regions.find(r => r.region === selectedRegion) || regions[0];
  const netWorth = activeRegion ? calculateNetWorth(salary, activeRegion.bakwanPrice) : 0;
  const socialClass = getSocialClass(netWorth);
  
  const umpRatio = activeRegion ? (salary / activeRegion.ump) * 100 : 100;

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-6 shadow-xl font-mono text-zinc-300">
      <h2 className="text-zinc-400 font-mono text-sm tracking-widest border-b border-zinc-800 pb-2 mb-4">
        PPP CALCULATOR (NATIONAL)
      </h2>
      
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">PROVINCE</label>
          <select 
            className="bg-black border border-zinc-800 rounded p-2 text-yellow-400 focus:outline-none focus:border-zinc-500"
            value={selectedRegion}
            onChange={(e) => {
              setSelectedRegion(e.target.value);
              // Auto-update salary to UMP when region changes to show comparison
              const newRegion = regions.find(r => r.region === e.target.value);
              if (newRegion) setSalary(newRegion.ump);
            }}
          >
            {/* Sort alphabetically for the dropdown */}
            {[...regions].sort((a,b) => a.region.localeCompare(b.region)).map(r => (
              <option key={r.region} value={r.region}>{r.region}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">MONTHLY SALARY (IDR)</label>
          <input 
            type="number" 
            className="bg-black border border-zinc-800 rounded p-2 text-green-400 focus:outline-none focus:border-zinc-500"
            value={salary}
            onChange={(e) => setSalary(Number(e.target.value))}
          />
          <div className="text-[10px] text-zinc-600 mt-1 flex justify-between">
            <span>UMP 2026: Rp {activeRegion?.ump?.toLocaleString('id-ID')}</span>
            <span className={umpRatio >= 100 ? "text-green-500" : "text-red-500"}>
              {umpRatio.toFixed(1)}% of UMP
            </span>
          </div>
        </div>

        <div className="mt-4 p-4 bg-black border border-zinc-800 rounded">
          <div className="text-xs text-zinc-500 mb-1">GORENGAN NET WORTH</div>
          <div className="text-3xl font-bold text-white mb-2">
            {netWorth.toLocaleString('id-ID')} <span className="text-sm text-zinc-500 font-normal">BAKWAN</span>
          </div>
          
          <div className="text-xs text-zinc-500 mb-1">SOCIAL CLASS STATUS</div>
          <div className={`text-sm font-bold ${
            netWorth > 3000 ? 'text-green-400' : 
            netWorth >= 1000 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {socialClass}
          </div>
        </div>
      </div>
    </div>
  );
}
