import React from "react";
import { clsx } from "clsx";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  children,
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonProps) {
  const variantStyles = {
    primary:
      "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-sm shadow-emerald-950",
    secondary:
      "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80",
    ghost: "bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200",
    danger: "bg-rose-600 hover:bg-rose-500 text-white font-medium",
  };

  const sizeStyles = {
    sm: "px-2.5 py-1 text-xs rounded",
    md: "px-3.5 py-1.5 text-sm rounded-md",
    lg: "px-5 py-2.5 text-base rounded-md",
  };

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-mono",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
