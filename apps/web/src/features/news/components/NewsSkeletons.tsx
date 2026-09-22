import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

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
