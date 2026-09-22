import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/services/apiClient";
import type { SymbolsResponse } from "@gorengan/shared";

export function useSymbolsQuery() {
  return useQuery({
    queryKey: ["symbols"],
    queryFn: () => apiGet<SymbolsResponse>("/symbols"),
    staleTime: 60 * 1000,
  });
}
