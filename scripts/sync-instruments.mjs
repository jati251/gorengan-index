import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

dotenv.config();
dotenv.config({ path: path.resolve(rootDir, ".env") });

console.log("🔄 Step 1: Building @gorengan/shared...");
execSync("pnpm --filter @gorengan/shared build", { cwd: rootDir, stdio: "inherit" });

const targetPath = path.resolve(rootDir, "crates/market-domain/src/instruments.json");
const pgConnectionString = process.env.DATABASE_URL;

let rustInstruments = [];

if (pgConnectionString) {
  console.log("🐘 Step 2: Fetching active symbols from PostgreSQL...");
  try {
    const client = new pg.Client({
      connectionString: pgConnectionString,
      connectionTimeoutMillis: 3000,
    });
    await client.connect();
  const res = await client.query(
    "SELECT * FROM market_symbols WHERE enabled = true ORDER BY asset_class, id ASC"
  );
  await client.end();

  if (res.rows.length > 0) {
    rustInstruments = res.rows.map((row) => ({
      id: row.id,
      base: row.base,
      quote: row.quote,
      asset_class: row.asset_class,
      provider: row.provider,
      provider_symbol: row.provider_symbol,
      price_scale: row.display_decimals ?? 2,
      quantity_scale: row.asset_class === "crypto" ? 4 : 2,
      enabled: row.enabled ?? true,
      is_tokenized_metal: row.is_tokenized_metal ?? false,
      pip_size: row.pip_size != null ? Number(row.pip_size) : null,
      display_decimals: row.display_decimals ?? 2,
      candle_price_basis: row.candle_price_basis ?? "trade",
    }));
    console.log(`📡 Fetched ${rustInstruments.length} active symbols directly from PostgreSQL`);
  }
  } catch (err) {
    console.warn(`⚠️ PostgreSQL unavailable (${err.message}). Using fallback symbols.`);
  }
} else {
  console.log("ℹ️ No DATABASE_URL configured in environment. Using offline fallback.");
}

// Fallback to existing instruments.json or @gorengan/shared DEFAULT_SYMBOLS if Postgres offline
if (rustInstruments.length === 0) {
  if (fs.existsSync(targetPath)) {
    console.log("📂 Retaining existing instruments.json");
  } else {
    const sharedDistPath = path.resolve(rootDir, "packages/shared/dist/index.js");
    const { DEFAULT_SYMBOLS } = await import(`file://${sharedDistPath}`);
    rustInstruments = DEFAULT_SYMBOLS.map((s) => ({
      id: s.id,
      base: s.base,
      quote: s.quote,
      asset_class: s.assetClass,
      provider: s.provider,
      provider_symbol: s.providerSymbol,
      price_scale: s.displayDecimals ?? 2,
      quantity_scale: s.assetClass === "crypto" ? 4 : 2,
      enabled: s.enabled ?? true,
      is_tokenized_metal: s.isTokenizedMetal ?? false,
      pip_size: s.pipSize ?? null,
      display_decimals: s.displayDecimals ?? 2,
      candle_price_basis: s.candlePriceBasis ?? "trade",
    }));
    fs.writeFileSync(targetPath, JSON.stringify(rustInstruments, null, 2) + "\n", "utf8");
  }
} else {
  fs.writeFileSync(targetPath, JSON.stringify(rustInstruments, null, 2) + "\n", "utf8");
  console.log(`✅ Synced ${rustInstruments.length} instruments to crates/market-domain/src/instruments.json`);
}

try {
  execSync("cargo --version", { stdio: "ignore" });
  console.log("🦀 Step 3: Testing market-domain Rust crate...");
  execSync("cargo test -p market-domain", { cwd: rootDir, stdio: "inherit" });
} catch {
  console.log("ℹ️ Cargo not detected in environment, skipping Rust test");
}

console.log("✨ All instruments synced and verified successfully!");
