"use client";

import React from "react";
import type { ProviderStatusLevel } from "@gorengan/shared";
import { Badge } from "@/components/ui/badge";

interface MarketStatusBadgeProps {
  status: ProviderStatusLevel;
}

export function MarketStatusBadge({ status }: MarketStatusBadgeProps) {
  switch (status) {
    case "LIVE":
      return (
        <Badge variant="success">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Live
        </Badge>
      );
    case "STALE":
      return (
        <Badge variant="warning">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Stale
        </Badge>
      );
    case "RECONNECTING":
      return (
        <Badge variant="danger">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          Reconnecting
        </Badge>
      );
    case "CONNECTING":
      return (
        <Badge variant="outline">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          Connecting
        </Badge>
      );
    case "OFFLINE":
    default:
      return (
        <Badge variant="outline">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
          Offline
        </Badge>
      );
  }
}
