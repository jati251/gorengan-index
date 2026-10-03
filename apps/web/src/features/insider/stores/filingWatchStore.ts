import { create } from "zustand";
import { persist } from "zustand/middleware";
interface FilingWatchState {
  baselines: Record<string, string[]>;
  markSeen: (key: string, accessions: string[]) => void;
  stop: (key: string) => void;
}
export const useFilingWatchStore = create<FilingWatchState>()(persist((set) => ({
  baselines: {},
  markSeen: (key, accessions) => set((state) => ({ baselines: Object.fromEntries([...Object.entries(state.baselines).filter(([k]) => k !== key).slice(-19), [key, [...new Set([...(state.baselines[key] ?? []), ...accessions])].slice(-2000)]]) })),
  stop: (key) => set((state) => ({ baselines: Object.fromEntries(Object.entries(state.baselines).filter(([k]) => k !== key)) })),
}), {
  name: "gi-insider-watch-v1", skipHydration: true,
  partialize: (state) => ({ baselines: state.baselines }),
  merge: (saved, current) => {
    const value = saved && typeof saved === "object" && "baselines" in saved ? saved.baselines : null;
    if (!value || typeof value !== "object") return current;
    const entries = Object.entries(value).filter(([key, ids]) => /^(7|30|90):.{0,80}$/.test(key) && Array.isArray(ids))
      .slice(-20).map(([key, ids]) => [key, (ids as unknown[]).filter((id): id is string => typeof id === "string" && /^\d{10}-\d{2}-\d{6}$/.test(id)).slice(-2000)]);
    return { ...current, baselines: Object.fromEntries(entries) };
  },
}));
