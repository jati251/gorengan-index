import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Gorengan Terminal — Realtime Investment Dashboard",
  description:
    "Self-hosted personal market dashboard terminal with direct venue ingestion, real-time candlestick charts, and in-memory ticker streams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#070a12] text-slate-200 antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
