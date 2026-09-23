import { useCallback } from "react";
import { useLocaleStore } from "../stores/localeStore";
import { id } from "../locales/id";
import { en } from "../locales/en";
import type { Locale, TranslationSchema } from "../types";

const dictionaries: Record<Locale, TranslationSchema> = {
  id,
  en,
};

export function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (str, [key, val]) => str.replaceAll(`{${key}}`, String(val)),
    template
  );
}

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const dict = dictionaries[locale] || en;

  const t = useCallback(
    (
      selector: (d: TranslationSchema) => string,
      params?: Record<string, string | number>
    ): string => {
      const raw = selector(dict);
      return interpolate(raw, params);
    },
    [dict]
  );

  return {
    locale,
    setLocale,
    dict,
    t,
    interpolate,
  };
}
