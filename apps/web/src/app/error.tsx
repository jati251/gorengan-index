"use client";

import { DataState } from "@/components/ui/data-state";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="min-h-[70dvh] flex items-center justify-center"><DataState error onRetry={reset} /></main>;
}
