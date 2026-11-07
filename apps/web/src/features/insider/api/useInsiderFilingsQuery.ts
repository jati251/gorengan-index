import { useQuery } from "@tanstack/react-query";
import type { InsiderFiling, FilingsResult, parseOwnershipXml } from "../utils/filings";
import type { PublicResult } from "@/lib/server/publicData";

async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export function useInsiderFilingDetailQuery(filing: InsiderFiling) {
  const query = new URLSearchParams({
    cik: filing.cik,
    accession: filing.accession,
    document: filing.document,
  });

  return useQuery({
    queryKey: ["insider-filing", filing.accession],
    queryFn: ({ signal }) =>
      readJson<PublicResult<ReturnType<typeof parseOwnershipXml>>>(
        `/api/insider-filings/detail?${query}`,
        signal
      ),
    staleTime: 86_400_000,
    retry: false,
  });
}

export function useInsiderFilingsQuery(search: string, days: number, offset: number) {
  const query = new URLSearchParams({
    q: search,
    days: String(days),
    offset: String(offset),
  });

  return useQuery({
    queryKey: ["insider-filings", search, days, offset],
    queryFn: ({ signal }) =>
      readJson<FilingsResult>(`/api/insider-filings?${query}`, signal),
    staleTime: 300_000,
    refetchInterval: 300_000,
    retry: 1,
  });
}

