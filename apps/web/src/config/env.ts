export const ENV = {
  // REST API endpoint (Next.js rewrite proxies /api/terminal to market server)
  get API_BASE_URL(): string {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    if (typeof window !== "undefined") {
      return "/api/terminal";
    }
    return (
      process.env.MARKET_SERVER_INTERNAL_URL
        ? `${process.env.MARKET_SERVER_INTERNAL_URL}/api`
        : process.env.MARKET_GATEWAY_INTERNAL_URL || "http://127.0.0.1:9000/api"
    );
  },

  // WebSocket stream endpoint (market-server WS gateway at /ws)
  get WS_URL(): string {
    if (process.env.NEXT_PUBLIC_WS_URL) {
      return process.env.NEXT_PUBLIC_WS_URL;
    }
    if (typeof window !== "undefined") {
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      if (isLocalhost) {
        return "ws://localhost:9000/ws";
      }
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${window.location.host}/ws`;
    }
    return process.env.MARKET_WS_INTERNAL_URL || "ws://127.0.0.1:9000/ws";
  },
};

