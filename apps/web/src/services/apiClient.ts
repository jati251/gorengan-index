import { ENV } from "@/config/env";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(
  endpoint: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const base = ENV.API_BASE_URL.replace(/\/$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  let url = `${base}${cleanEndpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) {
        searchParams.append(k, String(v));
      }
    }
    const query = searchParams.toString();
    if (query) url += `?${query}`;
  }

  const res = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `API request failed with HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}
