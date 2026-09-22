"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { clsx } from "clsx";
import { useNewsQuery } from "../api/useNewsQuery";
import type { NewsArticle } from "../types";
import { NewsFeedSkeleton } from "../../../components/ui/skeleton";

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "—";
  }
}

const sentimentConfig = {
  BULLISH: {
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-950/50 border-emerald-800/40",
    label: "BULL",
  },
  BEARISH: {
    icon: TrendingDown,
    color: "text-rose-400",
    bg: "bg-rose-950/50 border-rose-800/40",
    label: "BEAR",
  },
  NEUTRAL: {
    icon: Minus,
    color: "text-slate-400",
    bg: "bg-slate-800/50 border-slate-700/40",
    label: "NTRL",
  },
} as const;

const impactConfig = {
  HIGH: "text-rose-400 bg-rose-950/40 border-rose-800/40",
  MEDIUM: "text-amber-400 bg-amber-950/40 border-amber-800/40",
  LOW: "text-slate-500 bg-slate-800/40 border-slate-700/40",
} as const;

function NewsItem({ article, index }: { article: NewsArticle; index: number }) {
  const sentiment = sentimentConfig[article.sentiment];
  const SentimentIcon = sentiment.icon;

  return (
    <motion.a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className="group flex flex-col gap-1.5 px-3 py-2.5 hover:bg-slate-800/30 transition-colors cursor-pointer border-b border-slate-800/40 last:border-b-0"
    >
      {/* Header: Source + Time + Impact */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 shrink-0">
            {article.source}
          </span>
          <span
            className={clsx(
              "text-[9px] font-bold uppercase px-1 py-0 rounded border shrink-0",
              impactConfig[article.impact]
            )}
          >
            {article.impact}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
          <Clock className="w-2.5 h-2.5" />
          <span className="tabular-nums">{timeAgo(article.publishedAt)}</span>
        </div>
      </div>

      {/* Title */}
      <p className="text-xs text-slate-200 leading-snug font-medium group-hover:text-white transition-colors line-clamp-2">
        {article.title}
        <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-slate-400 inline ml-1.5 -mt-0.5 transition-colors" />
      </p>

      {/* Tags: Sentiment + Symbols */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={clsx(
            "inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border",
            sentiment.bg,
            sentiment.color
          )}
        >
          <SentimentIcon className="w-2.5 h-2.5" />
          {sentiment.label}
        </span>
        {article.symbols.slice(0, 3).map((sym) => (
          <span
            key={sym}
            className="text-[9px] font-mono font-semibold text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-1 py-0 rounded"
          >
            {sym}
          </span>
        ))}
      </div>
    </motion.a>
  );
}

export function NewsFeed() {
  const { data: articles, isLoading, isError, refetch, isFetching } = useNewsQuery();

  return (
    <div className="flex flex-col h-full font-mono select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800/80 bg-[#080c16]/80">
        <div className="flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Market Wire
          </span>
          {articles && (
            <span className="text-[10px] text-slate-500 tabular-nums">
              ({articles.length})
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1 rounded hover:bg-slate-800/60 transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh news"
        >
          <RefreshCw
            className={clsx(
              "w-3 h-3 text-slate-500 hover:text-slate-300 transition-colors",
              isFetching && "animate-spin"
            )}
          />
        </button>
      </div>

      {/* Feed Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {isLoading ? (
          <NewsFeedSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-[11px] text-slate-500">Feed unavailable</span>
            <button
              onClick={() => refetch()}
              className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !articles || articles.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 italic">
            No recent market news.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {articles.map((article, idx) => (
              <NewsItem key={article.id} article={article} index={idx} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
