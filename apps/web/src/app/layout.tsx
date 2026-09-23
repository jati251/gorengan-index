import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import "./globals.css";
import { Providers } from "./providers";
import PwaRegister from "@/components/PwaRegister";
import { dictEn, dictId } from "@/features/i18n";

const BASE_URL = "https://gorengan-index.cekcok.my.id";

export const viewport: Viewport = {
  themeColor: "#2a2839",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "id" ? "id" : "en";

  const isId = locale === "id";

  const titleDefault = isId
    ? "Gorengan Index | Screener Saham IDX, Crypto & FX Real-Time Terminal"
    : "Gorengan Index | Real-Time IDX Stock, Crypto & FX Screener Terminal";

  const description = isId
    ? "Pantau saham gorengan IDX, crypto, forex, dan US stocks secara real-time tanpa delay. Live TradingView candlestick chart, market screener, orderbook intelligence, dan sentimen pasar terlengkap di Indonesia."
    : "Track volatile IDX stocks, crypto, forex, and US stocks in real-time without delay. Live TradingView candlestick charts, screener, and market sentiment.";

  const ogTitle = isId
    ? "Gorengan Index | Screener Saham IDX, Crypto & FX Real-Time"
    : "Gorengan Index | Real-Time IDX Stock, Crypto & FX Screener";

  const ogDesc = isId
    ? "Platform screener & terminal trading real-time untuk saham gorengan IDX, crypto, forex, dan US stocks. Dilengkapi candlestick TradingView & live orderbook."
    : "Real-time screener & trading terminal for volatile IDX stocks, crypto, forex, and US stocks. Powered by TradingView candlesticks & live order flow.";

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      default: titleDefault,
      template: "%s | Gorengan Index",
    },
    description,
    applicationName: "Gorengan Index",
    category: "Finance",
    classification: "Financial Markets, Stock Screener & Trading Tools",
    authors: [{ name: "Gorengan Index Team", url: BASE_URL }],
    creator: "Gorengan Index",
    publisher: "Gorengan Index",
    keywords: isId
      ? [
          "saham gorengan",
          "indeks saham gorengan",
          "gorengan index",
          "screener saham idx",
          "saham idx hari ini",
          "pantau saham real time",
          "ihsg live",
          "tradingview saham indonesia",
          "chart crypto indonesia",
          "saham bursa efek indonesia",
          "saham scalping indonesia",
          "bandarmologi saham",
          "orderbook saham live",
          "terminal trading indonesia",
          "crypto screener indonesia",
          "forex real time ticker",
          "bitcoin live chart idr",
          "us stocks indonesia",
          "aplikasi pantau saham gratis",
          "indonesian stock market screener",
          "real time financial terminal",
        ]
      : [
          "gorengan index",
          "indonesian stock screener",
          "idx stocks realtime",
          "ihsg live quotes",
          "tradingview indonesia",
          "crypto screener",
          "forex realtime ticker",
          "volatile stocks screener",
          "scalping screener",
          "live orderbook",
          "trading terminal",
          "us stocks",
        ],
    alternates: {
      canonical: "/",
      languages: {
        "id-ID": BASE_URL,
        "en-US": BASE_URL,
      },
    },
    openGraph: {
      type: "website",
      locale: isId ? "id_ID" : "en_US",
      alternateLocale: isId ? ["en_US"] : ["id_ID"],
      url: BASE_URL,
      siteName: "Gorengan Index",
      title: ogTitle,
      description: ogDesc,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "Gorengan Index",
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDesc,
      images: ["/og-image.png"],
      creator: "@gorenganindex",
      site: "@gorenganindex",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Gorengan Index",
    },
    icons: {
      icon: [
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
  };
}

const jsonLdWebsite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${BASE_URL}/#website`,
  name: "Gorengan Index",
  alternateName: [
    "GorenganIndex",
    "GOR Index",
    "Indeks Saham Gorengan",
    "Screener Saham Gorengan IDX",
  ],
  url: BASE_URL,
  description:
    "Platform screener & terminal pasar finansial real-time untuk memantau saham gorengan IDX, crypto, forex, dan US stocks.",
  inLanguage: ["id-ID", "en-US"],
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/terminal?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${BASE_URL}/#organization`,
  name: "Gorengan Index",
  url: BASE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${BASE_URL}/icon-512.png`,
    width: 512,
    height: 512,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = localeCookie === "id" ? "id" : "en";
  const dict = locale === "id" ? dictId : dictEn;
  const dynamicJsonLdSoftwareApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${BASE_URL}/#webapp`,
    name: "Gorengan Index Terminal",
    url: `${BASE_URL}/terminal`,
    applicationCategory: "FinanceApplication",
    operatingSystem: "All (Web, iOS, Android, macOS, Windows, Linux)",
    browserRequirements: "Requires JavaScript. Requires HTML5.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    description:
      locale === "id"
        ? "Terminal keuangan real-time untuk memantau pergerakan harga saham IDX, crypto, dan forex secara live dengan chart TradingView."
        : "Real-time financial market terminal tracking volatile IDX stocks, crypto, and forex with live TradingView candlestick charts.",
    featureList:
      locale === "id"
        ? [
            "Streaming pasar real-time via WebSocket",
            "Interactive TradingView candlestick charts",
            "Screener saham volatil & saham gorengan IDX",
            "Pantauan harga Crypto & Forex live",
            "Watchlist multi-aset tersinkronisasi",
            "PWA Installable di Android & iOS",
          ]
        : [
            "Real-time WebSocket market streaming",
            "Interactive TradingView candlestick charts",
            "Volatile IDX stock & equity screener",
            "Live Crypto & Forex quotes",
            "Synchronized multi-asset watchlist",
            "Installable PWA for Android & iOS",
          ],
  };

  const dynamicJsonLdFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${BASE_URL}/#faq`,
    mainEntity: dict.landing.faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <html lang={locale} className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(dynamicJsonLdSoftwareApp),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdOrganization),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dynamicJsonLdFaq) }}
        />
      </head>
      <body className="bg-[#2a2839] text-slate-200 antialiased min-h-screen">
        <Providers>
          <PwaRegister />
          {children}
        </Providers>
      </body>
    </html>
  );
}
