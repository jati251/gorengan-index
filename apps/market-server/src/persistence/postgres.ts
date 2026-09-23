import pg from "pg";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

export function getPostgresPool(): pg.Pool | null {
  if (!config.DATABASE_URL) {
    return null;
  }

  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: config.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on("error", (err) => {
      logger.error({ err: err.message }, "Unexpected idle PostgreSQL client error");
    });
  }

  return poolInstance;
}

export async function closePostgres(): Promise<void> {
  if (poolInstance) {
    logger.info("Closing PostgreSQL connection pool");
    await poolInstance.end();
    poolInstance = null;
  }
}
