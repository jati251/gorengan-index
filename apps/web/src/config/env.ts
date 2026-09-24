export const ENV = {
  // Realtime Market Backend REST endpoint
  get API_BASE_URL(): string {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    if (typeof window !== "undefined") {
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      return isLocalhost ? "http://localhost:9001/v1" : "/v1";
    }
    return process.env.MARKET_GATEWAY_INTERNAL_URL || "http://127.0.0.1:9001/v1";
  },

  // Realtime Market Backend WebSocket stream endpoint
  get WS_URL(): string {
    const configured = process.env.NEXT_PUBLIC_WS_URL;
    if (configured && (configured.startsWith("ws://") || configured.startsWith("wss://"))) {
      return configured;
    }
    if (typeof window !== "undefined") {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      if (configured && configured.startsWith("/")) {
        return `${proto}//${window.location.host}${configured}`;
      }
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      if (isLocalhost) {
        return "ws://localhost:9001/v1/stream";
      }
      return `${proto}//${window.location.host}/v1/stream`;
    }
    return "ws://127.0.0.1:9001/v1/stream";
  },
};

