"use client";
import { useState } from "react";
import type { WhaleRadarData } from "../types";
import { useTranslation } from "@/features/i18n";
export function XVipSocialView({ data }: { data: WhaleRadarData }) {
  const id = useTranslation().locale === "id";
  const [search, setSearch] = useState("");
  const posts = data.vipSocialFeed.posts.filter((p) => `${p.title} ${p.publisher} ${p.assets.join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-4">
    <p className="text-sm text-zinc-300">{id ? "Berita dari RSS penerbit. Ini bukan unggahan X atau sinyal insider. Sentimen hanya klasifikasi kata pada judul; netral jika arah tidak jelas." : "Publisher RSS news, not X posts or insider signals. Sentiment is a headline keyword classification; unclear direction remains neutral."}</p>
    <label className="block text-sm">{id ? "Cari berita / aset" : "Search headlines / assets"}<input value={search} onChange={(e) => setSearch(e.target.value)} className="block mt-2 w-full bg-zinc-900 border border-zinc-700 rounded p-2" /></label>
    <div className="flex flex-wrap gap-3 text-xs text-zinc-300">{data.vipSocialFeed.topMentionedAssets.map((a) => <button type="button" className="desk-button" key={a.asset} onClick={() => setSearch(a.asset)}>{a.asset}: {a.count}</button>)}</div>
    {!posts.length && <p role="status">{id ? "Tidak ada berita yang tersedia atau cocok dengan pencarian." : "No available headlines match this search."}</p>}
    {posts.map((p) => <article key={p.id} className="p-4 border border-zinc-700 rounded space-y-2"><a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-zinc-100 underline">{p.title}</a><p className="text-xs text-zinc-400">{p.publisher} · {new Date(p.publishedAt).toLocaleString()} · {p.sentiment}</p></article>)}
  </div>;
}
