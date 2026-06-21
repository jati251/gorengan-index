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
    // Initialize order book around current price
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

      // Clear flash
      setTimeout(() => {
        setBids(p => p.map(b => ({ ...b, flash: false })));
        setAsks(p => p.map(a => ({ ...a, flash: false })));
      }, 300);

    }, 800);

    return () => clearInterval(interval);
  }, [currentPrice]);

  return (
    <div className="bg-black border border-zinc-800 p-4 rounded-md shadow-lg flex flex-col font-mono text-xs">
      <h3 className="text-zinc-500 mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2">
        <span className="text-white bg-zinc-800 px-2 py-0.5 rounded-sm">LVL2</span>
        ORDER BOOK (BAKWAN/IDR)
      </h3>

      <div className="flex justify-between text-zinc-600 mb-2 px-1">
        <span>SIZE</span>
        <span>BID</span>
        <span className="text-zinc-800">|</span>
        <span>ASK</span>
        <span>SIZE</span>
      </div>

      <div className="flex flex-col gap-1">
        {asks.slice().reverse().map((ask, i) => (
          <div key={`ask-${i}`} className="flex justify-between items-center group">
            <span className="text-zinc-500 w-12 text-right opacity-0">-</span>
            <span className="text-zinc-500 w-16 text-right opacity-0">-</span>
            <span className="text-zinc-800">|</span>
            <span className={`w-16 text-left transition-colors ${ask.flash ? 'text-white bg-red-900/50' : 'text-red-400'}`}>
              {ask.price.toLocaleString("id-ID")}
            </span>
            <span className={`text-zinc-400 w-12 text-right transition-colors ${ask.flash ? 'text-white' : ''}`}>
              {ask.size}
            </span>
          </div>
        ))}

        <div className="py-1 my-1 border-y border-zinc-900 flex justify-center text-yellow-400 font-bold bg-yellow-400/5">
          {currentPrice.toLocaleString("id-ID")}
        </div>

        {bids.map((bid, i) => (
          <div key={`bid-${i}`} className="flex justify-between items-center group">
            <span className={`text-zinc-400 w-12 text-right transition-colors ${bid.flash ? 'text-white' : ''}`}>
              {bid.size}
            </span>
            <span className={`w-16 text-right transition-colors ${bid.flash ? 'text-white bg-green-900/50' : 'text-green-400'}`}>
              {bid.price.toLocaleString("id-ID")}
            </span>
            <span className="text-zinc-800">|</span>
            <span className="text-zinc-500 w-16 text-left opacity-0">-</span>
            <span className="text-zinc-500 w-12 text-left opacity-0">-</span>
          </div>
        ))}
      </div>
    </div>
  );
}
