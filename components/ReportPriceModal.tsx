'use client';

import React, { useState } from 'react';
import { indonesiaUMP } from '@/data/indonesiaUmp';
import CustomSelect from './CustomSelect';

export default function ReportPriceModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [displayPrice, setDisplayPrice] = useState("Rp 2.000");
  const [selectedRegion, setSelectedRegion] = useState(indonesiaUMP[0].name);
  const [selectedTipe, setSelectedTipe] = useState("BAKWAN");

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-digits
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      setDisplayPrice("Rp ");
      return;
    }
    // Format as currency
    const formatted = new Intl.NumberFormat('id-ID').format(Number(digits));
    setDisplayPrice(`Rp ${formatted}`);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    // Extract numbers from the displayPrice (e.g. "Rp 2.000" -> 2000)
    const numericPrice = parseInt(displayPrice.replace(/\D/g, ""), 10) || 2000;

    const payload = {
      region: formData.get('region'),
      tipeGorengan: formData.get('tipeGorengan'),
      harga: numericPrice,
      shrinkflationDetected: formData.get('shrinkflationDetected') === 'on',
      kriukLevel: formData.get('kriukLevel'),
    };

    try {
      const res = await fetch('/api/crowdsource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
        }, 2000);
      } else {
        alert("Failed to submit. Database might be offline.");
      }
    } catch (err) {
      alert("Error submitting data.");
    }

    setLoading(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-mono text-xs px-3 py-1 rounded transition-colors animate-pulse"
      >
        [ REPORT LOCAL SPOT PRICE ]
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-950 border border-zinc-700 p-6 rounded-md shadow-2xl w-full max-w-md font-mono text-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-yellow-400">SUBMIT LOCAL MARKET DATA</h2>
          <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white">X</button>
        </div>

        {success ? (
          <div className="text-green-400 py-8 text-center">
            DATA INJECTED SUCCESSFULLY.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-zinc-500 text-xs mb-1">PROVINCE REGION</label>
              <CustomSelect 
                name="region" 
                value={selectedRegion}
                onChange={setSelectedRegion}
                options={indonesiaUMP.map(p => ({ label: p.name, value: p.name }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-500 text-xs mb-1">ASSET TYPE</label>
                <CustomSelect 
                  name="tipeGorengan" 
                  value={selectedTipe}
                  onChange={setSelectedTipe}
                  options={[
                    { label: "BAKWAN", value: "BAKWAN" },
                    { label: "TAHU", value: "TAHU" },
                    { label: "TEMPE", value: "TEMPE" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-zinc-500 text-xs mb-1">SPOT PRICE (IDR)</label>
                <input 
                  type="text" 
                  value={displayPrice}
                  onChange={handlePriceChange}
                  required 
                  className="w-full bg-zinc-900 border border-zinc-700 text-yellow-500 p-2 font-bold" 
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-500 text-xs mb-1">KRIUK INDEX (1-10)</label>
              <input name="kriukLevel" type="range" min="1" max="10" defaultValue="7" className="w-full" />
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" name="shrinkflationDetected" id="shrink" className="accent-yellow-500" />
              <label htmlFor="shrink" className="text-xs text-red-400">SHRINKFLATION DETECTED (Ukuran mengecil?)</label>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="mt-4 bg-yellow-500 text-black py-2 hover:bg-yellow-400 disabled:opacity-50 transition-colors"
            >
              {loading ? 'TRANSMITTING...' : 'BROADCAST TO TERMINAL'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
