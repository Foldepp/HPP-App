const test = require("node:test");
const assert = require("node:assert");
const H = require("./http.js");

test("getBearerToken: extrahiert Token, sonst null", () => {
  assert.strictEqual(H.getBearerToken("Bearer abc123"), "abc123");
  assert.strictEqual(H.getBearerToken("bearer abc123"), "abc123");
  assert.strictEqual(H.getBearerToken("Bearer    "), null);
  assert.strictEqual(H.getBearerToken("Token abc"), null);
  assert.strictEqual(H.getBearerToken(""), null);
  assert.strictEqual(H.getBearerToken(undefined), null);
});

test("istEmail: einfache Plausibilität", () => {
  assert.strictEqual(H.istEmail("a@b.de"), true);
  assert.strictEqual(H.istEmail("kein-email"), false);
  assert.strictEqual(H.istEmail("a@b"), false);
  assert.strictEqual(H.istEmail(""), false);
  assert.strictEqual(H.istEmail(null), false);
});
