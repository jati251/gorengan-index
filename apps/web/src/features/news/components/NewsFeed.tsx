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
import { timeAgo } from "@/utils/formatters";
import { NewsFeedSkeleton } from "./NewsSkeletons";
import type { NewsArticle } from "../types";
import { useTranslation } from "@/features/i18n";

const impactConfig = {
  HIGH: "text-rose-400 bg-rose-950/40 border-rose-800/40",
  MEDIUM: "text-amber-400 bg-amber-950/40 border-amber-800/40",
  LOW: "text-slate-500 bg-slate-800/40 border-slate-700/40",
} as const;

function NewsItem({ article, index }: { article: NewsArticle; index: number }) {
  const { dict, locale } = useTranslation();

  const sentimentDetails = {
    BULLISH: {
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-950/50 border-emerald-800/40",
      label: dict.news.sentiment.bull,
    },
    BEARISH: {
      icon: TrendingDown,
      color: "text-rose-400",
      bg: "bg-rose-950/50 border-rose-800/40",
      label: dict.news.sentiment.bear,
    },
    NEUTRAL: {
      icon: Minus,
      color: "text-slate-400",
      bg: "bg-slate-800/50 border-slate-700/40",
      label: dict.news.sentiment.ntrl,
    },
  }[article.sentiment];

  const SentimentIcon = sentimentDetails.icon;

  const localizedImpact = {
    HIGH: dict.news.impact.high,
    MEDIUM: dict.news.impact.medium,
    LOW: dict.news.impact.low,
  }[article.impact];

  return (
    <motion.a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className="group flex flex-col gap-1.5 px-3 py-2.5 hover:bg-white/[0.035] transition-all cursor-pointer border-b border-white/[0.04] last:border-b-0"
    >
      {/* Header: Source + Time + Impact */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
            {article.source}
          </span>
          <span
            className={clsx(
              "text-[9px] font-bold uppercase px-1 py-0 rounded border shrink-0 backdrop-blur-xs",
              impactConfig[article.impact]
            )}
          >
            {localizedImpact}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
          <Clock className="w-2.5 h-2.5" />
          <span className="tabular-nums">{timeAgo(article.publishedAt, locale)}</span>
        </div>
      </div>

      {/* Title */}
      <p className="text-xs text-slate-200 leading-snug font-medium group-hover:text-white transition-colors line-clamp-2">
        {article.title}
        <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300 inline ml-1.5 -mt-0.5 transition-colors" />
      </p>

      {/* Tags: Sentiment + Symbols */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={clsx(
            "inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border backdrop-blur-xs",
            sentimentDetails.bg,
            sentimentDetails.color
          )}
        >
          <SentimentIcon className="w-2.5 h-2.5" />
          {sentimentDetails.label}
        </span>
        {article.symbols.slice(0, 3).map((sym) => (
          <span
            key={sym}
            className="text-[9px] font-mono font-semibold text-[#f4c41b] bg-cyan-950/40 border border-cyan-800/30 px-1 py-0 rounded"
          >
            {sym}
          </span>
        ))}
      </div>
    </motion.a>
  );
}

export function NewsFeed() {
  const { dict } = useTranslation();
  const { data: articles, isLoading, isError, refetch, isFetching } = useNewsQuery();

  return (
    <div className="flex flex-col h-full font-mono select-none overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06] bg-[#3c3f5f] shrink-0">
        <div className="flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-[#f4c41b]" />
          <span className="text-sm font-bold uppercase tracking-wide text-slate-200">
            Market Wire
          </span>
          {articles && (
            <span className="text-[10px] text-slate-400 tabular-nums">
              ({articles.length})
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="min-h-10 min-w-10 flex items-center justify-center hover:bg-white/[0.08] transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh news"
        >
          <RefreshCw
            className={clsx(
              "w-3 h-3 text-slate-400 hover:text-white transition-colors",
              isFetching && "animate-spin"
            )}
          />
        </button>
      </div>

      {/* Feed Content — scrollable & bounded */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <NewsFeedSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center p-8 gap-3 text-center">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <span className="text-base text-slate-200">{dict.news.empty}</span>
            <button
              onClick={() => refetch()}
              className="text-[10px] text-[#f4c41b] hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !articles || articles.length === 0 ? (
          <div className="p-8 text-center text-base text-slate-300">
            {dict.news.empty}
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
