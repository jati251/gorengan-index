import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@gorengan/shared"],
  async rewrites() {
    const marketServerUrl = process.env.MARKET_SERVER_INTERNAL_URL || "http://localhost:9000";
    return [
      {
        source: "/api/terminal/:path*",
        destination: `${marketServerUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
