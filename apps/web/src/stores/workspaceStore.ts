import { create } from "zustand";
import { persist } from "zustand/middleware";

export const widgetKinds = ["overview", "chart", "analysis", "prediction", "composition", "markets", "orderbook", "pulse", "news", "calculator", "cryptoIntel"] as const;
export type WidgetKind = typeof widgetKinds[number];
const defaults: WidgetKind[] = ["overview", "chart", "analysis", "prediction", "composition", "markets", "calculator"];
interface WorkspaceState {
  tabs: WidgetKind[];
  active: WidgetKind;
  focus: boolean;
  open: (kind: WidgetKind) => void;
  close: (kind: WidgetKind) => void;
  toggleFocus: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(persist((set) => ({
  tabs: defaults,
  active: "overview",
  focus: false,
  open: (kind) => set((state) => ({ tabs: state.tabs.includes(kind) ? state.tabs : [...state.tabs, kind], active: kind })),
  close: (kind) => set((state) => {
    if (kind === "overview") return state;
    const index = state.tabs.indexOf(kind);
    const tabs = state.tabs.filter((tab) => tab !== kind);
    return { tabs, active: state.active === kind ? tabs[Math.max(0, index - 1)] : state.active };
  }),
  toggleFocus: () => set((state) => ({ focus: !state.focus })),
}), {
  name: "gi-workspace-v2",
  skipHydration: true,
  partialize: (state) => ({ tabs: state.tabs, active: state.active, focus: state.focus }),
  merge: (persisted, current) => {
    if (!persisted || typeof persisted !== "object") return current;
    const saved = persisted as Partial<WorkspaceState>;
    const tabs = Array.isArray(saved.tabs) ? [...new Set<WidgetKind>(["overview", ...saved.tabs.filter((kind) => widgetKinds.includes(kind))])] : defaults;
    return { ...current, tabs, active: saved.active && tabs.includes(saved.active) ? saved.active : "overview", focus: saved.focus === true };
  },
}));
