import type { Metadata, Viewport } from "next";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import "./globals.css";
import { Providers } from "./providers";
import PwaRegister from "@/components/PwaRegister";

const BASE_URL = "https://gorengan-index.cekcok.my.id";

export const viewport: Viewport = {
  themeColor: "#2a2839",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Gorengan Index | Screener Saham IDX, Crypto & FX Real-Time Terminal",
    template: "%s | Gorengan Index",
  },
  description:
    "Pantau saham gorengan IDX, crypto, forex, dan US stocks secara real-time tanpa delay. Live TradingView candlestick chart, market screener, orderbook intelligence, dan sentimen pasar terlengkap di Indonesia.",
  applicationName: "Gorengan Index",
  category: "Finance",
  classification: "Financial Markets, Stock Screener & Trading Tools",
  authors: [{ name: "Gorengan Index Team", url: BASE_URL }],
  creator: "Gorengan Index",
  publisher: "Gorengan Index",
  keywords: [
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
    locale: "id_ID",
    alternateLocale: ["en_US"],
    url: BASE_URL,
    siteName: "Gorengan Index",
    title: "Gorengan Index | Screener Saham IDX, Crypto & FX Real-Time",
    description:
      "Platform screener & terminal trading real-time untuk saham gorengan IDX, crypto, forex, dan US stocks. Dilengkapi candlestick TradingView & live orderbook.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Gorengan Index - Real-Time Screener Saham & Crypto",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gorengan Index | Screener Saham IDX, Crypto & FX Real-Time",
    description:
      "Pantau saham gorengan IDX, crypto, dan forex secara live tanpa delay. Dilengkapi chart TradingView interaktif & retro terminal.",
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

const jsonLdSoftwareApp = {
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
    "Terminal keuangan real-time untuk memantau pergerakan harga saham IDX, crypto, dan forex secara live dengan chart TradingView.",
  featureList: [
    "Streaming pasar real-time via WebSocket",
    "Interactive TradingView candlestick charts",
    "Screener saham volatil & saham gorengan IDX",
    "Pantauan harga Crypto & Forex live",
    "Watchlist multi-aset tersinkronisasi",
    "PWA Installable di Android & iOS",
  ],
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

const jsonLdFaq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${BASE_URL}/#faq`,
  mainEntity: [
    {
      "@type": "Question",
      name: "Apa itu Gorengan Index?",
      acceptedAnswer: {
        "@type": "Answer",
        "text":
          "Gorengan Index adalah platform screener dan terminal pasar finansial real-time yang dirancang khusus untuk memantau pergerakan saham-saham aktif & volatil di Bursa Efek Indonesia (IDX/IHSG), aset kripto global (Bitcoin, Ethereum, Solana), serta pasangan mata uang forex dalam satu antarmuka retro arcade berkecepatan tinggi.",
      },
    },
    {
      "@type": "Question",
      name: "Apa yang dimaksud dengan saham gorengan dan bagaimana cara screening di Gorengan Index?",
      acceptedAnswer: {
        "@type": "Answer",
        "text":
          "Saham gorengan adalah istilah pasar modal Indonesia untuk saham lapis dua atau tiga (small/mid cap) dengan volatilitas dan volume transaksi tinggi. Gorengan Index memantau lonjakan volume harian, perubahan persentase harga 24 jam, dan orderbook live untuk mempermudah trader dan scalper mendeteksi momentum pasar.",
      },
    },
    {
      "@type": "Question",
      name: "Apakah data harga di Gorengan Index disajikan secara real-time?",
      acceptedAnswer: {
        "@type": "Answer",
        "text":
          "Ya, data harga dialirkan secara langsung menggunakan WebSocket berkecepatan tinggi. Mode publik memperbarui kuotasi pasar setiap 5 detik, dan pengguna terdaftar menikmati streaming live tanpa jeda.",
      },
    },
    {
      "@type": "Question",
      name: "Instrumen finansial apa saja yang didukung oleh Gorengan Index?",
      acceptedAnswer: {
        "@type": "Answer",
        "text":
          "Gorengan Index mendukung Saham Bursa Efek Indonesia (IDX), Aset Kripto (Cryptocurrency seperti BTC, ETH, SOL), Valuta Asing (Forex seperti USD/IDR, EUR/USD), serta Saham Global Amerika (US Equities).",
      },
    },
    {
      "@type": "Question",
      name: "Apakah platform Gorengan Index gratis digunakan?",
      acceptedAnswer: {
        "@type": "Answer",
        "text":
          "Ya, Gorengan Index 100% gratis digunakan untuk riset pasar dan pemantauan harga harian.",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdSoftwareApp),
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
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
