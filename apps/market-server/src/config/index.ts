import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: "../../.env" });

const configSchema = z.object({
  PORT: z.coerce.number().default(9000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().optional(),
  QUESTDB_HTTP_URL: z.string().default("http://127.0.0.1:9000"),
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
};

export type Config = typeof config;
