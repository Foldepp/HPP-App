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

test("addTage: ISO-Datum korrekt verschoben (auch Monatsgrenze)", () => {
  assert.strictEqual(L.addTage("2026-06-17", 1), "2026-06-18");
  assert.strictEqual(L.addTage("2026-06-30", 2), "2026-07-02");
});

test("istFaellig: due <= heute", () => {
  assert.strictEqual(L.istFaellig("2026-06-17", "2026-06-17"), true);
  assert.strictEqual(L.istFaellig("2026-06-16", "2026-06-17"), true);
  assert.strictEqual(L.istFaellig("2026-06-18", "2026-06-17"), false);
});

test("werteKarteLogik: falsch -> Streak 0, morgen fällig", () => {
  assert.deepStrictEqual(L.werteKarteLogik(2, false, "2026-06-17"),
    { streak: 0, due: "2026-06-18", gemeistert: false });
});

test("werteKarteLogik: richtig -> Streak+1, Intervall 2/4/8", () => {
  assert.deepStrictEqual(L.werteKarteLogik(0, true, "2026-06-17"),
    { streak: 1, due: "2026-06-19", gemeistert: false });
  assert.deepStrictEqual(L.werteKarteLogik(1, true, "2026-06-17"),
    { streak: 2, due: "2026-06-21", gemeistert: false });
  assert.deepStrictEqual(L.werteKarteLogik(2, true, "2026-06-17"),
    { streak: 3, due: "2026-06-25", gemeistert: false });
});

test("werteKarteLogik: 4. richtig in Folge -> gemeistert (due null)", () => {
  assert.deepStrictEqual(L.werteKarteLogik(3, true, "2026-06-17"),
    { streak: 4, due: null, gemeistert: true });
});

test("istGratisLevel: nur gelb und gruen", () => {
  assert.strictEqual(L.istGratisLevel("gelb"), true);
  assert.strictEqual(L.istGratisLevel("gruen"), true);
  assert.strictEqual(L.istGratisLevel("blau"), false);
  assert.strictEqual(L.istGratisLevel("braun"), false);
  assert.strictEqual(L.istGratisLevel("schwarz"), false);
});

test("istBezahlLevel: blau, braun, schwarz", () => {
  assert.strictEqual(L.istBezahlLevel("blau"), true);
  assert.strictEqual(L.istBezahlLevel("braun"), true);
  assert.strictEqual(L.istBezahlLevel("schwarz"), true);
  assert.strictEqual(L.istBezahlLevel("gelb"), false);
  assert.strictEqual(L.istBezahlLevel("gruen"), false);
});

test("levelStatus: Gürtel-Sperre hat Vorrang vor Bezahl-Sperre", () => {
  assert.strictEqual(L.levelStatus("blau", "gruen", false), "guertel-gesperrt");
  assert.strictEqual(L.levelStatus("blau", "gruen", true), "guertel-gesperrt");
});

test("levelStatus: freigeschaltetes Bezahllevel ohne Zugang -> bezahl-gesperrt", () => {
  assert.strictEqual(L.levelStatus("blau", "blau", false), "bezahl-gesperrt");
  assert.strictEqual(L.levelStatus("blau", "blau", true), "frei");
  assert.strictEqual(L.levelStatus("schwarz", "schwarz", false), "bezahl-gesperrt");
});

test("levelStatus: Gratislevel ist immer frei (Zugang egal)", () => {
  assert.strictEqual(L.levelStatus("gelb", "gelb", false), "frei");
  assert.strictEqual(L.levelStatus("gruen", "gruen", false), "frei");
  assert.strictEqual(L.levelStatus("gelb", "gelb", true), "frei");
  assert.strictEqual(L.levelStatus("gruen", "gruen", true), "frei");
});

test("baueUebenSession: genug Fällige -> keine Auffüllung", () => {
  var id = function (k) { return k.id; };
  var faellig = [{id:1},{id:2},{id:3}];
  var alle = [{id:1},{id:2},{id:3},{id:4},{id:5}];
  var out = L.baueUebenSession(faellig, alle, 2, id);
  assert.deepStrictEqual(out.map(function(k){return k.id;}), [1,2,3]); // alle Fälligen bleiben, kein Fill da schon >= ziel
});

test("baueUebenSession: wenige Fällige -> mit frischen auf ziel auffüllen, keine Dubletten", () => {
  var id = function (k) { return k.id; };
  var faellig = [{id:1},{id:2}];
  var alle = [{id:1},{id:2},{id:3},{id:4},{id:5},{id:6}];
  var out = L.baueUebenSession(faellig, alle, 5, id);
  assert.strictEqual(out.length, 5);
  var idset = out.map(function(k){return k.id;});
  assert.ok(idset.indexOf(1) >= 0 && idset.indexOf(2) >= 0);   // Fällige enthalten
  assert.strictEqual(new Set(idset).size, 5);                   // keine Dubletten
  idset.forEach(function(x){ assert.ok([1,2,3,4,5,6].indexOf(x) >= 0); });
});

test("baueUebenSession: leere Fällige -> reine Auffüllung bis ziel", () => {
  var id = function (k) { return k.id; };
  var out = L.baueUebenSession([], [{id:1},{id:2},{id:3}], 2, id);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(new Set(out.map(function(k){return k.id;})).size, 2);
});

test("themaAufgeloest: hell/dunkel sind fest, auto folgt System", () => {
  assert.strictEqual(L.themaAufgeloest("hell", true), "hell");
  assert.strictEqual(L.themaAufgeloest("hell", false), "hell");
  assert.strictEqual(L.themaAufgeloest("dunkel", false), "dunkel");
  assert.strictEqual(L.themaAufgeloest("dunkel", true), "dunkel");
  assert.strictEqual(L.themaAufgeloest("auto", true), "dunkel");
  assert.strictEqual(L.themaAufgeloest("auto", false), "hell");
});

test("naechstesThema: Zyklus auto -> hell -> dunkel -> auto", () => {
  assert.strictEqual(L.naechstesThema("auto"), "hell");
  assert.strictEqual(L.naechstesThema("hell"), "dunkel");
  assert.strictEqual(L.naechstesThema("dunkel"), "auto");
  assert.strictEqual(L.naechstesThema("quatsch"), "auto"); // unbekannt -> auto
});
