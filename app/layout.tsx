import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://gorengan-index.cekcok.my.id'),
  title: {
    default: "Gorengan Index | Live Indonesian PPP & Inflation Terminal",
    template: "%s | Gorengan Index",
  },
  description: "Terminal finansial rahasia yang melacak inflasi riil, Purchasing Power Parity (PPP), dan kekuatan ekonomi lokal Indonesia menggunakan standar harga Gorengan (Bakwan, Tahu, Tempe).",
  keywords: ["Gorengan Index", "Inflasi Indonesia", "Purchasing Power Parity", "Ekonomi Makro", "Harga Bakwan", "UMP Jakarta", "Investasi", "Terminal Keuangan", "Data Pasar Tradisional"],
  authors: [{ name: "Cekcok Lab" }],
  creator: "Cekcok Lab",
  publisher: "Cekcok Lab",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Gorengan Index | Terminal Pemantau Ekonomi Lokal",
    description: "Lacak inflasi sejati dan daya beli masyarakat Indonesia (PPP) bukan lewat Dolar atau Emas, tapi lewat harga sepotong Bakwan.",
    url: "https://gorengan-index.cekcok.my.id",
    siteName: "Gorengan Index",
    images: [
      {
        url: "/icon.png", // Will use our newly generated icon
        width: 1024,
        height: 1024,
        alt: "Gorengan Index Terminal Logo",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gorengan Index 📊 | Mengukur Ekonomi Lewat Bakwan",
    description: "Terminal rahasia pemantau inflasi dan Purchasing Power Parity di Indonesia.",
    images: ["/icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Gorengan Index",
              url: "https://gorengan-index.cekcok.my.id/",
              description: "Terminal finansial rahasia yang melacak inflasi riil, Purchasing Power Parity (PPP), dan kekuatan ekonomi lokal Indonesia menggunakan standar harga Gorengan (Bakwan, Tahu, Tempe).",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://gorengan-index.cekcok.my.id/?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      </body>
    </html>
  );
}
