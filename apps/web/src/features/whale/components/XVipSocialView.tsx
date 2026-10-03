"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Search,
  Filter,
  Flame,
  Radio,
  Repeat2,
  Heart,
  Eye,
  ShieldCheck,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import type { WhaleRadarData, XVipCategory, XVipPost } from "../types";
import { useTranslation } from "@/features/i18n";
import { useMarketStore } from "@/stores/marketStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface XVipSocialViewProps {
  data: WhaleRadarData;
}

export function XVipSocialView({ data }: XVipSocialViewProps) {
  const { locale } = useTranslation();
  const id = locale === "id";
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);
  const openWorkspace = useWorkspaceStore((s) => s.open);

  const vipFeed = data.vipSocialFeed;
  const posts = useMemo(() => vipFeed?.posts || [], [vipFeed?.posts]);

  const [selectedCategory, setSelectedCategory] = useState<XVipCategory | "ALL">("ALL");
  const [selectedAssetFilter, setSelectedAssetFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSelectSymbol = (asset: string) => {
    let symbolId: string | null = null;
    if (asset === "BTC") symbolId = "BINANCE:BTCUSDT";
    else if (asset === "ETH") symbolId = "BINANCE:ETHUSDT";
    else if (asset === "GOLD") symbolId = "PAXG-USDT";
    else if (asset === "SILVER") symbolId = "US:SLV";
    else if (asset === "OIL") symbolId = "US:USO";

    if (symbolId) {
      setSelectedSymbol(symbolId);
      openWorkspace("chart");
    }
  };

  // Filtered posts derived state (strictly no useEffect for derived state)
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // Category filter
      if (selectedCategory !== "ALL" && post.author.category !== selectedCategory) {
        return false;
      }
      // Asset filter
      if (selectedAssetFilter && post.signal.targetAsset !== selectedAssetFilter) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesAuthor =
          post.author.name.toLowerCase().includes(q) ||
          post.author.handle.toLowerCase().includes(q) ||
          post.author.role.toLowerCase().includes(q);
        const matchesContent = post.content.toLowerCase().includes(q);
        const matchesSignal =
          post.signal.analysisText.toLowerCase().includes(q) ||
          post.signal.type.toLowerCase().includes(q) ||
          post.signal.targetAsset.toLowerCase().includes(q);
        return matchesAuthor || matchesContent || matchesSignal;
      }
      return true;
    });
  }, [posts, selectedCategory, selectedAssetFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner: VIP Alpha Sentiment & Radar Meter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sentiment Meter Card */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-2">
            <span className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Flame size={15} />
              <span>{id ? "Indeks Sentimen VIP & Paus" : "VIP & Whale Sentiment Index"}</span>
            </span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
              <Radio size={10} className="animate-pulse" />
              <span>LIVE</span>
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-extrabold font-mono text-emerald-400 flex items-center gap-1">
              <span>{vipFeed?.vipSentimentScore ?? 86}</span>
              <span className="text-sm text-zinc-500 font-normal">/100</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {id ? "SANGAT BULLISH" : "STRONG BULLISH"}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-zinc-800/80 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 via-emerald-400 to-cyan-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${vipFeed?.vipSentimentScore ?? 86}%` }}
            />
          </div>

          <div className="text-[11px] text-zinc-400 mt-2 flex items-center justify-between">
            <span>{id ? "Konsensus Konglomerat & Dana Institusi" : "Institutional & Conglomerate Consensus"}</span>
            <span className="text-emerald-400 font-semibold font-mono">{id ? "Net Akumulasi" : "Net Accumulation"}</span>
          </div>
        </div>

        {/* Top Mentioned Assets Card */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-2">
            <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <Sparkles size={15} />
              <span>{id ? "Aset Paling Banyak Dibahas" : "Most Mentioned Assets"}</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">{posts.length} {id ? "Sinyal Terkurasi" : "Curated Signals"}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {vipFeed?.topMentionedAssets?.map((item) => {
              const isSelected = selectedAssetFilter === item.asset;
              return (
                <button
                  key={item.asset}
                  type="button"
                  onClick={() => setSelectedAssetFilter(isSelected ? null : item.asset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                    isSelected
                      ? "bg-cyan-500 text-zinc-950 border-cyan-400 shadow-sm"
                      : "bg-zinc-800/80 text-zinc-200 border-zinc-700/60 hover:bg-zinc-700/80 hover:border-zinc-500"
                  }`}
                >
                  <span>${item.asset}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${
                      isSelected
                        ? "bg-zinc-950 text-cyan-300"
                        : "bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-zinc-500 mt-2 flex items-center justify-between">
            <span>{id ? "Klik aset untuk memfilter feed" : "Click asset pill to filter feed"}</span>
            {selectedAssetFilter && (
              <button
                type="button"
                onClick={() => setSelectedAssetFilter(null)}
                className="text-amber-400 hover:text-amber-300 text-[10px] underline cursor-pointer"
              >
                {id ? "Reset Filter" : "Clear Filter"}
              </button>
            )}
          </div>
        </div>

        {/* Intelligence Roster Scope Card */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-2">
            <span className="flex items-center gap-1.5 text-amber-300 font-bold">
              <ShieldCheck size={15} />
              <span>{id ? "Cakupan Radar Tokoh Kunci" : "Tracked VIP Roster"}</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-400">{id ? "Terkurasi Tingkat 1" : "Tier-1 Curated"}</span>
          </div>

          <div className="text-xs text-zinc-300 leading-relaxed space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">{id ? "Konglo & Tech:" : "Tech Moguls:"}</span>
              <span className="font-semibold text-zinc-200">Elon Musk, Vitalik Buterin</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">{id ? "Paus Bitcoin:" : "Bitcoin Whales:"}</span>
              <span className="font-semibold text-zinc-200">Saylor, CZ, Whale Alert</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">{id ? "Institusi & Makro:" : "Institutions & Macro:"}</span>
              <span className="font-semibold text-zinc-200">BlackRock, Cathie, Trump, Hayes</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">{id ? "Emas & Minyak:" : "Gold & Hard Assets:"}</span>
              <span className="font-semibold text-zinc-200">Peter Schiff, Kobeissi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              selectedCategory === "ALL"
                ? "bg-amber-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            {id ? "Semua Feed" : "All Feeds"} ({posts.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("KONGLO_TECH")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              selectedCategory === "KONGLO_TECH"
                ? "bg-amber-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            {id ? "Konglomerat & Tech" : "Tech Moguls"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("BITCOIN_WHALE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              selectedCategory === "BITCOIN_WHALE"
                ? "bg-amber-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            {id ? "Paus Bitcoin" : "Bitcoin Whales"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("INSTITUTIONAL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              selectedCategory === "INSTITUTIONAL"
                ? "bg-amber-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            {id ? "Institusi & ETF" : "Institutions & ETF"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("MACRO_POLITICS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              selectedCategory === "MACRO_POLITICS"
                ? "bg-amber-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            {id ? "Makro & Politik" : "Macro & Politics"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("GOLD_COMMODITIES")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              selectedCategory === "GOLD_COMMODITIES"
                ? "bg-amber-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            {id ? "Emas & Minyak" : "Gold & Commodities"}
          </button>
        </div>

        {/* Live Search Input */}
        <div className="relative min-w-[200px] sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={id ? "Cari tokoh, $BTC, sinyal..." : "Search VIP, $ticker, signal..."}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/70 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main VIP Posts Feed */}
      {filteredPosts.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
          <Filter size={24} className="mx-auto text-zinc-600 mb-2" />
          <p className="text-sm font-semibold text-zinc-300">
            {id ? "Tidak ada postingan yang sesuai filter" : "No posts matching your filter criteria"}
          </p>
          <p className="text-xs text-zinc-500">
            {id
              ? "Coba ganti kategori, hapus kata kunci pencarian, atau reset filter aset."
              : "Try switching categories or clearing search keywords."}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("ALL");
              setSelectedAssetFilter(null);
              setSearchQuery("");
            }}
            className="mt-3 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 transition-colors cursor-pointer"
          >
            {id ? "Reset Semua Filter" : "Reset All Filters"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPosts.map((post) => (
            <VipPostCard
              key={post.id}
              post={post}
              idLocale={id}
              onSelectAsset={handleSelectSymbol}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface VipPostCardProps {
  post: XVipPost;
  idLocale: boolean;
  onSelectAsset: (asset: string) => void;
}

function VipPostCard({ post, idLocale, onSelectAsset }: VipPostCardProps) {
  const { author, signal, metrics } = post;

  // Avatar background colors based on category
  const avatarBg = useMemo(() => {
    switch (author.category) {
      case "KONGLO_TECH":
        return "bg-gradient-to-tr from-cyan-600 to-blue-500 text-white";
      case "BITCOIN_WHALE":
        return "bg-gradient-to-tr from-amber-600 to-orange-500 text-white";
      case "INSTITUTIONAL":
        return "bg-gradient-to-tr from-purple-600 to-indigo-500 text-white";
      case "MACRO_POLITICS":
        return "bg-gradient-to-tr from-rose-600 to-red-500 text-white";
      case "GOLD_COMMODITIES":
        return "bg-gradient-to-tr from-yellow-600 to-amber-400 text-zinc-950";
      default:
        return "bg-zinc-800 text-zinc-200";
    }
  }, [author.category]);

  // Signal Badge Styling
  const signalStyle = useMemo(() => {
    switch (signal.type) {
      case "STRONG_BULLISH":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          pillBg: "bg-emerald-500 text-zinc-950",
          text: idLocale ? "SANGAT BULLISH" : "STRONG BULLISH",
        };
      case "BULLISH":
        return {
          bg: "bg-green-500/10 border-green-500/30 text-green-400",
          pillBg: "bg-green-500 text-zinc-950",
          text: "BULLISH",
        };
      case "WHALE_ALERT":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
          pillBg: "bg-amber-500 text-zinc-950",
          text: idLocale ? "SINYAL PAUS (WHALE)" : "WHALE ALERT",
        };
      case "MACRO_ALERT":
        return {
          bg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
          pillBg: "bg-cyan-500 text-zinc-950",
          text: idLocale ? "MAKRO EKONOMI" : "MACRO ALERT",
        };
      case "CONTRARIAN":
        return {
          bg: "bg-purple-500/10 border-purple-500/30 text-purple-400",
          pillBg: "bg-purple-500 text-white",
          text: idLocale ? "SINYAL KONTRARIAN" : "CONTRARIAN SIGNAL",
        };
      default:
        return {
          bg: "bg-zinc-500/10 border-zinc-500/30 text-zinc-400",
          pillBg: "bg-zinc-500 text-zinc-950",
          text: "NEUTRAL",
        };
    }
  }, [signal.type, idLocale]);

  // Highlight symbols & mentions in content
  const renderFormattedContent = (content: string) => {
    const parts = content.split(/(\$[A-Z0-9]+|#[A-Za-z0-9_]+|@[A-Za-z0-9_]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("$")) {
        return (
          <span key={i} className="text-amber-400 font-mono font-bold">
            {part}
          </span>
        );
      }
      if (part.startsWith("#")) {
        return (
          <span key={i} className="text-cyan-400 font-medium">
            {part}
          </span>
        );
      }
      if (part.startsWith("@")) {
        return (
          <span key={i} className="text-blue-400 font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <article className="p-4.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all backdrop-blur-md flex flex-col justify-between space-y-3.5 group">
      {/* Author Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Avatar Initials */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-md shrink-0 ${avatarBg}`}
            >
              {author.initials}
            </div>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-zinc-100 text-sm group-hover:text-amber-400 transition-colors">
                  {author.name}
                </span>

                {/* Verified Badges */}
                {author.verifiedType === "GOLD" && (
                  <span
                    title="Verified Gold Organization"
                    className="inline-flex items-center text-amber-400"
                  >
                    <CheckCircle2 size={15} className="fill-amber-400 text-zinc-950" />
                  </span>
                )}
                {author.verifiedType === "BLUE" && (
                  <span
                    title="Verified Blue"
                    className="inline-flex items-center text-sky-400"
                  >
                    <CheckCircle2 size={15} className="fill-sky-400 text-zinc-950" />
                  </span>
                )}
                {author.verifiedType === "GOV" && (
                  <span
                    title="Government / Official Official"
                    className="inline-flex items-center text-zinc-400"
                  >
                    <CheckCircle2 size={15} className="fill-zinc-400 text-zinc-950" />
                  </span>
                )}

                <span className="text-xs text-zinc-500 font-mono">@{author.handle}</span>
              </div>

              <div className="text-[11px] text-zinc-400 leading-tight line-clamp-1">
                {author.role} • <span className="text-zinc-500 font-mono">{author.followersCount} {idLocale ? "pengikut" : "followers"}</span>
              </div>
            </div>
          </div>

          {/* Time & Direct Link */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-mono text-zinc-500">{post.timeAgoText}</span>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              title={idLocale ? "Buka postingan asli di X" : "Open original post on X"}
              className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Post Text */}
        <p className="mt-3 text-xs md:text-sm text-zinc-200 leading-relaxed font-sans select-text">
          {renderFormattedContent(post.content)}
        </p>
      </div>

      {/* AI Market Signal Analysis Box */}
      <div className={`p-3 rounded-lg border ${signalStyle.bg} space-y-2`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono ${signalStyle.pillBg}`}>
              {signalStyle.text}
            </span>
            <button
              type="button"
              onClick={() => onSelectAsset(signal.targetAsset)}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-900/90 text-amber-300 border border-amber-400/40 hover:bg-amber-400 hover:text-zinc-950 transition-colors inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>${signal.targetAsset}</span>
              <ArrowUpRight size={10} />
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-zinc-400">{idLocale ? "Keyakinan:" : "Confidence:"}</span>
            <span className="font-bold text-zinc-100">{signal.confidenceScore}%</span>
            {signal.impactLevel === "CRITICAL" && (
              <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-bold">
                {idLocale ? "DAMPAK TINGGI" : "HIGH IMPACT"}
              </span>
            )}
          </div>
        </div>

        <p className="text-[11px] text-zinc-300/90 leading-normal">
          <span className="font-bold text-zinc-200">
            {idLocale ? "Dampak Pasar: " : "Market Impact: "}
          </span>
          {signal.analysisText}
        </p>
      </div>

      {/* Engagement Metrics & Interaction Footer */}
      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5" title={idLocale ? "Retweet" : "Retweets"}>
            <Repeat2 size={13} className="text-zinc-500" />
            <span>{metrics.retweets.toLocaleString("en-US")}</span>
          </div>
          <div className="flex items-center gap-1.5" title={idLocale ? "Suka" : "Likes"}>
            <Heart size={13} className="text-rose-500/80" />
            <span>{metrics.likes.toLocaleString("en-US")}</span>
          </div>
          <div className="flex items-center gap-1.5" title={idLocale ? "Dilihat" : "Views"}>
            <Eye size={13} className="text-zinc-500" />
            <span>{metrics.views}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-400 hover:text-amber-400 font-sans inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{idLocale ? "Buka di X" : "View on X"}</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </article>
  );
}
