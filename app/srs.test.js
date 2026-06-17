const test = require("node:test");
const assert = require("node:assert");
const S = require("./srs.js");

function neu() { return S.leererStand(); }

test("kartenId baut stabilen Schlüssel", () => {
  assert.strictEqual(S.kartenId("2026-03", 7, "gelb"), "2026-03|7|gelb");
});

test("werte: falsch legt Karte an (Streak 0, morgen), Stats hochgezählt", () => {
  var s = neu();
  var r = S.werte(s, "2026-03", 7, "gelb", "sucht", false, "2026-06-17");
  assert.deepStrictEqual(r, { streak: 0, due: "2026-06-18", gemeistert: false });
  assert.deepStrictEqual(s.karten["2026-03|7|gelb"], { streak: 0, due: "2026-06-18", thema: "sucht" });
  assert.deepStrictEqual(s.stats["gelb|sucht"], { gesehen: 1, richtig: 0 });
});

test("werte: 4x richtig in Folge meistert und entfernt die Karte", () => {
  var s = neu();
  S.werte(s, "2026-03", 7, "gelb", "sucht", false, "2026-06-17");
  S.werte(s, "2026-03", 7, "gelb", "sucht", true, "2026-06-18");
  S.werte(s, "2026-03", 7, "gelb", "sucht", true, "2026-06-20");
  S.werte(s, "2026-03", 7, "gelb", "sucht", true, "2026-06-24");
  var r = S.werte(s, "2026-03", 7, "gelb", "sucht", true, "2026-07-02");
  assert.strictEqual(r.gemeistert, true);
  assert.strictEqual(s.karten["2026-03|7|gelb"], undefined);
  assert.deepStrictEqual(s.stats["gelb|sucht"], { gesehen: 5, richtig: 4 });
});

test("seedFalsch: legt fehlende Karte als morgen-fällig an, vorhandene unverändert", () => {
  var s = neu();
  S.seedFalsch(s, "2026-03", 7, "gelb", "2026-06-17");
  assert.strictEqual(s.karten["2026-03|7|gelb"].due, "2026-06-18");
  assert.strictEqual(s.karten["2026-03|7|gelb"].streak, 0);
  s.karten["2026-03|8|gelb"] = { streak: 2, due: "2026-06-30", thema: "x" };
  S.seedFalsch(s, "2026-03", 8, "gelb", "2026-06-17");
  assert.deepStrictEqual(s.karten["2026-03|8|gelb"], { streak: 2, due: "2026-06-30", thema: "x" });
});

test("faellige / anzahlFaellig: nach Level und optional Thema gefiltert", () => {
  var s = neu();
  s.karten = {
    "2026-03|1|gelb": { streak: 0, due: "2026-06-17", thema: "sucht" },
    "2026-03|2|gelb": { streak: 0, due: "2026-06-20", thema: "sucht" },
    "2025-10|5|gelb": { streak: 0, due: "2026-06-16", thema: "angst" },
    "2026-03|9|gruen": { streak: 0, due: "2026-06-10", thema: "sucht" },
  };
  assert.strictEqual(S.anzahlFaellig(s, "gelb", "2026-06-17"), 2);
  assert.strictEqual(S.anzahlFaellig(s, "gelb", "2026-06-17", "sucht"), 1);
  var ids = S.faellige(s, "gelb", "2026-06-17").map(function (k) { return k.examId + "|" + k.nr; });
  assert.deepStrictEqual(ids.sort(), ["2025-10|5", "2026-03|1"]);
});

test("trefferquote: richtig/gesehen oder null", () => {
  var s = neu();
  s.stats["gelb|sucht"] = { gesehen: 4, richtig: 3 };
  assert.strictEqual(S.trefferquote(s, "gelb", "sucht"), 0.75);
  assert.strictEqual(S.trefferquote(s, "gelb", "angst"), null);
});

test("lade/speichere über Speicher-Stub", () => {
  var store = (function () { var m = {}; return {
    getItem: function (k) { return k in m ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
  }; })();
  var s = neu(); s.karten["x"] = { streak: 1, due: "2026-06-18", thema: "sucht" };
  S.speichere(store, s);
  var geladen = S.lade(store);
  assert.deepStrictEqual(geladen, s);
  assert.deepStrictEqual(S.lade({ getItem: function () { return "kaputt{"; } }), S.leererStand());
});
