import React from "react";

export default function BtcParityWidget({
  btcIdrPrice,
  benchmarkPrice,
}: {
  btcIdrPrice: number;
  benchmarkPrice: number;
}) {
  const parity = Math.floor(btcIdrPrice / benchmarkPrice);

  return (
    <div className="bg-black border border-zinc-800 p-4 rounded-md">
      <h3 className="text-zinc-500 font-mono text-xs mb-4 flex justify-between">
        <span>BITCOIN PARITY (BTC/BAKWAN)</span>
      </h3>
      <div className="text-3xl font-mono text-yellow-400 mb-2">
        {parity.toLocaleString("id-ID")}
      </div>
      <div className="text-xs font-mono text-zinc-500">
        1 BTC setara dengan {parity.toLocaleString("id-ID")} potong Bakwan.
      </div>
    </div>
  );
}
