import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

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
