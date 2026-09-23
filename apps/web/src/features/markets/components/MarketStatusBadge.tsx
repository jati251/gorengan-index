"use client";

import React from "react";
import type { ProviderStatusLevel } from "@gorengan/shared";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/features/i18n";

interface MarketStatusBadgeProps {
  status: ProviderStatusLevel;
}

export function MarketStatusBadge({ status }: MarketStatusBadgeProps) {
  const { dict } = useTranslation();

  switch (status) {
    case "LIVE":
      return (
        <Badge variant="success">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          {dict.common.status.live}
        </Badge>
      );
    case "STALE":
      return (
        <Badge variant="warning">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          {dict.common.status.stale}
        </Badge>
      );
    case "RECONNECTING":
      return (
        <Badge variant="danger">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          {dict.common.status.reconnecting}
        </Badge>
      );
    case "CONNECTING":
      return (
        <Badge variant="outline">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          {dict.common.status.connecting}
        </Badge>
      );
    case "OFFLINE":
    default:
      return (
        <Badge variant="outline">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
          {dict.common.status.offline}
        </Badge>
      );
  }
}
