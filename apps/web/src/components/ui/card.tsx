import React from "react";
import { clsx } from "clsx";

export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "bg-[#0d121c]/90 border border-slate-800/80 rounded-lg backdrop-blur-md shadow-lg overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "px-4 py-3 border-b border-slate-800/80 flex items-center justify-between",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={clsx(
        "text-sm font-semibold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("p-4", className)} {...props}>
      {children}
    </div>
  );
}
