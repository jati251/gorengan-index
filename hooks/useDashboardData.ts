"use client";

import { useState, useEffect } from "react";
import { DashboardData } from "@/types";

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeOffset, setTimeOffset] = useState(0);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/gorengan-engine");
      const json = await res.json();
      setData(json);

      // Calc time offset once
      if (json.timestamp && timeOffset === 0) {
        const apiTime = new Date(json.timestamp).getTime();
        const localTime = Date.now();
        setTimeOffset(apiTime - localTime);
      }
    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, timeOffset };
}
