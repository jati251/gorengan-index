import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

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
