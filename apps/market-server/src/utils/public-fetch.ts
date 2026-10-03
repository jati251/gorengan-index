interface Gate { nextAt: number; blockedUntil: number; pending: number; tail: Promise<void> }
const gates = new Map<string, Gate>();
export async function publicFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const hostname = new URL(url).hostname;
  let gate = gates.get(hostname);
  if (!gate) { gate = { nextAt: 0, blockedUntil: 0, pending: 0, tail: Promise.resolve() }; gates.set(hostname, gate); }
  if (gate.pending >= 32) throw new Error("Provider queue full");
  gate.pending++;
  const before = gate.tail;
  let release!: () => void;
  gate.tail = new Promise<void>((resolve) => { release = resolve; });
  try {
    await before;
    if (gate.blockedUntil > Date.now()) throw new Error("Provider cooldown active");
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, gate.nextAt - Date.now())));
    gate.nextAt = Date.now() + 350;
    const response = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(8000) });
    if ([403, 418, 429, 503].includes(response.status)) {
      const header = response.headers.get("retry-after");
      const seconds = header === null ? NaN : Number(header);
      const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header ?? "") - Date.now();
      gate.blockedUntil = Date.now() + Math.max(60000, Number.isFinite(delay) ? delay : 60000);
    }
    return response;
  } finally { gate.pending--; release(); }
}
