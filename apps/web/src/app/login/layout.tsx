import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masuk ke Akun Trading Workspace",
  description:
    "Masuk ke akun Gorengan Index Anda untuk menyimpan watchlist pribadi saham IDX & kripto, mengatur alert, serta menikmati streaming pasar berkecepatan tinggi tanpa batasan kuota.",
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    title: "Masuk ke Gorengan Index Trading Workspace",
    description:
      "Akses watchlist pribadi, pantau saham gorengan IDX, crypto, dan forex secara personal.",
    url: "https://gorengan-index.cekcok.my.id/login",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Gorengan Index Login Portal",
      },
    ],
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
