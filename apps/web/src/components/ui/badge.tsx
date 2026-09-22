import React from "react";
import { clsx } from "clsx";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "danger" | "warning" | "outline" | "gold";
}

export function Badge({
  children,
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-slate-800 text-slate-300 border-slate-700",
    success: "bg-emerald-950/80 text-emerald-400 border-emerald-800/60",
    danger: "bg-rose-950/80 text-rose-400 border-rose-800/60",
    warning: "bg-amber-950/80 text-amber-400 border-amber-800/60",
    outline: "bg-transparent text-slate-400 border-slate-700",
    gold: "bg-yellow-950/80 text-yellow-400 border-yellow-700/60",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium border uppercase tracking-wider",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
