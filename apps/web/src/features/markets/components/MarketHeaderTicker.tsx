"use client";

import Link from "next/link";
import { useMarketStore } from "@/stores/marketStore";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { DeviceClock } from "./DeviceClock";
import { UserNav } from "@/features/auth";
import { LanguageSwitcher } from "@/features/i18n";

export function MarketHeaderTicker() {
  const status = useMarketStore((state) => state.providerStatus);

  return (
    <header className="terminal-header">
      <Link href="/" className="terminal-brand" aria-label="Gorengan Index home">
        <span className="terminal-brand-mark" aria-hidden="true">G.</span>
        <span>GORENGAN <b>INDEX</b></span>
      </Link>
      <div className="terminal-header-actions">
        <div data-header-clock>
          <DeviceClock />
        </div>
        <div data-header-status>
          <MarketStatusBadge status={status} />
        </div>
        <LanguageSwitcher className="shrink-0" />
        <UserNav />
      </div>
    </header>
  );
}
