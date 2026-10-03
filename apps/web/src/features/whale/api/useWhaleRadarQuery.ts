import { useQuery } from "@tanstack/react-query";
import type { WhaleRadarData } from "../types";

export const WHALE_RADAR_QUERY_KEY = ["whale-radar"] as const;

export async function fetchWhaleRadar(signal?: AbortSignal): Promise<WhaleRadarData> {
  const response = await fetch("/api/whale-radar", {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load whale radar: ${response.statusText}`);
  }

  const data = (await response.json()) as WhaleRadarData;

  return data;
}

export function useWhaleRadarQuery(enabled = true) {
  return useQuery<WhaleRadarData, Error>({
    queryKey: WHALE_RADAR_QUERY_KEY,
    enabled,
    queryFn: ({ signal }) => fetchWhaleRadar(signal),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}
