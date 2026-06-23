const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

test("manifest.webmanifest: valides JSON mit Pflichtfeldern", () => {
  const raw = fs.readFileSync(path.join(__dirname, "manifest.webmanifest"), "utf8");
  const m = JSON.parse(raw);
  assert.strictEqual(m.name, "HPP-Prüfungstraining");
  assert.strictEqual(m.short_name, "HPP Training");
  assert.strictEqual(m.start_url, "/");
  assert.strictEqual(m.display, "standalone");
  assert.strictEqual(m.background_color, "#f7f6f3");
  assert.strictEqual(m.theme_color, "#f7f6f3");
  assert.ok(Array.isArray(m.icons) && m.icons.length >= 2);
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.indexOf("192x192") >= 0 && sizes.indexOf("512x512") >= 0);
  assert.ok(m.icons.every((i) => /maskable/.test(i.purpose)));
});
