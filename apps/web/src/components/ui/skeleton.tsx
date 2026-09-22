import React from "react";
import { clsx } from "clsx";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/** Base shimmer block — animates with a left-to-right gradient sweep. */
export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      style={style}
      className={clsx(
        "relative overflow-hidden rounded bg-slate-800/60",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_1.8s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-slate-700/30 before:to-transparent",
        className
      )}
    />
  );
}

/* ─── Domain-specific skeleton compositions ────────────────────── */

/** Skeleton for the full-width candlestick chart area. */
export function ChartSkeleton() {
  return (
    <div className="w-full h-full flex flex-col gap-3 p-4">
      {/* Fake OHLC legend row */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="h-3.5 w-14" />
      </div>

      {/* Main chart body — stacked bars to mimic candlesticks */}
      <div className="flex-1 flex items-end gap-[3px] px-2">
        {Array.from({ length: 48 }).map((_, i) => {
          const h = Math.round(25 + Math.sin(i * 0.4) * 18 + Math.cos(i * 0.7) * 15);
          return (
            <Skeleton
              key={i}
              className="flex-1 rounded-sm min-w-[4px]"
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>

      {/* Fake time axis */}
      <div className="flex justify-between px-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-10" />
        ))}
      </div>
    </div>
  );
}

/** Single row skeleton for market tables. */
function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3 border-b border-slate-800/30">
      <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-3.5 w-16 ml-auto" />
      <Skeleton className="h-3.5 w-14" />
      <Skeleton className="h-3.5 w-20 hidden sm:block" />
    </div>
  );
}

/** Skeleton for the market overview table. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="w-full">
      {/* Header row */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-800 bg-[#060910]">
        <Skeleton className="h-2.5 w-8" />
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-16 ml-auto" />
        <Skeleton className="h-2.5 w-14" />
        <Skeleton className="h-2.5 w-14 hidden sm:block" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton for the watchlist sidebar items. */
export function WatchlistSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="flex flex-col">
      {/* Search bar skeleton */}
      <div className="p-3 border-b border-slate-800/80 space-y-2.5">
        <Skeleton className="h-8 w-full rounded" />
        <div className="grid grid-cols-2 gap-1">
          <Skeleton className="h-7 rounded" />
          <Skeleton className="h-7 rounded" />
        </div>
      </div>
      {/* Items */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 border-b border-slate-800/30">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the news feed panel. */
export function NewsFeedSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-3 w-3 rounded" />
      </div>
      {/* News items */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5 px-3 py-2.5 border-b border-slate-800/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-2.5 w-10" />
            </div>
            <Skeleton className="h-2.5 w-12" />
          </div>
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-4 w-10 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the sentiment gauge. */
export function SentimentSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-5 w-20 rounded" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex justify-between">
        <Skeleton className="h-2 w-20" />
        <Skeleton className="h-2 w-14" />
        <Skeleton className="h-2 w-24" />
      </div>
    </div>
  );
}

/** Skeleton for market stats grid. */
export function MarketStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-800/30 bg-slate-800/20">
          <Skeleton className="h-3.5 w-3.5 rounded shrink-0" />
          <div className="flex flex-col gap-1 flex-1">
            <Skeleton className="h-2 w-16" />
            <Skeleton className="h-3.5 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
