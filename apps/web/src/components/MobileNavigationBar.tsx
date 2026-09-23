"use client";

import React from "react";
import { TrendingUp, LayoutGrid, Newspaper } from "lucide-react";
import { clsx } from "clsx";
import { useTranslation } from "@/features/i18n";

export type MobileTab = "chart" | "markets" | "intel";

interface MobileNavigationBarProps {
  activeTab: MobileTab;
  onChangeTab: (tab: MobileTab) => void;
}

export function MobileNavigationBar({ activeTab, onChangeTab }: MobileNavigationBarProps) {
  const { dict } = useTranslation();

  const tabs: { id: MobileTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "chart", label: dict.terminal.mobileNav.chart, icon: TrendingUp },
    { id: "markets", label: dict.terminal.mobileNav.markets, icon: LayoutGrid },
    { id: "intel", label: dict.terminal.mobileNav.intel, icon: Newspaper },
  ];

  return (
    <nav aria-label="Mobile navigation" className="terminal-mobile-nav">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onChangeTab(tab.id)}
            className={clsx("terminal-mobile-nav-button", isActive && "is-active")}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
