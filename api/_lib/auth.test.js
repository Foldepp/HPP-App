const test = require("node:test");
const assert = require("node:assert");
const A = require("./auth.js");

test("tokenErzeugen: 64 Hex-Zeichen, unterschiedlich", () => {
  const a = A.tokenErzeugen(), b = A.tokenErzeugen();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notStrictEqual(a, b);
});

test("hashToken: deterministisch, != Rohwert", () => {
  assert.strictEqual(A.hashToken("abc"), A.hashToken("abc"));
  assert.notStrictEqual(A.hashToken("abc"), "abc");
  assert.match(A.hashToken("abc"), /^[0-9a-f]{64}$/);
});

test("zugangAktiv: lifetime immer true", () => {
  assert.strictEqual(A.zugangAktiv("lifetime", null, "2026-06-18T00:00:00Z"), true);
});

test("zugangAktiv: abo abhängig von activeUntil", () => {
  assert.strictEqual(A.zugangAktiv("abo", "2026-07-01T00:00:00Z", "2026-06-18T00:00:00Z"), true);
  assert.strictEqual(A.zugangAktiv("abo", "2026-06-01T00:00:00Z", "2026-06-18T00:00:00Z"), false);
  assert.strictEqual(A.zugangAktiv("abo", null, "2026-06-18T00:00:00Z"), false);
});

test("magicLinkGueltig: nur gültig wenn unbenutzt und nicht abgelaufen", () => {
  const now = "2026-06-18T00:00:00Z";
  assert.strictEqual(A.magicLinkGueltig({ used_at: null, expires_at: "2026-06-18T00:10:00Z" }, now), true);
  assert.strictEqual(A.magicLinkGueltig({ used_at: "2026-06-18T00:05:00Z", expires_at: "2026-06-18T00:10:00Z" }, now), false);
  assert.strictEqual(A.magicLinkGueltig({ used_at: null, expires_at: "2026-06-17T23:50:00Z" }, now), false);
  assert.strictEqual(A.magicLinkGueltig(null, now), false);
});
