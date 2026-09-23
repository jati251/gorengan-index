import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "../types";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

function getInitialLocale(): Locale {
  if (typeof document !== "undefined") {
    // Check cookie first
    const cookieMatch = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]*)/);
    if (cookieMatch && (cookieMatch[1] === "id" || cookieMatch[1] === "en")) {
      return cookieMatch[1] as Locale;
    }
  }
  return "en";
}

function persistCookie(locale: Locale) {
  if (typeof document !== "undefined") {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: getInitialLocale(),
      setLocale: (locale: Locale) => {
        persistCookie(locale);
        set({ locale });
      },
    }),
    {
      name: "gorengan-locale",
      onRehydrateStorage: () => (state) => {
        if (state?.locale) {
          persistCookie(state.locale);
        }
      },
    }
  )
);
