const test = require("node:test");
const assert = require("node:assert");
const E = require("./entitlement.js");

function stubStore() {
  var m = {};
  return {
    getItem: function (k) { return k in m ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
  };
}

test("leererStand: kein Zugang", () => {
  assert.deepStrictEqual(E.leererStand(), { aktiv: false });
  assert.strictEqual(E.hatZugang(E.leererStand()), false);
});

test("hatZugang: true nur bei aktiv === true", () => {
  assert.strictEqual(E.hatZugang({ aktiv: true }), true);
  assert.strictEqual(E.hatZugang({ aktiv: false }), false);
  assert.strictEqual(E.hatZugang(null), false);
  assert.strictEqual(E.hatZugang(undefined), false);
});

test("lade: leerer oder kaputter Speicher -> leererStand", () => {
  assert.deepStrictEqual(E.lade(stubStore()), { aktiv: false });
  assert.deepStrictEqual(E.lade({ getItem: function () { return "kaputt{"; } }), { aktiv: false });
});

test("entsperreStub -> speichert aktiv, lade liest es zurück", () => {
  var store = stubStore();
  var ent = E.entsperreStub(store);
  assert.deepStrictEqual(ent, { aktiv: true });
  assert.deepStrictEqual(E.lade(store), { aktiv: true });
  assert.strictEqual(E.hatZugang(E.lade(store)), true);
});

test("sperre -> setzt aktiv zurück", () => {
  var store = stubStore();
  E.entsperreStub(store);
  E.sperre(store);
  assert.deepStrictEqual(E.lade(store), { aktiv: false });
});
