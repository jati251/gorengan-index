export const ENV = {
  // Rust Axum Realtime Gateway REST endpoint
  API_BASE_URL:
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:9001/v1")
      : (process.env.MARKET_GATEWAY_INTERNAL_URL || "http://127.0.0.1:9001/v1"),

  // Rust Axum WebSocket stream endpoint
  WS_URL:
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_WS_URL ||
        `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
          window.location.hostname
        }:9001/v1/stream`)
      : "ws://127.0.0.1:9001/v1/stream",
};
