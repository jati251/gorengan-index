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

const pgConnectionString = process.env.DATABASE_URL;

const args = process.argv.slice(2);

// 1. Template Generator
if (args.includes("--template") || args.includes("-t")) {
  const templatePath = path.resolve(rootDir, "symbols-template.json");
  const sample = [
    {
      id: "TON-USDT",
      base: "TON",
      quote: "USDT",
      assetClass: "crypto",
      name: "Toncoin",
      provider: "binance",
      providerSymbol: "TONUSDT",
      displayDecimals: 4,
    },
    {
      id: "ID:GOTO",
      base: "GOTO",
      quote: "IDR",
      assetClass: "idx_stocks",
      name: "GoTo Gojek Tokopedia Tbk",
      provider: "idx_delayed",
      providerSymbol: "GOTO.JK",
      exchange: "IDX",
      country: "ID",
      timezone: "Asia/Jakarta",
      displayDecimals: 0,
    },
    {
      id: "US:PLTR",
      base: "PLTR",
      quote: "USD",
      assetClass: "us_stocks",
      name: "Palantir Technologies Inc.",
      provider: "alpaca_iex",
      providerSymbol: "PLTR",
      exchange: "NYSE",
      country: "US",
      timezone: "America/New_York",
      displayDecimals: 2,
    },
  ];
  fs.writeFileSync(templatePath, JSON.stringify(sample, null, 2) + "\n", "utf8");
  console.log(`📄 Template created at: ${templatePath}`);
  console.log(`💡 Edit the file and run: pnpm symbols:add symbols-template.json --sync`);
  process.exit(0);
}

// 2. Resolve input file
let inputPath = args.find((a) => !a.startsWith("-"));
const shouldSync = args.includes("--sync") || args.includes("-s");

if (!inputPath) {
  // Look for default file
  const defaultFile = path.resolve(rootDir, "symbols-to-add.json");
  if (fs.existsSync(defaultFile)) {
    inputPath = defaultFile;
  } else {
    console.error("❌ Error: No JSON file provided.");
    console.log("\nUsage:");
    console.log("  node scripts/bulk-add-symbols.mjs <path-to-symbols.json> [--sync]");
    console.log("  pnpm symbols:add <path-to-symbols.json> [--sync]");
    console.log("  pnpm symbols:add --template   (generates sample JSON template)\n");
    process.exit(1);
  }
}

const resolvedPath = path.resolve(process.cwd(), inputPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`❌ Error: File not found at ${resolvedPath}`);
  process.exit(1);
}

let rawData;
try {
  rawData = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
} catch (err) {
  console.error(`❌ Error parsing JSON file: ${err.message}`);
  process.exit(1);
}

const items = Array.isArray(rawData) ? rawData : [rawData];
if (items.length === 0) {
  console.log("⚠️ No symbols found in JSON array.");
  process.exit(0);
}

// Helper to auto-fill smart defaults
function normalizeSymbol(s) {
  const assetClass = (s.assetClass || s.asset_class || "crypto").toLowerCase();
  const id = s.id || `${s.base}-${s.quote}`;
  const base = s.base || id.split(/[-:]/)[0];
  const quote = s.quote || id.split(/[-:]/)[1] || (assetClass === "idx_stocks" ? "IDR" : "USD");

  let defaultProvider = "binance";
  let defaultDecimals = 2;
  let defaultBasis = "trade";
  let exchange = s.exchange ?? null;
  let country = s.country ?? null;
  let timezone = s.timezone ?? null;

  if (assetClass === "fx") {
    defaultProvider = "interbank";
    defaultDecimals = id.includes("JPY") ? 3 : 5;
    defaultBasis = "mid";
  } else if (assetClass === "idx_stocks") {
    defaultProvider = "idx_delayed";
    defaultDecimals = 0;
    exchange = exchange || "IDX";
    country = country || "ID";
    timezone = timezone || "Asia/Jakarta";
  } else if (assetClass === "us_stocks") {
    defaultProvider = "alpaca_iex";
    defaultDecimals = 2;
    exchange = exchange || "NASDAQ";
    country = country || "US";
    timezone = timezone || "America/New_York";
  }

  return {
    id,
    base,
    quote,
    assetClass,
    provider: s.provider || defaultProvider,
    providerSymbol: s.providerSymbol || s.provider_symbol || (assetClass === "idx_stocks" ? `${base}.JK` : base),
    name: s.name || id,
    enabled: s.enabled !== false,
    isTokenizedMetal: s.isTokenizedMetal ?? s.is_tokenized_metal ?? false,
    pipSize: s.pipSize ?? s.pip_size ?? null,
    displayDecimals: s.displayDecimals ?? s.display_decimals ?? defaultDecimals,
    candlePriceBasis: s.candlePriceBasis ?? s.candle_price_basis ?? defaultBasis,
    exchange,
    country,
    timezone,
  };
}

if (!pgConnectionString) {
  console.error("❌ Error: DATABASE_URL is not set in environment or .env file.");
  process.exit(1);
}

const normalized = items.map(normalizeSymbol);

console.log(`🐘 Connecting to PostgreSQL at ${pgConnectionString.replace(/:[^:]*@/, ":****@")}...`);
const client = new pg.Client({ connectionString: pgConnectionString });
await client.connect();

try {
  await client.query("BEGIN;");
  let upserted = 0;
  for (const s of normalized) {
    const query = `
      INSERT INTO market_symbols (
        id, base, quote, asset_class, provider, provider_symbol, name, enabled,
        is_tokenized_metal, pip_size, display_decimals, candle_price_basis, exchange, country, timezone, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      ON CONFLICT (id) DO UPDATE SET
        base = EXCLUDED.base,
        quote = EXCLUDED.quote,
        asset_class = EXCLUDED.asset_class,
        provider = EXCLUDED.provider,
        provider_symbol = EXCLUDED.provider_symbol,
        name = EXCLUDED.name,
        enabled = EXCLUDED.enabled,
        is_tokenized_metal = EXCLUDED.is_tokenized_metal,
        pip_size = EXCLUDED.pip_size,
        display_decimals = EXCLUDED.display_decimals,
        candle_price_basis = EXCLUDED.candle_price_basis,
        exchange = EXCLUDED.exchange,
        country = EXCLUDED.country,
        timezone = EXCLUDED.timezone,
        updated_at = NOW();
    `;
    await client.query(query, [
      s.id,
      s.base,
      s.quote,
      s.assetClass,
      s.provider,
      s.providerSymbol,
      s.name,
      s.enabled,
      s.isTokenizedMetal,
      s.pipSize,
      s.displayDecimals,
      s.candlePriceBasis,
      s.exchange,
      s.country,
      s.timezone,
    ]);
    upserted++;
  }
  await client.query("COMMIT;");

  console.log(`✅ Successfully upserted ${upserted} symbol(s) into market_symbols table!`);

  const countRes = await client.query("SELECT COUNT(*) FROM market_symbols");
  console.log(`📊 Total symbols now in PostgreSQL: ${countRes.rows[0].count}`);
} catch (err) {
  await client.query("ROLLBACK;");
  console.error(`❌ Transaction failed: ${err.message}`);
  throw err;
} finally {
  await client.end();
}

// 3. Optional auto-sync
if (shouldSync) {
  console.log("\n🔄 Auto-syncing to Rust instruments.json...");
  execSync("pnpm sync:instruments", { cwd: rootDir, stdio: "inherit" });
} else {
  console.log("\n💡 Tip: Run 'pnpm sync:instruments' (or pass --sync) to update Rust instruments.json");
}
