import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const configSchema = z.object({
  PORT: z.coerce.number().default(9000),
  HOST: z.string().default("0.0.0.0"),
  SQLITE_PATH: z.string().default("./data/market.sqlite"),
  BINANCE_WS_URL: z.string().default("wss://data-stream.binance.vision:9443"),
  BINANCE_REST_URL: z.string().default("https://data-api.binance.vision"),
  RETENTION_1M_DAYS: z.coerce.number().default(90),
  STALE_THRESHOLD_MS: z.coerce.number().default(15000),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuration validation error:", parsed.error.format());
  process.exit(1);
}

export const config = {
  ...parsed.data,
  SQLITE_PATH: path.resolve(process.cwd(), parsed.data.SQLITE_PATH),
};

export type Config = typeof config;
