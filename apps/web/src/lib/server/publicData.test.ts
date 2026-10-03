import { test } from "node:test";
import assert from "node:assert/strict";
import { PublicDataClient, retryAfterMs } from "./publicData";
const options = { source: "test", ttlMs: 1000, maxStaleMs: 5000, parse: JSON.parse };
test("coalesces concurrent reads and preserves fetchedAt through cache hits", async () => {
  let calls = 0, now = 10000;
  const client = new PublicDataClient(async () => { calls++; return new Response('{"value":42}'); }, () => now, async () => {});
  const [a, b] = await Promise.all([client.read("https://test.local/data", options), client.read("https://test.local/data", options)]);
  assert.equal(calls, 1); assert.equal(a.fetchedAt, b.fetchedAt); assert.deepEqual(a.data, { value: 42 });
  now += 500; const c = await client.read("https://test.local/data", options);
  assert.equal(c.status, "cached"); assert.equal(c.fetchedAt, 10000); assert.equal(calls, 1);
});
test("429 blocks other paths on the provider and honors Retry-After", async () => {
  let calls = 0, now = 10000;
  const client = new PublicDataClient(async () => { calls++; return new Response("", { status: 429, headers: { "Retry-After": "120" } }); }, () => now, async () => {});
  const a = await client.read("https://test.local/a", options);
  const b = await client.read("https://test.local/b", options);
  assert.equal(a.data, null); assert.equal(b.status, "unavailable"); assert.equal(a.retryAt, 130000); assert.equal(calls, 1);
  now += 120001; await client.read("https://test.local/b", options); assert.equal(calls, 2);
});
test("failed refresh exposes stale data only within its allowed age", async () => {
  let calls = 0, now = 10000;
  const client = new PublicDataClient(async () => ++calls === 1 ? new Response("7") : new Response("", { status: 503 }), () => now, async () => {});
  await client.read("https://test.local/a", options);
  now += 1100; const stale = await client.read("https://test.local/a", options);
  assert.equal(stale.status, "stale"); assert.equal(stale.data, 7); assert.equal(stale.fetchedAt, 10000);
  now += 5000; const expired = await client.read("https://test.local/a", options);
  assert.equal(expired.status, "unavailable"); assert.equal(expired.data, null);
});
test("invalid payload is never cached as success and negative cache prevents storms", async () => {
  let calls = 0;
  const client = new PublicDataClient(async () => { calls++; return new Response("not json"); }, () => 10000, async () => {});
  const a = await client.read("https://test.local/a", options), b = await client.read("https://test.local/a", options);
  assert.equal(a.status, "unavailable"); assert.equal(b.data, null); assert.equal(calls, 1);
});
test("Retry-After supports seconds and HTTP-date without shortening a provider ban", () => {
  assert.equal(retryAfterMs("3600", 0), 3600000);
  assert.equal(retryAfterMs("Thu, 01 Jan 1970 00:01:00 GMT", 0), 60000);
  assert.equal(retryAfterMs(null, 0), 60000);
});
