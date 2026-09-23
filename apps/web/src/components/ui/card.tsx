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
        "glass-card rounded-md overflow-hidden",
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
        "px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-[#55607e] bg-[#3c3f5f] flex items-center justify-between",
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
        "text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-2",
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
    <div className={clsx("p-3 sm:p-4", className)} {...props}>
      {children}
    </div>
  );
}
