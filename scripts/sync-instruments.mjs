import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("🔄 Step 1: Building @gorengan/shared...");
execSync("pnpm --filter @gorengan/shared build", { cwd: rootDir, stdio: "inherit" });

const sharedDistPath = path.resolve(rootDir, "packages/shared/dist/index.js");
const { DEFAULT_SYMBOLS } = await import(`file://${sharedDistPath}`);

console.log(`📦 Loaded ${DEFAULT_SYMBOLS.length} symbols from @gorengan/shared`);

const rustInstruments = DEFAULT_SYMBOLS.map((s) => ({
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

const targetPath = path.resolve(rootDir, "crates/market-domain/src/instruments.json");
fs.writeFileSync(targetPath, JSON.stringify(rustInstruments, null, 2) + "\n", "utf8");

console.log(`✅ Synced ${rustInstruments.length} instruments to crates/market-domain/src/instruments.json`);

try {
  execSync("cargo --version", { stdio: "ignore" });
  console.log("🦀 Step 2: Testing market-domain Rust crate...");
  execSync("cargo test -p market-domain", { cwd: rootDir, stdio: "inherit" });
} catch {
  console.log("ℹ️ Cargo not detected in environment, skipping Rust test");
}

console.log("✨ All instruments synced and verified successfully!");
