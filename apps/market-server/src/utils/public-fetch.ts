export type FetchPriority = "high" | "normal" | "low";

export interface PublicFetchInit extends RequestInit {
  priority?: FetchPriority;
}

interface HostPolicy {
  maxConcurrency: number;
  highSpacingMs: number;
  lowSpacingMs: number;
  maxPending: number;
}

interface QueuedWaiter {
  priority: FetchPriority;
  resolve: () => void;
}

interface Gate {
  nextAt: number;
  blockedUntil: number;
  active: number;
  highQueue: QueuedWaiter[];
  normalQueue: QueuedWaiter[];
  lowQueue: QueuedWaiter[];
}

const gates = new Map<string, Gate>();

function getHostPolicy(hostname: string): HostPolicy {
  if (hostname.includes("binance.")) {
    return {
      maxConcurrency: 6,
      highSpacingMs: 15,
      lowSpacingMs: 50,
      maxPending: 256,
    };
  }
  if (hostname.includes("yahoo.")) {
    return {
      maxConcurrency: 2,
      highSpacingMs: 80,
      lowSpacingMs: 300,
      maxPending: 128,
    };
  }
  return {
    maxConcurrency: 2,
    highSpacingMs: 100,
    lowSpacingMs: 250,
    maxPending: 64,
  };
}

function getPendingCount(gate: Gate): number {
  return gate.highQueue.length + gate.normalQueue.length + gate.lowQueue.length;
}

function dequeueNext(gate: Gate): QueuedWaiter | undefined {
  return gate.highQueue.shift() ?? gate.normalQueue.shift() ?? gate.lowQueue.shift();
}

export async function publicFetch(
  url: string,
  init: PublicFetchInit = {}
): Promise<Response> {
  const { priority = "normal", ...fetchInit } = init;
  const hostname = new URL(url).hostname;
  const policy = getHostPolicy(hostname);

  let gate = gates.get(hostname);
  if (!gate) {
    gate = {
      nextAt: 0,
      blockedUntil: 0,
      active: 0,
      highQueue: [],
      normalQueue: [],
      lowQueue: [],
    };
    gates.set(hostname, gate);
  }

  if (getPendingCount(gate) >= policy.maxPending) {
    throw new Error("Provider queue full");
  }

  if (gate.active >= policy.maxConcurrency || getPendingCount(gate) > 0) {
    await new Promise<void>((resolve) => {
      const waiter: QueuedWaiter = { priority, resolve };
      if (priority === "high") {
        gate!.highQueue.push(waiter);
      } else if (priority === "low") {
        gate!.lowQueue.push(waiter);
      } else {
        gate!.normalQueue.push(waiter);
      }
    });
  }

  gate.active++;

  try {
    const now = Date.now();
    if (gate.blockedUntil > now) {
      throw new Error("Provider cooldown active");
    }

    const waitMs = Math.max(0, gate.nextAt - now);
    const spacingMs = priority === "low" ? policy.lowSpacingMs : policy.highSpacingMs;
    gate.nextAt = Math.max(now, gate.nextAt) + spacingMs;

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    if (gate.blockedUntil > Date.now()) {
      throw new Error("Provider cooldown active");
    }

    const response = await fetch(url, {
      ...fetchInit,
      signal: fetchInit.signal ?? AbortSignal.timeout(8000),
    });

    if ([403, 418, 429, 503].includes(response.status)) {
      const header = response.headers.get("retry-after");
      const seconds = header === null ? NaN : Number(header);
      const delay = Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(header ?? "") - Date.now();
      gate.blockedUntil =
        Date.now() + Math.max(60000, Number.isFinite(delay) ? delay : 60000);
    }

    return response;
  } finally {
    gate.active--;
    const next = dequeueNext(gate);
    if (next) {
      next.resolve();
    }
  }
}
