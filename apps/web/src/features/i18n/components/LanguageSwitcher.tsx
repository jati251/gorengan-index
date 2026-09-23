"use client";

import React from "react";
import { clsx } from "clsx";
import { Globe } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation";
import type { Locale } from "../types";

interface LanguageSwitcherProps {
  className?: string;
  showIcon?: boolean;
}

export function LanguageSwitcher({
  className,
  showIcon = false,
}: LanguageSwitcherProps) {
  const { locale, setLocale } = useTranslation();

  const handleSelect = (nextLocale: Locale) => {
    if (nextLocale !== locale) {
      setLocale(nextLocale);
    }
  };

  return (
    <div
      role="group"
      aria-label="Language selection"
      className={clsx(
        "inline-flex items-center gap-0.5 p-0.5 rounded bg-black/40 border border-white/[0.12] font-mono text-[11px] select-none shadow-inner",
        className
      )}
    >
      {showIcon && (
        <Globe
          className="size-3 text-slate-400 ml-1 mr-0.5 shrink-0"
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        role="button"
        aria-pressed={locale === "en"}
        onClick={() => handleSelect("en")}
        className={clsx(
          "px-2 py-0.5 rounded font-bold transition-all duration-150 cursor-pointer tracking-wider",
          locale === "en"
            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.35)]"
            : "text-slate-400 hover:text-slate-200 border border-transparent"
        )}
      >
        EN
      </button>
      <span className="text-white/20 text-[10px] select-none" aria-hidden="true">
        /
      </span>
      <button
        type="button"
        role="button"
        aria-pressed={locale === "id"}
        onClick={() => handleSelect("id")}
        className={clsx(
          "px-2 py-0.5 rounded font-bold transition-all duration-150 cursor-pointer tracking-wider",
          locale === "id"
            ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.35)]"
            : "text-slate-400 hover:text-slate-200 border border-transparent"
        )}
      >
        ID
      </button>
    </div>
  );
}
