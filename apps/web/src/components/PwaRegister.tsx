"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.debug("[PWA] Service worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.debug("[PWA] Service worker registration skipped:", err);
        });
    }
  }, []);

  return null;
}
