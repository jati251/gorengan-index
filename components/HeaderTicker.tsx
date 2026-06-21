'use client';

import React from 'react';

const messages = [
  "LIVE: Sentimen pasar Bakwan Jaksel menguat akibat krisis minyak goreng",
  "Warga Rawamangun laporkan tahu isi sekarang dominan isi angin daripada tauge",
  "BREAKING: Ukuran tempe mendoan Grogol menyusut 15% WoW",
  "WARNING: Cabe rawit hijau langka, pedagang mulai menggunakan cabe merah keriting",
  "SCBD Bakwan Index mencapai level tertinggi sepanjang masa, Rp 3.000 per biji"
];

export default function HeaderTicker() {
  return (
    <div className="w-full bg-black border-b border-zinc-800 overflow-hidden py-2 font-mono text-sm">
      <div className="animate-marquee whitespace-nowrap text-yellow-400">
        {messages.map((msg, idx) => (
          <span key={idx} className="mx-4">
            {msg} {" // "}
          </span>
        ))}
        {/* Duplicate for infinite effect */}
        {messages.map((msg, idx) => (
          <span key={`dup-${idx}`} className="mx-4">
            {msg} {" // "}
          </span>
        ))}
      </div>
    </div>
  );
}
