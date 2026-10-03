export interface SourceState {
  source: string;
  url: string;
  status: "live" | "cached" | "stale" | "unavailable";
  fetchedAt: number | null;
  error?: string;
  retryAt?: number;
}
export interface PublicResult<T> extends SourceState { data: T | null }
interface Entry { data?: unknown; fetchedAt?: number; expires: number; retryAt: number; error?: string; pending?: Promise<PublicResult<unknown>> }
interface Host { nextAt: number; blockedUntil: number; tail: Promise<void>; queued: number }

export function retryAfterMs(header: string | null, now: number): number {
  if (!header) return 60_000;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : Math.max(0, Date.parse(header) - now) || 60_000;
}

export class PublicDataClient {
  private entries = new Map<string, Entry>();
  private hosts = new Map<string, Host>();
  constructor(private transport: typeof fetch = fetch, private clock = Date.now, private wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))) {}

  async read<T>(url: string, options: {
    source: string; ttlMs: number; maxStaleMs?: number; intervalMs?: number;
    headers?: Record<string, string>; parse: (text: string) => T;
  }): Promise<PublicResult<T>> {
    const now = this.clock();
    const key = url;
    let entry = this.entries.get(key);
    const result = (status: SourceState["status"]): PublicResult<T> => ({
      source: options.source, url, status, data: entry?.data as T ?? null,
      fetchedAt: entry?.fetchedAt ?? null, ...(entry?.error ? { error: entry.error } : {}),
      ...(entry?.retryAt && entry.retryAt > this.clock() ? { retryAt: entry.retryAt } : {}),
    });
    if (entry?.pending) return entry.pending as Promise<PublicResult<T>>;
    if (entry?.data !== undefined && entry.expires > now) return result("cached");
    if (entry?.retryAt && entry.retryAt > now) {
      if (entry.fetchedAt && now - entry.fetchedAt <= (options.maxStaleMs ?? 0)) return result("stale");
      return { ...result("unavailable"), data: null };
    }
    if (!entry) {
      if (this.entries.size >= 256) {
        const disposable = [...this.entries].find(([, value]) => !value.pending);
        if (!disposable) return { source: options.source, url, status: "unavailable", data: null, fetchedAt: null, error: "Request capacity reached" };
        this.entries.delete(disposable[0]);
      }
      entry = { expires: 0, retryAt: 0 };
      this.entries.set(key, entry);
    }
    const current = entry;
    const hostname = new URL(url).hostname;
    const hostKey = hostname.endsWith("sec.gov") ? "sec.gov" : hostname;
    let host = this.hosts.get(hostKey);
    if (!host) { host = { nextAt: 0, blockedUntil: 0, tail: Promise.resolve(), queued: 0 }; this.hosts.set(hostKey, host); }
    const gate = host;
    const task = async (): Promise<PublicResult<T>> => {
      try {
        if (gate.queued >= 24) throw new Error("Provider queue full; retry later");
        gate.queued++;
        const prior = gate.tail;
        let release!: () => void;
        gate.tail = new Promise<void>((resolve) => { release = resolve; });
        let response: Response;
        try {
          await prior;
          if (gate.blockedUntil > this.clock()) throw new Error("Provider cooldown active");
          await this.wait(Math.max(0, gate.nextAt - this.clock()));
          if (gate.blockedUntil > this.clock()) throw new Error("Provider cooldown active");
          gate.nextAt = this.clock() + (options.intervalMs ?? 350);
          response = await this.transport(url, { cache: "no-store", headers: options.headers, signal: AbortSignal.timeout(8000), redirect: "error" });
          if ([429, 418, 403, 503].includes(response.status)) {
            gate.blockedUntil = this.clock() + retryAfterMs(response.headers.get("retry-after"), this.clock());
          }
        } finally { gate.queued--; release(); }
        if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
        const raw = await response.text();
        if (raw.length > 8_000_000) throw new Error("Provider payload too large");
        const data = options.parse(raw);
        current.data = data;
        current.fetchedAt = this.clock();
        current.expires = current.fetchedAt + options.ttlMs;
        current.retryAt = 0;
        delete current.error;
        return result("live");
      } catch (error) {
        current.error = error instanceof Error ? error.message : "Provider request failed";
        current.retryAt = Math.max(gate.blockedUntil, this.clock() + 30_000);
        if (current.fetchedAt && this.clock() - current.fetchedAt <= (options.maxStaleMs ?? 0)) return result("stale");
        return { ...result("unavailable"), data: null };
      }
    };
    current.pending = task().finally(() => { delete current.pending; }) as Promise<PublicResult<unknown>>;
    return current.pending as Promise<PublicResult<T>>;
  }
}
export const publicData = new PublicDataClient();
export const finite = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
