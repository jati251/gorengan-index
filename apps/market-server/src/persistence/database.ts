import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { DEFAULT_SYMBOLS } from "@gorengan/shared";

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(config.SQLITE_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  logger.info({ path: config.SQLITE_PATH }, "Opening SQLite database");
  const db = new DatabaseSync(config.SQLITE_PATH);

  // Performance pragmas from architecture specification
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA temp_store = MEMORY;");
  db.exec("PRAGMA foreign_keys = ON;");

  initSchema(db);

  dbInstance = db;
  return db;
}

function initSchema(db: DatabaseSync): void {
  logger.info("Initializing SQLite schemas and indexes");

  db.exec(`
    CREATE TABLE IF NOT EXISTS symbols (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      provider_symbol TEXT NOT NULL,
      base_asset TEXT NOT NULL,
      quote_asset TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      is_tokenized_metal INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candles (
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      open_time INTEGER NOT NULL,
      close_time INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      trades INTEGER,
      provider TEXT NOT NULL,
      PRIMARY KEY (symbol, timeframe, open_time)
    );

    CREATE INDEX IF NOT EXISTS idx_candles_lookup
    ON candles(symbol, timeframe, open_time DESC);
  `);

  // Seed default symbols if empty
  const countRow = db.prepare("SELECT COUNT(*) as count FROM symbols").get() as {
    count: number | bigint;
  };

  const currentCount = Number(countRow?.count || 0);
  if (currentCount === 0) {
    logger.info("Seeding default market symbols into database");
    const now = Date.now();
    const insertStmt = db.prepare(`
      INSERT INTO symbols (
        id, provider, provider_symbol, base_asset, quote_asset,
        asset_class, name, enabled, is_tokenized_metal, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const sym of DEFAULT_SYMBOLS) {
      insertStmt.run(
        sym.id,
        sym.provider,
        sym.providerSymbol,
        sym.base,
        sym.quote,
        sym.assetClass,
        sym.name,
        sym.enabled ? 1 : 0,
        sym.isTokenizedMetal ? 1 : 0,
        now,
        now
      );
    }
  }
}

export function closeDatabase(): void {
  if (dbInstance) {
    logger.info("Closing SQLite database connection");
    dbInstance.close();
    dbInstance = null;
  }
}
