import type React from "react";

export interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: "emerald" | "rose" | "cyan" | "amber" | "slate";
  subtext?: string;
}
