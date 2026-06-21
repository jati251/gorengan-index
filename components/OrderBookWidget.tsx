"use client";

import React, { useEffect, useState } from "react";

interface Order {
  price: number;
  size: number;
  flash: boolean;
}

export default function OrderBookWidget({ currentPrice }: { currentPrice: number }) {
  const [bids, setBids] = useState<Order[]>([]);
  const [asks, setAsks] = useState<Order[]>([]);

  useEffect(() => {
    const generateOrders = (basePrice: number, isBid: boolean) => {
      const orders: Order[] = [];
      for (let i = 1; i <= 5; i++) {
        const spread = i * (Math.floor(Math.random() * 10) + 5);
        orders.push({
          price: isBid ? basePrice - spread : basePrice + spread,
          size: Math.floor(Math.random() * 5000) + 100,
          flash: false,
        });
      }
      return isBid ? orders.sort((a, b) => b.price - a.price) : orders.sort((a, b) => a.price - b.price);
    };

    setBids(generateOrders(currentPrice, true));
    setAsks(generateOrders(currentPrice, false));

    // Simulate HFT activity
    const interval = setInterval(() => {
      setBids(prev => {
        const newBids = [...prev];
        const idx = Math.floor(Math.random() * 5);
        newBids[idx] = { ...newBids[idx], size: Math.floor(Math.random() * 5000) + 100, flash: true };
        return newBids;
      });
      setAsks(prev => {
        const newAsks = [...prev];
        const idx = Math.floor(Math.random() * 5);
        newAsks[idx] = { ...newAsks[idx], size: Math.floor(Math.random() * 5000) + 100, flash: true };
        return newAsks;
      });

      setTimeout(() => {
        setBids(p => p.map(b => ({ ...b, flash: false })));
        setAsks(p => p.map(a => ({ ...a, flash: false })));
      }, 300);

    }, 800);

    return () => clearInterval(interval);
  }, [currentPrice]);

  const maxSize = Math.max(
    ...bids.map(b => b.size),
    ...asks.map(a => a.size),
    1
  );

  return (
    <div className="bg-black border border-zinc-800 p-4 rounded-md shadow-lg flex flex-col font-mono text-xs">
      <h3 className="text-zinc-500 mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2">
        <span className="text-white bg-zinc-800 px-2 py-0.5 rounded-sm">LVL2</span>
        ORDER BOOK (BAKWAN/IDR)
      </h3>

      {/* ASK side (sells) - reversed so highest is at top */}
      <div className="flex justify-between text-zinc-600 mb-1 text-[10px]">
        <span>PRICE</span>
        <span>SIZE</span>
      </div>

      <div className="flex flex-col gap-0.5 mb-1">
        {asks.slice().reverse().map((ask, i) => (
          <div key={`ask-${i}`} className="relative flex justify-between items-center py-0.5 px-1">
            {/* depth bar */}
            <div
              className="absolute right-0 top-0 h-full bg-red-900/30 transition-all duration-300"
              style={{ width: `${(ask.size / maxSize) * 100}%` }}
            />
            <span className={`relative z-10 transition-colors ${ask.flash ? 'text-white' : 'text-red-400'}`}>
              {ask.price.toLocaleString("id-ID")}
            </span>
            <span className={`relative z-10 text-zinc-400 transition-colors ${ask.flash ? 'text-white' : ''}`}>
              {ask.size.toLocaleString("id-ID")}
            </span>
          </div>
        ))}
      </div>

      {/* Spread / Last Price */}
      <div className="py-1.5 my-1 border-y border-zinc-800 flex justify-center text-yellow-400 font-bold bg-yellow-400/5 text-sm">
        {currentPrice.toLocaleString("id-ID")}
      </div>

      {/* BID side (buys) */}
      <div className="flex flex-col gap-0.5 mt-1">
        {bids.map((bid, i) => (
          <div key={`bid-${i}`} className="relative flex justify-between items-center py-0.5 px-1">
            {/* depth bar */}
            <div
              className="absolute left-0 top-0 h-full bg-green-900/30 transition-all duration-300"
              style={{ width: `${(bid.size / maxSize) * 100}%` }}
            />
            <span className={`relative z-10 transition-colors ${bid.flash ? 'text-white' : 'text-green-400'}`}>
              {bid.price.toLocaleString("id-ID")}
            </span>
            <span className={`relative z-10 text-zinc-400 transition-colors ${bid.flash ? 'text-white' : ''}`}>
              {bid.size.toLocaleString("id-ID")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
