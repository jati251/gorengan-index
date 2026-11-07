import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiGet } from "@/services/apiClient";
import { TIMEFRAME_MS, type Candle, type CandlesResponse, type Timeframe } from "@gorengan/shared";

const ROLLUP_SOURCES: Readonly<Record<Timeframe, readonly Timeframe[]>> = {
  "1s": [],
  "5s": ["1s"],
  "15s": ["5s", "1s"],
  "30s": ["15s", "5s", "1s"],
  "1m": ["15s", "5s", "1s"],
  "5m": ["1m"],
  "15m": ["5m", "1m"],
  "30m": ["15m", "5m", "1m"],
  "1h": ["15m", "5m", "1m"],
  "4h": ["1h", "15m", "5m", "1m"],
  "1d": ["4h", "1h"],
  "1w": ["1d", "4h", "1h"],
};

const CORE_PREFETCH_TIMEFRAMES: readonly Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
const SUBMINUTE_PREFETCH_TIMEFRAMES: readonly Timeframe[] = ["1s", "5s", "15s"];

const warmedSymbolTimeframes = new Map<string, number>();

export function getCandlesQueryKey(symbol: string, timeframe: Timeframe) {
  return ["candles", symbol, timeframe] as const;
}

function rollupCandlesClient(
  sourceCandles: Candle[],
  targetTimeframe: Timeframe,
  bucketMs: number
): Candle[] {
  if (sourceCandles.length === 0 || bucketMs <= 0) return [];

  const aggregated: Candle[] = [];
  let currentBucketOpen = -1;
  let current: Candle | null = null;
  const now = Date.now();

  for (let i = 0; i < sourceCandles.length; i++) {
    const c = sourceCandles[i];
    const bucketOpen = Math.floor(c.openTime / bucketMs) * bucketMs;

    if (bucketOpen !== currentBucketOpen || !current) {
      if (current) {
        aggregated.push(current);
      }
      currentBucketOpen = bucketOpen;
      current = {
        symbol: c.symbol,
        timeframe: targetTimeframe,
        openTime: bucketOpen,
        closeTime: bucketOpen + bucketMs - 1,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        trades: c.trades ?? 0,
        finalized: Boolean(c.finalized) && bucketOpen + bucketMs <= now,
        synthetic: true,
        provider: c.provider,
      };
    } else {
      if (c.high > current.high) current.high = c.high;
      if (c.low < current.low) current.low = c.low;
      current.close = c.close;
      current.volume += c.volume;
      current.trades = (current.trades ?? 0) + (c.trades ?? 0);
      if (!c.finalized) current.finalized = false;
    }
  }

  if (current) {
    aggregated.push(current);
  }

  return aggregated;
}

function synthesizeCandlesFromCache(
  queryClient: QueryClient,
  symbol: string,
  timeframe: Timeframe
): CandlesResponse | undefined {
  const candidates = ROLLUP_SOURCES[timeframe];
  if (!candidates || candidates.length === 0) return undefined;

  const targetMs = TIMEFRAME_MS[timeframe];
  if (!targetMs) return undefined;

  for (let i = 0; i < candidates.length; i++) {
    const sourceTf = candidates[i];
    const cached = queryClient.getQueryData<CandlesResponse>(getCandlesQueryKey(symbol, sourceTf));
    if (cached && cached.candles && cached.candles.length >= 10) {
      const rolledUp = rollupCandlesClient(cached.candles, timeframe, targetMs);
      if (rolledUp.length >= 5) {
        return {
          symbol,
          timeframe,
          candles: rolledUp,
        };
      }
    }
  }

  return undefined;
}

export function prefetchCandles(
  queryClient: QueryClient,
  symbol: string,
  timeframe: Timeframe
): void {
  if (!symbol) return;
  const key = getCandlesQueryKey(symbol, timeframe);
  const existingState = queryClient.getQueryState(key);
  const existingData = queryClient.getQueryData<CandlesResponse>(key);
  if (
    existingData?.candles?.length &&
    existingState?.dataUpdatedAt &&
    Date.now() - existingState.dataUpdatedAt < 30_000
  ) {
    return;
  }

  void queryClient.prefetchQuery({
    queryKey: key,
    queryFn: () =>
      apiGet<CandlesResponse>(`/candles/${encodeURIComponent(symbol)}`, {
        timeframe,
        limit: 1000,
      }),
    staleTime: 30_000,
  });
}

function scheduleAdjacentTimeframeWarmup(
  queryClient: QueryClient,
  symbol: string,
  activeTimeframe: Timeframe
): void {
  const now = Date.now();
  const lastWarmed = warmedSymbolTimeframes.get(symbol) ?? 0;
  if (now - lastWarmed < 60_000) return;
  warmedSymbolTimeframes.set(symbol, now);

  const isCrypto = symbol.endsWith("USDT") && !symbol.includes(":");
  const listToWarm: Timeframe[] = isCrypto
    ? [...SUBMINUTE_PREFETCH_TIMEFRAMES, ...CORE_PREFETCH_TIMEFRAMES]
    : [...CORE_PREFETCH_TIMEFRAMES];

  setTimeout(() => {
    listToWarm.forEach((tf, idx) => {
      if (tf === activeTimeframe) return;
      setTimeout(() => {
        prefetchCandles(queryClient, symbol, tf);
      }, idx * 80);
    });
  }, 120);
}

export function useCandlesQuery(symbol: string, timeframe: Timeframe = "1m") {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: getCandlesQueryKey(symbol, timeframe),
    queryFn: async () => {
      const res = await apiGet<CandlesResponse>(`/candles/${encodeURIComponent(symbol)}`, {
        timeframe,
        limit: 1000,
      });
      scheduleAdjacentTimeframeWarmup(queryClient, symbol, timeframe);
      return res;
    },
    placeholderData: () => synthesizeCandlesFromCache(queryClient, symbol, timeframe),
    enabled: !!symbol,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export async function fetchOlderCandles(
  symbol: string,
  timeframe: Timeframe,
  to: number,
  limit: number = 500
): Promise<CandlesResponse> {
  return apiGet<CandlesResponse>(`/candles/${encodeURIComponent(symbol)}`, {
    timeframe,
    to,
    limit,
  });
}
