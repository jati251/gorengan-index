"use client";

import { useState, useEffect } from "react";
import { DashboardData } from "@/types";

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeOffset, setTimeOffset] = useState(0);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/gorengan-engine");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `HTTP error ${res.status}`);
      }

      if (!json.regions) {
        throw new Error("Invalid data structure received from API");
      }

      setData(json);
      setError(null);

      // Calc time offset once
      if (json.timestamp && timeOffset === 0) {
        const apiTime = new Date(json.timestamp).getTime();
        const localTime = Date.now();
        setTimeOffset(apiTime - localTime);
      }
    } catch (e: any) {
      console.error("Failed to fetch dashboard data", e);
      setError(e.message || "Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error, timeOffset };
}
