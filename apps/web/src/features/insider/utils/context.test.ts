import { test } from "node:test";
import assert from "node:assert/strict";
import { filingContext, ownershipContext, positionChange } from "./context";
import { parseOwnershipXml, type OwnershipTransaction, type InsiderFiling } from "./filings";
const purchase: OwnershipTransaction = { code: "P", direction: "A", date: "2026-09-30", security: "Common stock", shares: 100, price: 10, value: 1000, remaining: 1100, derivative: false, ownership: "D", footnoteIds: [] };

test("row position change excludes ambiguous, indirect and derivative holdings", () => {
  assert.equal(positionChange(purchase).percent, 10);
  assert.equal(positionChange({ ...purchase, code: "S", direction: "D", remaining: 900 }).percent, -10);
  assert.equal(positionChange({ ...purchase, remaining: 100 }).newPosition, true);
  for (const row of [{ ...purchase, derivative: true }, { ...purchase, ownership: "I" }, { ...purchase, footnoteIds: ["F1"] }, { ...purchase, remaining: 50 }, { ...purchase, remaining: null }, { ...purchase, code: "A" }]) {
    assert.equal(positionChange(row).percent, null);
    assert.equal(positionChange(row).newPosition, false);
  }
});

test("ownership context separates purchases from grants and does not infer missing plan flags", () => {
  const detail = parseOwnershipXml('<ownershipDocument><documentType>4</documentType><issuer><issuerCik>1</issuerCik><issuerName>Issuer</issuerName></issuer><reportingOwner><rptOwnerName>Owner</rptOwnerName></reportingOwner><nonDerivativeTransaction><transactionCode>A</transactionCode><transactionShares><value>100</value></transactionShares><transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></nonDerivativeTransaction></ownershipDocument>');
  assert.equal(detail.planned10b51, null);
  detail.transactions.push(purchase, { ...purchase, derivative: true }, { ...purchase, price: null, value: null });
  const context = ownershipContext(detail);
  assert.equal(context.purchases.rows, 2);
  assert.equal(context.purchases.pricedRows, 1);
  assert.equal(context.purchases.disclosedValue, 1000);
  assert.equal(context.derivativeRows, 1);
  assert.equal(context.otherRows, 1);
  assert.equal(context.purchaseReview, false);
  assert.equal(ownershipContext({ ...detail, planned10b51: false }).purchaseReview, true);
  assert.equal(ownershipContext({ ...detail, planned10b51: false, amended: true }).purchaseReview, false);
});

test("report-period gap is calendar days and unknown dates stay unknown", () => {
  const filing = { filedAt: "2026-10-02", period: "2026-09-30", form: "4/A" } as InsiderFiling;
  assert.deepEqual(filingContext(filing), { periodGapDays: 2, amended: true });
  assert.equal(filingContext({ ...filing, period: null }).periodGapDays, null);
  assert.equal(filingContext({ ...filing, period: "2026-10-03" }).periodGapDays, null);
});

test("transaction footnote references suppress row ownership inference", () => {
  const detail = parseOwnershipXml('<ownershipDocument><issuer><issuerCik>1</issuerCik></issuer><reportingOwner><rptOwnerName>Owner</rptOwnerName></reportingOwner><nonDerivativeTransaction><transactionCode>P</transactionCode><transactionShares><value>100</value><footnoteId id="F1"/></transactionShares></nonDerivativeTransaction></ownershipDocument>');
  assert.deepEqual(detail.transactions[0].footnoteIds, ["F1"]);
});

test("local XML import checks issuer, amendment, report period and document type", async () => {
  const { importFilingXml } = await import("./context");
  const filing = { names: ["Issuer (CIK 0000000001)"], form: "4", period: "2026-09-30" } as InsiderFiling;
  const xml = '<ownershipDocument><documentType>4</documentType><periodOfReport>2026-09-30</periodOfReport><issuer><issuerCik>1</issuerCik></issuer><reportingOwner><rptOwnerName>Owner</rptOwnerName></reportingOwner></ownershipDocument>';
  assert.equal(importFilingXml(xml, filing).issuerCik, '1');
  assert.throws(() => importFilingXml(xml.replace('<issuerCik>1', '<issuerCik>2'), filing), /issuer CIK/);
  assert.throws(() => importFilingXml(xml.replace('<documentType>4', '<documentType>4/A'), filing), /amendment/);
  assert.throws(() => importFilingXml(xml.replace('2026-09-30', '2026-09-29'), filing), /report period/);
  assert.throws(() => importFilingXml(xml.replace('<documentType>4', '<documentType>3'), filing), /Form 4/);
});
