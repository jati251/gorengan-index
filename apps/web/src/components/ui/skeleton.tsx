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
