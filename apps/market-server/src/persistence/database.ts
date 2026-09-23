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

  // Sync all default symbols into database (upsert to ensure all instruments exist)
  logger.info({ totalSymbols: DEFAULT_SYMBOLS.length }, "Syncing market symbols into database");
  const now = Date.now();
  const upsertStmt = db.prepare(`
    INSERT INTO symbols (
      id, provider, provider_symbol, base_asset, quote_asset,
      asset_class, name, enabled, is_tokenized_metal, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      provider = excluded.provider,
      provider_symbol = excluded.provider_symbol,
      base_asset = excluded.base_asset,
      quote_asset = excluded.quote_asset,
      asset_class = excluded.asset_class,
      name = excluded.name,
      enabled = excluded.enabled,
      is_tokenized_metal = excluded.is_tokenized_metal,
      updated_at = excluded.updated_at
  `);

  for (const sym of DEFAULT_SYMBOLS) {
    upsertStmt.run(
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

export function closeDatabase(): void {
  if (dbInstance) {
    logger.info("Closing SQLite database connection");
    dbInstance.close();
    dbInstance = null;
  }
}
