export const ENV = {
  // Use relative proxy path in browser or explicit API URL
  API_BASE_URL:
    typeof window !== "undefined"
      ? "/api/terminal"
      : process.env.MARKET_SERVER_INTERNAL_URL || "http://localhost:9000/api",
  WS_URL:
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_WS_URL ||
        `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
          window.location.hostname
        }:9000/ws`)
      : "ws://localhost:9000/ws",
};
