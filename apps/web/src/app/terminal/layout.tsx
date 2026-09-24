import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./terminal.css";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "id" ? "id" : "en";

  if (locale === "id") {
    return {
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
  }

  return {
    title: "Live Trading Terminal & Market Screener",
    description:
      "Open Gorengan Index institutional terminal. Live TradingView candlestick charts, high-volatility IDX stock screener, real-time crypto order flow, and forex quotes.",
    keywords: [
      "trading terminal",
      "stock screener",
      "crypto live terminal",
      "tradingview realtime",
      "forex quotes",
      "financial market board",
    ],
    alternates: {
      canonical: "/terminal",
    },
    openGraph: {
      title: "Live Trading Terminal & Market Screener | Gorengan Index",
      description:
        "Real-time multi-asset financial terminal for volatile IDX stocks, cryptocurrencies, and forex with interactive TradingView charts.",
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
      title: "Live Trading Terminal & Market Screener | Gorengan Index",
      description:
        "Real-time multi-asset financial terminal for volatile IDX stocks, cryptocurrencies, and forex with interactive TradingView charts.",
      images: ["/og-image.png"],
    },
  };
}

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
