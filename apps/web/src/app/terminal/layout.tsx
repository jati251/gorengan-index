import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terminal Trading & Screener Saham IDX Live",
  description:
    "Buka terminal trading Gorengan Index. Live candlestick chart TradingView, filter saham IDX paling volatil & aktif, pantau order flow kripto dan forex secara real-time tanpa delay.",
  keywords: [
    "terminal saham",
    "screener saham idx",
    "live trading terminal",
    "tradingview saham indonesia",
    "saham gorengan hari ini",
    "chart btc idr",
    "forex live quotes",
    "pantau portofolio saham",
  ],
  alternates: {
    canonical: "/terminal",
  },
  openGraph: {
    title: "Terminal Trading & Screener Saham IDX Live | Gorengan Index",
    description:
      "Buka terminal trading Gorengan Index. Live candlestick chart TradingView, screener saham IDX, crypto & forex real-time.",
    url: "https://gorengan-index.cekcok.my.id/terminal",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Gorengan Index Live Trading Terminal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terminal Trading & Screener Saham IDX Live | Gorengan Index",
    description:
      "Terminal trading multi-aset real-time untuk saham gorengan IDX, crypto, dan forex dengan chart TradingView interaktif.",
    images: ["/og-image.png"],
  },
};

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
