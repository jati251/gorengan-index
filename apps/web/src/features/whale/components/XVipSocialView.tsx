"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WhaleRadarData } from "../types";
import { useTranslation } from "@/features/i18n";

export function XVipSocialView({ data }: { data: WhaleRadarData }) {
  const id = useTranslation().locale === "id";
  const [search, setSearch] = useState("");
  const posts = data.vipSocialFeed.posts.filter((p) =>
    `${p.title} ${p.publisher} ${p.assets.join(" ")}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-300">
        {id
          ? "Berita dari RSS penerbit. Ini bukan unggahan X atau sinyal insider. Sentimen hanya klasifikasi kata pada judul; netral jika arah tidak jelas."
          : "Publisher RSS news, not X posts or insider signals. Sentiment is a headline keyword classification; unclear direction remains neutral."}
      </p>

      <label className="block text-sm">
        <span className="font-semibold text-zinc-300">{id ? "Cari berita / aset" : "Search headlines / assets"}</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={id ? "Contoh: Bitcoin, ETF, Fed..." : "e.g. Bitcoin, ETF, Fed..."}
          className="block mt-1.5 w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 font-mono text-zinc-100 text-sm focus:border-amber-400 focus:outline-hidden"
        />
      </label>

      <div className="flex flex-wrap gap-2 text-xs">
        {data.vipSocialFeed.topMentionedAssets.map((a) => (
          <button
            type="button"
            className="desk-button py-1 px-2.5 text-xs font-mono transition-transform hover:scale-105"
            key={a.asset}
            onClick={() => setSearch(a.asset)}
          >
            {a.asset}: <span className="text-amber-400 font-bold">{a.count}</span>
          </button>
        ))}
      </div>

      {!posts.length && (
        <p role="status" className="text-xs text-zinc-400">
          {id ? "Tidak ada berita yang tersedia atau cocok dengan pencarian." : "No available headlines match this search."}
        </p>
      )}

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {posts.map((p, idx) => (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ delay: Math.min(idx * 0.03, 0.25), duration: 0.18 }}
              className="p-4 border border-zinc-700/80 rounded-xl bg-zinc-900/40 space-y-2 hover:border-zinc-600 transition-colors"
            >
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-zinc-100 underline hover:text-amber-300 transition-colors"
              >
                {p.title}
              </a>
              <p className="text-xs text-zinc-400 font-mono">
                {p.publisher} · {new Date(p.publishedAt).toLocaleString()} ·{" "}
                <span className={p.sentiment === "BULLISH" ? "text-emerald-400 font-bold" : p.sentiment === "BEARISH" ? "text-rose-400 font-bold" : "text-zinc-400"}>
                  {p.sentiment}
                </span>
              </p>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
