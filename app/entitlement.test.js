const test = require("node:test");
const assert = require("node:assert");
const E = require("./entitlement.js");

function stubStore(init) {
  var m = Object.assign({}, init || {});
  return {
    getItem: function (k) { return k in m ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
  };
}
function okFetch(body) {
  return function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve(body); } }); };
}

test("leererStand: kein Zugang, Felder null", () => {
  assert.deepStrictEqual(E.leererStand(), { hatZugang: false, kind: null, activeUntil: null });
});

test("hatZugang liest .hatZugang", () => {
  assert.strictEqual(E.hatZugang({ hatZugang: true }), true);
  assert.strictEqual(E.hatZugang({ hatZugang: false }), false);
  assert.strictEqual(E.hatZugang(null), false);
  assert.strictEqual(E.hatZugang(undefined), false);
});

test("lade: leer/kaputt -> leererStand; sonst Cache", () => {
  assert.deepStrictEqual(E.lade(stubStore()), { hatZugang: false, kind: null, activeUntil: null });
  var s = stubStore();
  E.speichere(s, { hatZugang: true, kind: "lifetime", activeUntil: null });
  assert.deepStrictEqual(E.lade(s), { hatZugang: true, kind: "lifetime", activeUntil: null });
  assert.deepStrictEqual(E.lade({ getItem: function () { return "kaputt{"; } }), E.leererStand());
});

test("refresh ohne Session -> leererStand gecacht, KEIN fetch", async () => {
  var s = stubStore();
  var called = false;
  var fetchFn = function () { called = true; return Promise.reject(new Error("should not be called")); };
  var stand = await E.refresh(s, fetchFn);
  assert.strictEqual(called, false);
  assert.deepStrictEqual(stand, E.leererStand());
  assert.deepStrictEqual(E.lade(s), E.leererStand());
});

test("refresh mit Session -> Serverstand gecacht", async () => {
  var s = stubStore({ hpp_session: "tok" });
  var stand = await E.refresh(s, okFetch({ hatZugang: true, kind: "lifetime", activeUntil: null }));
  assert.deepStrictEqual(stand, { hatZugang: true, kind: "lifetime", activeUntil: null });
  assert.deepStrictEqual(E.lade(s), stand);
});

test("refresh Netzfehler -> behält Cache", async () => {
  var s = stubStore({ hpp_session: "tok" });
  E.speichere(s, { hatZugang: true, kind: "lifetime", activeUntil: null });
  var stand = await E.refresh(s, function () { return Promise.reject(new Error("net")); });
  assert.strictEqual(stand.hatZugang, true);
});

test("anfordern: POST /api/auth/request mit email-Body", async () => {
  var captured = null;
  var fetchFn = function (url, opt) { captured = { url: url, opt: opt }; return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); };
  var ok = await E.anfordern("a@b.de", fetchFn);
  assert.strictEqual(ok, true);
  assert.strictEqual(captured.url, "/api/auth/request");
  assert.strictEqual(captured.opt.method, "POST");
  assert.deepStrictEqual(JSON.parse(captured.opt.body), { email: "a@b.de" });
});

test("abmelden: ruft logout, löscht Session + Cache", async () => {
  var s = stubStore({ hpp_session: "tok" });
  E.speichere(s, { hatZugang: true, kind: "lifetime", activeUntil: null });
  var captured = null;
  var fetchFn = function (url, opt) { captured = { url: url, opt: opt }; return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); };
  var stand = await E.abmelden(s, fetchFn);
  assert.strictEqual(captured.url, "/api/auth/logout");
  assert.strictEqual(s.getItem("hpp_session"), null);
  assert.deepStrictEqual(stand, E.leererStand());
  assert.deepStrictEqual(E.lade(s), E.leererStand());
});

test("refresh: HTTP-Fehler (res.ok=false) -> behält Cache, überschreibt nicht", async () => {
  var s = stubStore({ hpp_session: "tok" });
  E.speichere(s, { hatZugang: true, kind: "lifetime", activeUntil: null });
  var badFetch = function () { return Promise.resolve({ ok: false, json: function () { return Promise.resolve({ hatZugang: false, kind: null, activeUntil: null }); } }); };
  var stand = await E.refresh(s, badFetch);
  assert.strictEqual(stand.hatZugang, true);
  assert.deepStrictEqual(E.lade(s), { hatZugang: true, kind: "lifetime", activeUntil: null });
});

test("anfordern: Netzfehler -> false (keine Exception)", async () => {
  var ok = await E.anfordern("a@b.de", function () { return Promise.reject(new Error("net")); });
  assert.strictEqual(ok, false);
});
