import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { DEFAULT_SYMBOLS, type MarketSymbol } from "@gorengan/shared";

export interface QuestDbExecResponse<T = unknown[]> {
  query: string;
  columns?: { name: string; type: string }[];
  dataset?: T[];
  count?: number;
  error?: string;
}

export class QuestDbClient {
  private baseUrl: string;
  private isConnected = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async init(): Promise<void> {
    logger.info({ questdbUrl: this.baseUrl }, "Connecting to QuestDB");
    try {
      const res = await fetch(`${this.baseUrl}/exec?query=SELECT+1`);
      if (res.ok) {
        this.isConnected = true;
        logger.info("Connected to QuestDB successfully");
      } else {
        logger.warn({ status: res.status }, "QuestDB /exec returned non-200, continuing with in-memory fallback");
      }
    } catch (err) {
      logger.warn({ err }, "Could not reach QuestDB directly, in-memory caching will operate");
    }

    // Attempt to ensure tables exist in QuestDB if writable
    try {
      await this.query(`
        CREATE TABLE IF NOT EXISTS candles_1m (
          instrument SYMBOL,
          provider SYMBOL,
          open DOUBLE,
          high DOUBLE,
          low DOUBLE,
          close DOUBLE,
          volume DOUBLE,
          trade_count LONG,
          timestamp TIMESTAMP
        ) timestamp(timestamp) PARTITION BY DAY WAL;
      `);
    } catch {
      // Table may already exist or QuestDB is currently connecting
    }
  }

  public async query<T = unknown[]>(sql: string): Promise<QuestDbExecResponse<T>> {
    const url = `${this.baseUrl}/exec?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`QuestDB query failed (${res.status}): ${errText}`);
    }
    return (await res.json()) as QuestDbExecResponse<T>;
  }

  public async writeIlp(lines: string[]): Promise<void> {
    if (lines.length === 0) return;
    const body = lines.join("\n") + "\n";
    const res = await fetch(`${this.baseUrl}/write`, {
      method: "POST",
      body,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`QuestDB write failed (${res.status}): ${errText}`);
    }
  }

  public close(): void {
    logger.info("QuestDB client closed");
    this.isConnected = false;
  }
}

let dbInstance: QuestDbClient | null = null;

export function getDatabase(): QuestDbClient {
  if (!dbInstance) {
    dbInstance = new QuestDbClient(config.QUESTDB_HTTP_URL);
    // Fire and forget background initialization
    dbInstance.init().catch((err) => {
      logger.warn({ err }, "QuestDB background initialization notice");
    });
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
