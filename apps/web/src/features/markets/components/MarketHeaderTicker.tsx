"use client";

import Link from "next/link";
import { useMarketStore } from "@/stores/marketStore";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { DeviceClock } from "./DeviceClock";
import { UserNav } from "@/features/auth";

export function MarketHeaderTicker() {
  const status = useMarketStore((state) => state.providerStatus);

  return (
    <header className="terminal-header">
      <Link href="/" className="terminal-brand" aria-label="Gorengan Index home">
        <span className="terminal-brand-mark" aria-hidden="true">G.</span>
        <span>GORENGAN <b>INDEX</b></span>
      </Link>
      <div className="terminal-header-actions">
        <DeviceClock />
        <MarketStatusBadge status={status} />
        <UserNav />
      </div>
    </header>
  );
}
