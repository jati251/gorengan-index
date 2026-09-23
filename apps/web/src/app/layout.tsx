import type { Metadata } from "next";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Gorengan Index | Markets and charts",
  description:
    "Watch prices, charts, and market news in one workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#2a2839] text-slate-200 antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
