import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBitcoinTransactions, parseNews, parseYahooQuote, parseIbitHoldings } from "./radarParsers";
import { parseFilings, parseOwnershipXml, csvCell } from "../../features/insider/utils/filings";

test("mempool outputs are deduplicated without inventing exchange identities or USD", () => {
  const tx = { hash: "a".repeat(64), time: 100, fee: 0, inputs: [{ prev_out: { addr: "34xp4fake" } }], out: [{ value: 9e8 }, { value: 1e8 }] };
  const rows = parseBitcoinTransactions(JSON.stringify({ txs: [tx, tx, { ...tx, hash: "b".repeat(64), out: [{ value: -1 }] }] }), 110000);
  assert.equal(rows.length, 1); assert.equal(rows[0].amountBtc, 10); assert.equal(rows[0].amountUsd, null); assert.equal(rows[0].type, "TRANSFER"); assert.equal(rows[0].feeBtc, 0);
  assert.equal(parseBitcoinTransactions(JSON.stringify({ txs: [tx] }), 2 * 86400000).length, 0);
});
test("RSS preserves real dates and URLs; no metrics, neutral headlines or fabricated fallback", () => {
  const xml = '<rss><channel><item><title><![CDATA[Bitcoin regulation update]]></title><link>https://example.com/news</link><pubDate>Thu, 01 Jan 1970 00:01:00 GMT</pubDate></item></channel></rss>';
  const rows = parseNews(xml, "Publisher", 120000);
  assert.equal(rows[0].sentiment, "NEUTRAL"); assert.deepEqual(rows[0].assets, ["BTC"]); assert.equal(rows[0].publishedAt, 60000);
  assert.equal(parseNews(xml.replace('https://example.com/news', 'javascript:alert(1)'), "Publisher", 120000).length, 0);
  for (const headline of ["Unemployment rate rising to 4.2%", "Bitcoin reverses early gains", "Bitcoin could surge tomorrow"]) {
    assert.equal(parseNews(xml.replace("Bitcoin regulation update", headline), "Publisher", 120000)[0].sentiment, "NEUTRAL");
  }
  assert.equal(parseNews(xml.replace("Bitcoin regulation update", "Bitcoin rises above previous close"), "Publisher", 120000)[0].sentiment, "BULLISH");
  assert.throws(() => parseNews("<html>blocked</html>", "Publisher"));
});
test("quote timestamp belongs to the provider and unavailable volume is null", () => {
  const quote = parseYahooQuote(JSON.stringify({ chart: { result: [{ meta: { regularMarketPrice: 100, regularMarketTime: 1000, currency: "USD", chartPreviousClose: 80 } }] } }));
  assert.equal(quote.asOf, 1000000); assert.equal(quote.volume24h, null); assert.equal(quote.changePercent24h, 25);
  const daily = parseYahooQuote(JSON.stringify({ chart: { result: [{ meta: { regularMarketPrice: 110, regularMarketTime: 1000, chartPreviousClose: 80 }, indicators: { quote: [{ close: [80, 90, 100, 110] }] } }] } }));
  assert.ok(Math.abs(daily.changePercent24h! - 10) < 1e-10);
  assert.throws(() => parseYahooQuote('{"chart":{"result":[]}}'));
});
test("issuer CSV parses quoted thousands and rejects a HTML response", () => {
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
  const result = parseIbitHoldings(`iShares Bitcoin Trust ETF\nFund Holdings as of,"${date}"\nTicker,Name,Market Value,Quantity\n"BTC","BITCOIN","1,500.00","12.50"`);
  assert.equal(result.btcHeld, 12.5); assert.equal(result.marketValueUsd, 1500);
  assert.equal(result.asOf, new Date().toISOString().slice(0, 10));
  assert.throws(() => parseIbitHoldings("<html>not a csv</html>"));
});
test("SEC search deduplicates accessions and validates the archive path", () => {
  const hit = { _id: "0000000001-26-000001:form4.xml", _source: { adsh: "0000000001-26-000001", form: "4", ciks: ["0000000001"], display_names: ["Owner", "Issuer"], file_date: "2026-10-01", period_ending: "2026-09-30" } };
  const data = parseFilings(JSON.stringify({ hits: { hits: [hit, hit, { ...hit, _id: "x:../../bad.xml" }], total: { value: 2, relation: "eq" } } }));
  assert.equal(data.filings.length, 1); assert.match(data.filings[0].url, /\/1\/000000000126000001\/form4.xml$/);
  assert.deepEqual(data.filings[0].names, ["Owner", "Issuer"]);
});
test("Form 4 keeps missing price null, grants separate, amendments and plan flag visible", () => {
  const data = parseOwnershipXml('<ownershipDocument><documentType>4/A</documentType><aff10b5One>1</aff10b5One><issuer><issuerCik>1</issuerCik><issuerName>Firm</issuerName><issuerTradingSymbol>TEST</issuerTradingSymbol></issuer><reportingOwner><rptOwnerName>A &amp; B</rptOwnerName></reportingOwner><nonDerivativeTransaction><transactionCoding><transactionCode>P</transactionCode></transactionCoding><transactionShares><value>10</value></transactionShares></nonDerivativeTransaction><derivativeTransaction><transactionCode>A</transactionCode><transactionShares><value>5</value></transactionShares><transactionPricePerShare><value>0</value></transactionPricePerShare></derivativeTransaction></ownershipDocument>');
  assert.equal(data.transactions[0].value, null); assert.equal(data.transactions[1].value, 0); assert.equal(data.transactions[1].derivative, true); assert.equal(data.amended, true); assert.equal(data.planned10b51, true); assert.equal(data.owners[0].name, "A & B");
  assert.throws(() => parseOwnershipXml('<!DOCTYPE x><ownershipDocument/>'));
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
});
