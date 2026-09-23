import type { Metadata, Viewport } from "next";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import "./globals.css";
import { Providers } from "./providers";
import PwaRegister from "@/components/PwaRegister";

export const viewport: Viewport = {
  themeColor: "#2a2839",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Gorengan Index | Markets and charts",
  description:
    "Watch prices, charts, and market news in one workspace.",
  applicationName: "Gorengan Index",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#2a2839] text-slate-200 antialiased min-h-screen">
        <Providers>
          <PwaRegister />
          {children}
        </Providers>
      </body>
    </html>
  );
}

