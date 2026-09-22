import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

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
