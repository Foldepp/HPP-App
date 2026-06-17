const test = require("node:test");
const assert = require("node:assert");
const L = require("./logic.js");

test("GUERTEL hat die richtige Reihenfolge", () => {
  assert.deepStrictEqual(L.GUERTEL, ["gelb", "gruen", "blau", "braun", "schwarz"]);
  assert.strictEqual(L.ANZAHL_FRAGEN, 28);
  assert.strictEqual(L.BESTEHENSGRENZE, 21);
});

test("istRichtig: exakter Mengenvergleich, reihenfolgeunabhaengig", () => {
  assert.strictEqual(L.istRichtig(["A"], ["A"]), true);
  assert.strictEqual(L.istRichtig(["B", "C"], ["C", "B"]), true);
  assert.strictEqual(L.istRichtig(["A"], ["B"]), false);
  assert.strictEqual(L.istRichtig(["B"], ["B", "C"]), false); // Teilmenge zaehlt nicht
  assert.strictEqual(L.istRichtig([], ["A"]), false);
});

test("bestanden: ab 21 von 28", () => {
  assert.strictEqual(L.bestanden(21), true);
  assert.strictEqual(L.bestanden(28), true);
  assert.strictEqual(L.bestanden(20), false);
});

test("istFreigeschaltet: bis zum hoechsten Guertel inklusive", () => {
  assert.strictEqual(L.istFreigeschaltet("gelb", "gelb"), true);
  assert.strictEqual(L.istFreigeschaltet("gruen", "gelb"), false);
  assert.strictEqual(L.istFreigeschaltet("blau", "braun"), true);
});

test("naechsterHoechster: schaltet bei Bestehen genau einen weiter, nie zurueck", () => {
  assert.strictEqual(L.naechsterHoechster("gelb", "gelb", 23), "gruen");
  assert.strictEqual(L.naechsterHoechster("gelb", "gelb", 20), "gelb");
  assert.strictEqual(L.naechsterHoechster("braun", "gelb", 28), "braun");
  assert.strictEqual(L.naechsterHoechster("schwarz", "schwarz", 28), "schwarz");
});

test("erwarteMehrfach: an loesung.length, nicht am Typ-Label", () => {
  assert.strictEqual(L.erwarteMehrfach(["B", "C"]), true);
  assert.strictEqual(L.erwarteMehrfach(["A"]), false); // Schwarz-Frage 1: typ=Mehrfachauswahl, loesung=["A"]
});

test("mischen: Ergebnis ist eine Permutation, Eingabe bleibt unveraendert", () => {
  var input = ["A", "B", "C", "D", "E"];
  var out = L.mischen(input, function () { return 0; });
  assert.strictEqual(out.length, 5);
  assert.deepStrictEqual(out.slice().sort(), ["A", "B", "C", "D", "E"]);
  assert.deepStrictEqual(input, ["A", "B", "C", "D", "E"]); // Original unangetastet
});

test("mischen: mit rnd=0 deterministische Fisher-Yates-Reihenfolge", () => {
  assert.deepStrictEqual(L.mischen(["A", "B", "C"], function () { return 0; }), ["B", "C", "A"]);
});

test("anzeigeOptionen: Labels A.. in Reihenfolge, original + text korrekt", () => {
  var optionen = { A: "Alpha", B: "Bravo", C: "Charlie" };
  assert.deepStrictEqual(L.anzeigeOptionen(optionen, ["C", "A", "B"]), [
    { label: "A", original: "C", text: "Charlie" },
    { label: "B", original: "A", text: "Alpha" },
    { label: "C", original: "B", text: "Bravo" },
  ]);
});
