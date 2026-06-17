# Paket B — Übungsmodus (SRS) — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein fehlergetriebener Übungsmodus mit Spaced-Repetition: Karten = Fragen je Stufe (level-gepoolt), Streak-Planung (2/4/8 Tage, gemeistert nach 4×), Tagesplan fälliger Karten, Üben je Level und je Themenbereich, Sofort-Feedback mit Wissenskern, Trefferquote je Themenbereich.

**Architecture:** Reine SRS-Rechenlogik in `logic.js`; localStorage-/Auswahl-Logik im neuen UMD-Modul `srs.js` (beide `node --test`-getestet); Views/Session-Engine in `app.js`; 12 Themenbereiche als Datenfeld. Vertikale Phasen: Daten → SRS-Logik → Persistenz → Karten-Screen → Dashboard/Umschalter → Themenfilter → Prüfungs-Seeding.

**Tech Stack:** Vanilla HTML/CSS/JS (kein Build), Node `node:test`, Python 3 (Daten), `localStorage`.

---

## Dateien

| Datei | Verantwortung |
|---|---|
| `daten/themenbereiche.json` | **neu** — 12 Bereiche (id + label, Anzeige-Reihenfolge). |
| `daten/zuordnung_themenbereiche.py` | **neu** — schreibt `themenbereich` in jede Frage (feste Zuordnung). |
| `daten/build_data.py` | `themenbereiche` zusätzlich in `app/data.js` bündeln. |
| `app/logic.js` | reine SRS-Funktionen (Streak/Fälligkeit) + Konstanten. |
| `app/srs.js` | **neu** — `window.HPP_SRS`: Stand laden/speichern, Karte werten, fällige Karten, Trefferquote. UMD, testbar. |
| `app/app.js` | gepoolter Datenzugriff, Modus-Umschalter, Dashboard, Karten-Screen, Session-Engine, Prüfungs-Seeding. |
| `app/styles.css` | Segmented Control, Dashboard, Karten-Feedback. |
| `app/index.html` | `<script src="srs.js">` ergänzen. |
| `app/logic.test.js` | Tests SRS-Logik. |
| `app/srs.test.js` | **neu** — Tests `srs.js` mit Speicher-Stub. |

**Stabile Schnittstellen (über alle Tasks identisch):**
- logic: `MASTER_STREAK=4`, `SRS_INTERVALE={1:2,2:4,3:8}`, `werteKarteLogik(streak,richtig,heuteIso)→{streak,due,gemeistert}`, `istFaellig(dueIso,heuteIso)`, `addTage(iso,n)`, `heuteIso()`.
- srs (`window.HPP_SRS`): `leererStand()`, `kartenId(examId,nr,level)`, `lade(storage)`, `speichere(storage,srs)`, `werte(srs,examId,nr,level,thema,richtig,heuteIso)→{streak,due,gemeistert}`, `seedFalsch(srs,examId,nr,level,heuteIso)`, `faellige(srs,level,heuteIso,themaFilter?)→[{examId,nr,level,thema}]`, `anzahlFaellig(srs,level,heuteIso,themaFilter?)→number`, `trefferquote(srs,level,thema)→number|null`.
- Karten-State `srs.karten["<examId>|<nr>|<level>"] = { streak, due, thema }`. Stats `srs.stats["<level>|<thema>"] = { gesehen, richtig }`.

---

## Task 1: Daten — Themenbereiche + Zuordnung

**Files:**
- Create: `daten/themenbereiche.json`, `daten/zuordnung_themenbereiche.py`
- Modify: `daten/build_data.py`, `daten/fragen_2026-03.json`, `daten/fragen_2025-10.json` (generiert via Skript), `app/data.js` (generiert)

- [ ] **Step 1: `daten/themenbereiche.json` schreiben**

```json
[
  { "id": "diagnostik",  "label": "Diagnostik, Klassifikation & Psychopathologie" },
  { "id": "affektiv",    "label": "Affektive Störungen" },
  { "id": "psychosen",   "label": "Schizophrenie & psychotische Störungen" },
  { "id": "angst",       "label": "Angst-, Zwangs-, Belastungs- & somatoforme Störungen" },
  { "id": "persoenlich", "label": "Persönlichkeitsstörungen" },
  { "id": "sucht",       "label": "Suchterkrankungen" },
  { "id": "organisch",   "label": "Organische Störungen, Neurologie & Psychopharmakologie" },
  { "id": "kjp",         "label": "Kinder- & Jugendpsychiatrie" },
  { "id": "ess_sexual",  "label": "Ess- & Sexualstörungen" },
  { "id": "notfall",     "label": "Notfälle & Suizidalität" },
  { "id": "therapie",    "label": "Psychotherapieverfahren & Lerntheorie" },
  { "id": "recht",       "label": "Recht & Berufskunde" }
]
```

- [ ] **Step 2: `daten/zuordnung_themenbereiche.py` schreiben** (feste, empirisch hergeleitete Zuordnung)

```python
#!/usr/bin/env python3
"""Schreibt das Feld `themenbereich` in jede Frage der guertel_komplett-Pruefungen.
Feste Zuordnung (siehe Spec/Brainstorm). Erneut ausfuehrbar (idempotent)."""
import json
from pathlib import Path

DATEN = Path(__file__).resolve().parent
GUELTIGE_IDS = {"diagnostik","affektiv","psychosen","angst","persoenlich","sucht",
                "organisch","kjp","ess_sexual","notfall","therapie","recht"}

ZUORDNUNG = {
 "2026-03": {1:"persoenlich",2:"diagnostik",3:"diagnostik",4:"diagnostik",5:"affektiv",
   6:"sucht",7:"psychosen",8:"affektiv",9:"diagnostik",10:"angst",11:"affektiv",12:"notfall",
   13:"diagnostik",14:"recht",15:"angst",16:"psychosen",17:"affektiv",18:"diagnostik",
   19:"notfall",20:"organisch",21:"persoenlich",22:"organisch",23:"diagnostik",24:"persoenlich",
   25:"diagnostik",26:"psychosen",27:"recht",28:"affektiv"},
 "2025-10": {1:"angst",2:"affektiv",3:"affektiv",4:"angst",5:"organisch",6:"therapie",
   7:"persoenlich",8:"kjp",9:"ess_sexual",10:"recht",11:"organisch",12:"organisch",
   13:"diagnostik",14:"notfall",15:"therapie",16:"recht",17:"psychosen",18:"sucht",19:"sucht",
   20:"therapie",21:"kjp",22:"therapie",23:"therapie",24:"therapie",25:"therapie",26:"angst",
   27:"angst",28:"organisch"},
}
DATEIEN = {"2026-03":"fragen_2026-03.json","2025-10":"fragen_2025-10.json"}

def main():
    for exam_id, datei in DATEIEN.items():
        pfad = DATEN / datei
        d = json.loads(pfad.read_text(encoding="utf-8"))
        zu = ZUORDNUNG[exam_id]
        for fr in d["fragen"]:
            b = zu[fr["nr"]]
            assert b in GUELTIGE_IDS, b
            fr["themenbereich"] = b
        pfad.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{datei}: {len(d['fragen'])} Fragen zugeordnet")

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: `build_data.py` um Themenbereiche erweitern**

In `daten/build_data.py` die `payload`-Zeile ersetzen.

Alt:
```python
    payload = {"index": index, "exams": exams}
```
Neu:
```python
    themenbereiche = json.loads((DATEN / "themenbereiche.json").read_text(encoding="utf-8"))
    payload = {"index": index, "exams": exams, "themenbereiche": themenbereiche}
```

- [ ] **Step 4: Zuordnung + Build ausführen und prüfen**

Run:
```bash
python3 daten/zuordnung_themenbereiche.py && python3 daten/build_data.py && node -e '
global.window={}; require("./app/data.js"); var d=window.HPP_DATA;
console.log("themenbereiche:", d.themenbereiche.length);
var fehlen=0; Object.values(d.exams).forEach(function(ex){ ex.fragen.forEach(function(f){ if(!f.themenbereich) fehlen++; }); });
console.log("Fragen ohne themenbereich:", fehlen);
console.log("Beispiel 2026-03 F1:", d.exams["2026-03"].fragen[0].themenbereich);
'
```
Expected:
```
themenbereiche: 12
Fragen ohne themenbereich: 0
Beispiel 2026-03 F1: persoenlich
```

- [ ] **Step 5: Commit**

```bash
git add daten/themenbereiche.json daten/zuordnung_themenbereiche.py daten/build_data.py daten/fragen_2026-03.json daten/fragen_2025-10.json app/data.js
git commit -m "feat(daten): 12 Themenbereiche + Zuordnung je Frage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: SRS-Logik in `logic.js` (TDD)

**Files:**
- Modify: `app/logic.js`, `app/logic.test.js`

- [ ] **Step 1: Failing Tests an `app/logic.test.js` anhängen**

```javascript
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
    { streak: 1, due: "2026-06-19", gemeistert: false }); // +2
  assert.deepStrictEqual(L.werteKarteLogik(1, true, "2026-06-17"),
    { streak: 2, due: "2026-06-21", gemeistert: false }); // +4
  assert.deepStrictEqual(L.werteKarteLogik(2, true, "2026-06-17"),
    { streak: 3, due: "2026-06-25", gemeistert: false }); // +8
});

test("werteKarteLogik: 4. richtig in Folge -> gemeistert (due null)", () => {
  assert.deepStrictEqual(L.werteKarteLogik(3, true, "2026-06-17"),
    { streak: 4, due: null, gemeistert: true });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `node --test app/logic.test.js`
Expected: FAIL (`L.addTage is not a function` etc.).

- [ ] **Step 3: Funktionen in `app/logic.js` einfügen** (direkt vor `var api = {`)

```javascript
  var MASTER_STREAK = 4;
  var SRS_INTERVALE = { 1: 2, 2: 4, 3: 8 };

  function addTage(iso, n) {
    var d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function istFaellig(dueIso, heuteIso) {
    return dueIso <= heuteIso;
  }

  function werteKarteLogik(streak, richtig, heuteIso) {
    var neu = richtig ? streak + 1 : 0;
    if (richtig && neu >= MASTER_STREAK) {
      return { streak: neu, due: null, gemeistert: true };
    }
    var tage = richtig ? SRS_INTERVALE[neu] : 1;
    return { streak: neu, due: addTage(heuteIso, tage), gemeistert: false };
  }

  function heuteIso() {
    return new Date().toISOString().slice(0, 10);
  }
```

Im `api`-Objekt nach `anzeigeOptionen: anzeigeOptionen,` ergänzen:
```javascript
    MASTER_STREAK: MASTER_STREAK,
    SRS_INTERVALE: SRS_INTERVALE,
    addTage: addTage,
    istFaellig: istFaellig,
    werteKarteLogik: werteKarteLogik,
    heuteIso: heuteIso,
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `node --test app/logic.test.js`
Expected: PASS (alle bisherigen + 5 neue grün).

- [ ] **Step 5: Commit**

```bash
git add app/logic.js app/logic.test.js
git commit -m "feat: SRS-Streak-/Fälligkeitslogik in logic.js

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Persistenz-Modul `srs.js` (TDD)

**Files:**
- Create: `app/srs.js`, `app/srs.test.js`
- Modify: `app/index.html`

- [ ] **Step 1: `app/srs.test.js` schreiben (Failing Tests)**

```javascript
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
  S.werte(s, "2026-03", 7, "gelb", "sucht", false, "2026-06-17"); // streak 0
  S.werte(s, "2026-03", 7, "gelb", "sucht", true, "2026-06-18");  // 1
  S.werte(s, "2026-03", 7, "gelb", "sucht", true, "2026-06-20");  // 2
  S.werte(s, "2026-03", 7, "gelb", "sucht", true, "2026-06-24");  // 3
  var r = S.werte(s, "2026-03", 7, "gelb", "sucht", true, "2026-07-02"); // 4 -> gemeistert
  assert.strictEqual(r.gemeistert, true);
  assert.strictEqual(s.karten["2026-03|7|gelb"], undefined);
  assert.deepStrictEqual(s.stats["gelb|sucht"], { gesehen: 5, richtig: 4 });
});

test("seedFalsch: legt fehlende Karte als morgen-fällig an, vorhandene unverändert", () => {
  var s = neu();
  S.seedFalsch(s, "2026-03", 7, "gelb", "2026-06-17");
  // thema wird aus dem Datensatz gesetzt? Nein -> seedFalsch kennt thema nicht; setzt leeres thema
  assert.strictEqual(s.karten["2026-03|7|gelb"].due, "2026-06-18");
  assert.strictEqual(s.karten["2026-03|7|gelb"].streak, 0);
  // bereits vorhandene Karte nicht überschreiben
  s.karten["2026-03|8|gelb"] = { streak: 2, due: "2026-06-30", thema: "x" };
  S.seedFalsch(s, "2026-03", 8, "gelb", "2026-06-17");
  assert.deepStrictEqual(s.karten["2026-03|8|gelb"], { streak: 2, due: "2026-06-30", thema: "x" });
});

test("faellige / anzahlFaellig: nach Level und optional Thema gefiltert", () => {
  var s = neu();
  s.karten = {
    "2026-03|1|gelb": { streak: 0, due: "2026-06-17", thema: "sucht" },
    "2026-03|2|gelb": { streak: 0, due: "2026-06-20", thema: "sucht" }, // nicht fällig
    "2025-10|5|gelb": { streak: 0, due: "2026-06-16", thema: "angst" },
    "2026-03|9|gruen": { streak: 0, due: "2026-06-10", thema: "sucht" }, // anderes Level
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
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `node --test app/srs.test.js`
Expected: FAIL (`Cannot find module './srs.js'`).

- [ ] **Step 3: `app/srs.js` implementieren**

```javascript
(function (root) {
  "use strict";
  var L = (typeof require !== "undefined") ? require("./logic.js")
        : (root.HPP_LOGIC);

  var KEY = "hpp_srs";

  function leererStand() { return { karten: {}, stats: {} }; }
  function kartenId(examId, nr, level) { return examId + "|" + nr + "|" + level; }

  function statsKey(level, thema) { return level + "|" + thema; }

  function werte(srs, examId, nr, level, thema, richtig, heuteIso) {
    var id = kartenId(examId, nr, level);
    var alt = srs.karten[id];
    var streak = alt ? alt.streak : 0;
    var res = L.werteKarteLogik(streak, richtig, heuteIso);
    if (res.gemeistert) { delete srs.karten[id]; }
    else { srs.karten[id] = { streak: res.streak, due: res.due, thema: thema }; }
    var sk = statsKey(level, thema);
    var st = srs.stats[sk] || { gesehen: 0, richtig: 0 };
    st.gesehen += 1;
    if (richtig) st.richtig += 1;
    srs.stats[sk] = st;
    return res;
  }

  function seedFalsch(srs, examId, nr, level, heuteIso) {
    var id = kartenId(examId, nr, level);
    if (srs.karten[id]) return; // vorhandene nicht überschreiben
    srs.karten[id] = { streak: 0, due: L.addTage(heuteIso, 1), thema: "" };
  }

  function faellige(srs, level, heuteIso, themaFilter) {
    var out = [];
    Object.keys(srs.karten).forEach(function (id) {
      var teile = id.split("|"); // examId | nr | level
      if (teile[2] !== level) return;
      var k = srs.karten[id];
      if (themaFilter && k.thema !== themaFilter) return;
      if (!L.istFaellig(k.due, heuteIso)) return;
      out.push({ examId: teile[0], nr: parseInt(teile[1], 10), level: level, thema: k.thema });
    });
    return out;
  }

  function anzahlFaellig(srs, level, heuteIso, themaFilter) {
    return faellige(srs, level, heuteIso, themaFilter).length;
  }

  function trefferquote(srs, level, thema) {
    var st = srs.stats[statsKey(level, thema)];
    if (!st || st.gesehen === 0) return null;
    return st.richtig / st.gesehen;
  }

  function lade(storage) {
    try {
      var roh = JSON.parse(storage.getItem(KEY));
      if (roh && roh.karten && roh.stats) return roh;
    } catch (e) {}
    return leererStand();
  }
  function speichere(storage, srs) {
    try { storage.setItem(KEY, JSON.stringify(srs)); } catch (e) {}
  }

  var api = {
    leererStand: leererStand, kartenId: kartenId, werte: werte, seedFalsch: seedFalsch,
    faellige: faellige, anzahlFaellig: anzahlFaellig, trefferquote: trefferquote,
    lade: lade, speichere: speichere,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HPP_SRS = api;
})(typeof window !== "undefined" ? window : this);
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `node --test app/srs.test.js`
Expected: PASS (8 Tests grün).

- [ ] **Step 5: `app/index.html` — srs.js laden**

Alt:
```html
  <script src="logic.js"></script>
  <script src="app.js"></script>
```
Neu:
```html
  <script src="logic.js"></script>
  <script src="srs.js"></script>
  <script src="app.js"></script>
```

- [ ] **Step 6: Commit**

```bash
git add app/srs.js app/srs.test.js app/index.html
git commit -m "feat: srs.js — localStorage-Persistenz für Übungskarten (getestet)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Gepoolter Datenzugriff + Karten-Screen + Session-Engine

**Files:**
- Modify: `app/app.js`, `app/styles.css`

- [ ] **Step 1: Globale Hilfen in `app/app.js` einfügen** (direkt nach der Zeile `var app = document.getElementById("app");`)

```javascript
  var EXAMS = DATA.exams;
  var POOL_IDS = Object.keys(EXAMS);
  var THEMEN = DATA.themenbereiche; // [{id,label}]
  function themaLabel(id) {
    for (var i = 0; i < THEMEN.length; i++) if (THEMEN[i].id === id) return THEMEN[i].label;
    return id;
  }
  function findeFrage(examId, nr) {
    var fragen = EXAMS[examId].fragen;
    for (var i = 0; i < fragen.length; i++) if (fragen[i].nr === nr) return fragen[i];
    return null;
  }
  // alle Karten eines Levels über alle Pool-Prüfungen
  function alleKartenDesLevels(level, themaFilter) {
    var out = [];
    POOL_IDS.forEach(function (examId) {
      EXAMS[examId].fragen.forEach(function (f) {
        if (!f.themenbereich) return; // A1: korrupte/unzugeordnete Prüfungen überspringen
        if (themaFilter && f.themenbereich !== themaFilter) return;
        out.push({ examId: examId, nr: f.nr, level: level, thema: f.themenbereich });
      });
    });
    return out;
  }
  var srs = L_srsLade();
  function L_srsLade() { return window.HPP_SRS.lade(window.localStorage); }
  function srsSpeichern() { window.HPP_SRS.speichere(window.localStorage, srs); }
```

Hinweis: `srs` und `L_srsLade` werden hier deklariert; `var`-Hoisting macht den Aufruf vor der Funktionsdefinition gültig.

- [ ] **Step 2: Session-Engine + Karten-Screen einfügen** (vor dem `window.HPP_APP`-Export)

```javascript
  // quelle: Text fürs Protokoll; zurueck: Funktion, die beim Verlassen aufgerufen wird
  function starteSession(karten, level, kontext, zurueck) {
    if (!karten.length) { window.alert("Keine Karten vorhanden."); zurueck(); return; }
    var gemischt = L.mischen(karten);
    state.session = {
      level: level, kontext: kontext, zurueck: zurueck,
      queue: gemischt.slice(), pos: 0, gesamt: gemischt.length,
      reihenfolge: {}, gewertet: {}, pending: {}, reshows: {}, geprueft: false, gewaehlt: [], aktFeedback: null,
    };
    zeigeKarte();
  }

  function sessionKartenId(k) { return window.HPP_SRS.kartenId(k.examId, k.nr, k.level); }

  function zeigeKarte() {
    leeren();
    var se = state.session;
    var k = se.queue[se.pos];
    var frage = findeFrage(k.examId, k.nr);
    var stufe = frage.stufen[k.level];
    var kid = sessionKartenId(k);
    if (!se.reihenfolge[kid]) se.reihenfolge[kid] = L.mischen(Object.keys(stufe.optionen));
    var mehrfach = L.erwarteMehrfach(stufe.loesung);
    se.geprueft = (se.aktFeedback !== null);

    var html = '<div class="ex">';
    html += '<div class="ex-top">' + homeButtonHtml(k.level) +
      '<span class="ex-count">' + (se.pos + 1) + ' / ' + se.gesamt + '</span>' +
      '<span class="th-chip">' + escape(themaLabel(k.thema)) + '</span></div>';
    html += '<div class="ex-bar"><i style="width:' + ((se.pos) / se.gesamt * 100) + '%; background:var(--g-' + k.level + ')"></i></div>';
    html += '<div class="ex-body"><div class="ex-scroll">';
    html += '<p class="ex-stamm">' + escape(stufe.stamm) + '</p>';
    if (stufe.aussagen) {
      html += '<ol class="aussagen">';
      Object.keys(stufe.aussagen).forEach(function (n) {
        html += '<li><b>' + n + '.</b> ' + escape(stufe.aussagen[n]) + '</li>';
      });
      html += '</ol>';
    }
    if (mehrfach && !se.geprueft) html += '<p class="ex-hint">Wählen Sie zwei Antworten!</p>';
    // Optionen
    html += '<div class="ex-opts">';
    L.anzeigeOptionen(stufe.optionen, se.reihenfolge[kid]).forEach(function (o) {
      var cls = "";
      if (se.geprueft) {
        if (stufe.loesung.indexOf(o.original) >= 0) cls = " correct";
        else if (se.gewaehlt.indexOf(o.original) >= 0) cls = " wrong";
      } else if (se.gewaehlt.indexOf(o.original) >= 0) cls = " sel";
      var mk = "";
      if (se.geprueft && stufe.loesung.indexOf(o.original) >= 0) mk = '<span class="mk">✓</span>';
      else if (se.geprueft && se.gewaehlt.indexOf(o.original) >= 0) mk = '<span class="mk">✗</span>';
      html += '<div class="ex-opt' + cls + '" data-opt="' + o.original + '">' +
        '<span class="ltr">' + o.label + '</span><span class="t">' + escape(o.text) + '</span>' + mk + '</div>';
    });
    html += '</div>';
    // Feedback (wächst nach unten)
    if (se.geprueft) {
      var fb = se.aktFeedback;
      html += '<div class="divider">Auswertung</div>' +
        '<div class="fb ' + (fb.richtig ? "good" : "bad") + '">' +
        '<div class="fb-hd">' + (fb.richtig ? "✓ Richtig" : "✗ Leider falsch") + '</div>' +
        (frage.kern ? '<div class="fb-kern"><b>Wissenskern:</b> ' + escape(frage.kern) + '</div>' : "") +
        '</div>' +
        '<div class="ret">' + escape(fb.hinweis) + '</div>';
    }
    html += '</div>'; // ex-body
    // Fuß
    html += '<div class="ex-foot">';
    if (!se.geprueft) html += '<button class="btn btn-primary ex-next" id="btn-pruefen">Prüfen</button>';
    else html += '<button class="btn btn-primary ex-next" id="btn-weiter">' + ((se.pos === se.queue.length - 1 && !se.pending[kid]) ? "Fertig" : "Weiter ›") + '</button>';
    html += '</div></div>';
    app.innerHTML = html;

    if (!se.geprueft) {
      app.querySelectorAll("[data-opt]").forEach(function (el) {
        el.addEventListener("click", function () { waehleKarte(el.getAttribute("data-opt"), mehrfach); });
      });
      app.querySelector("#btn-pruefen").addEventListener("click", pruefeKarte);
    } else {
      app.querySelector("#btn-weiter").addEventListener("click", naechsteKarte);
      var fbEl = app.querySelector(".fb"); if (fbEl) fbEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    bindHome();
  }

  function waehleKarte(buchstabe, mehrfach) {
    var se = state.session, akt = se.gewaehlt;
    if (mehrfach) {
      var i = akt.indexOf(buchstabe);
      if (i >= 0) akt = akt.filter(function (x) { return x !== buchstabe; });
      else if (akt.length < 2) akt = akt.concat([buchstabe]);
    } else { akt = [buchstabe]; }
    se.gewaehlt = akt;
    zeigeKarte();
  }

  function pruefeKarte() {
    var se = state.session;
    if (!se.gewaehlt.length) return;
    var k = se.queue[se.pos];
    var frage = findeFrage(k.examId, k.nr);
    var stufe = frage.stufen[k.level];
    var richtig = L.istRichtig(se.gewaehlt, stufe.loesung);
    var kid = sessionKartenId(k);
    if (se.gewertet[kid] === undefined) {
      // erste (gewertete) Antwort dieser Karte in der Session
      var res = window.HPP_SRS.werte(srs, k.examId, k.nr, k.level, k.thema, richtig, L.heuteIso());
      srsSpeichern();
      se.gewertet[kid] = true;
      se.pending[kid] = !richtig; // bei falsch zur Wiedervorlage
      se.reshows[kid] = 0;
      se.aktFeedback = { richtig: richtig, hinweis: feedbackHinweis(res) };
    } else {
      // Wiedervorlage in derselben Session: nicht erneut werten/planen
      if (richtig) se.pending[kid] = false;
      se.aktFeedback = { richtig: richtig, hinweis: richtig ? "Diesmal richtig — gut!" : "Schau dir die Lösung nochmal an." };
    }
    zeigeKarte();
  }

  function feedbackHinweis(res) {
    if (res.gemeistert) return "🎉 Gemeistert!";
    var tage = res.due ? Math.round((new Date(res.due + "T00:00:00Z") - new Date(L.heuteIso() + "T00:00:00Z")) / 86400000) : 0;
    var wann = tage <= 1 ? "morgen" : "in " + tage + " Tagen";
    return "Kommt " + wann + " wieder · Streak " + res.streak + "/" + L.MASTER_STREAK;
  }

  function naechsteKarte() {
    var se = state.session;
    var k = se.queue[se.pos];
    var kid = sessionKartenId(k);
    // offene Wiedervorlage ans Ende hängen, gedeckelt auf 3 Reshows
    if (se.pending[kid] && se.reshows[kid] < 3) {
      se.queue.push(k); se.reshows[kid]++;
    }
    se.pos++;
    se.gewaehlt = [];
    se.aktFeedback = null;
    if (se.pos >= se.queue.length) { se.zurueck(); return; }
    zeigeKarte();
  }
```

- [ ] **Step 2b: Home-Abbruch für Sessions zulassen**

In `homeKlick` (vorhandene Funktion) die laufende Session beim Verlassen verwerfen. `homeKlick` aktuell:
```javascript
  function homeKlick() {
    if (state.pruefung && !state.pruefung.abgegeben) {
      if (!window.confirm("Prüfung abbrechen? Der aktuelle Versuch geht verloren.")) return;
      if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
      state.pruefung = null;
    }
    zeigeGuertelauswahl();
  }
```
ersetzen durch:
```javascript
  function homeKlick() {
    if (state.pruefung && !state.pruefung.abgegeben) {
      if (!window.confirm("Prüfung abbrechen? Der aktuelle Versuch geht verloren.")) return;
      if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
      state.pruefung = null;
    }
    state.session = null; // laufende Übungs-Session beenden (Wertung erfolgte bereits pro Karte)
    zeigeGuertelauswahl();
  }
```

- [ ] **Step 3: CSS für Karten-Screen anhängen** (an `app/styles.css`)

```css
.th-chip { font-size: 11px; font-weight: 700; color: var(--muted); background: #ece9e3; padding: 4px 9px; border-radius: 20px; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex-opt.correct { border-color: var(--accent); background: var(--accent-soft); }
.ex-opt.correct .ltr { background: var(--accent); color: #fff; }
.ex-opt.wrong { border-color: var(--warn); background: #fdf0ea; }
.ex-opt.wrong .ltr { background: var(--warn); color: #fff; }
.ex-opt .mk { margin-left: auto; font-weight: 700; }
.divider { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 11px; margin: 16px 0 10px; text-transform: uppercase; letter-spacing: .05em; }
.divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: var(--line); }
.fb { border-radius: 12px; padding: 12px 14px; }
.fb.good { background: var(--accent-soft); border: 1px solid var(--accent); }
.fb.bad { background: #fdf0ea; border: 1px solid var(--warn); }
.fb-hd { font-weight: 800; font-size: 15px; }
.fb.good .fb-hd { color: var(--accent); }
.fb.bad .fb-hd { color: var(--warn); }
.fb-kern { font-size: 13px; line-height: 1.45; margin-top: 6px; }
.ret { text-align: center; font-size: 12px; color: var(--muted); margin-top: 10px; }
```

- [ ] **Step 4: Syntax prüfen**

Run: `node --check app/app.js`
Expected: Exit 0.

Hinweis: Der Karten-Screen ist erst nach Task 5 (Dashboard) per UI erreichbar. Hier genügt `node --check` + Review; der End-to-End-Browsertest erfolgt in Task 5.

- [ ] **Step 5: Commit**

```bash
git add app/app.js app/styles.css
git commit -m "feat: Übungs-Session-Engine + Karten-Screen mit Sofort-Feedback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Modus-Umschalter + Level-Üben-Dashboard

**Files:**
- Modify: `app/app.js`, `app/styles.css`

- [ ] **Step 1: Modus-State + Umschalter in `zeigeGuertelauswahl`**

`zeigeGuertelauswahl` ersetzen durch:
```javascript
  function zeigeGuertelauswahl() {
    leeren();
    state.session = null;
    if (!state.modus) state.modus = "pruefung";
    var hoechster = state.fortschritt.hoechsterGuertel;
    var html = '<header class="kopf"><h1>HPP-Prüfungstraining</h1>' +
      '<p class="sub">' + EXAM.titel + ' · 28 Fragen</p></header>' +
      '<div class="seg">' +
      '<button class="' + (state.modus === "pruefung" ? "on" : "") + '" data-modus="pruefung">Prüfung</button>' +
      '<button class="' + (state.modus === "ueben" ? "on" : "") + '" data-modus="ueben">Üben</button>' +
      '</div>' +
      '<p class="sub2">Wähle dein Level</p><div class="guertelliste">';
    var heute = L.heuteIso();
    L.GUERTEL.forEach(function (g) {
      var frei = L.istFreigeschaltet(g, hoechster);
      var badge = "";
      if (frei && state.modus === "ueben") {
        var n = window.HPP_SRS.anzahlFaellig(srs, g, heute);
        badge = '<span class="badge' + (n > 0 ? "" : " zero") + '">' + n + ' fällig</span>';
      } else if (!frei) { badge = '<span class="lock">🔒</span>'; }
      html += '<button class="guertel' + (frei ? "" : " locked") + '" ' +
        (frei ? 'data-guertel="' + g + '"' : "disabled") + '>' +
        '<span class="punkt" style="background:var(--g-' + g + ')"></span>' +
        '<span class="gname">' + LABELS[g] + '</span>' + badge + '</button>';
    });
    html += "</div>";
    app.innerHTML = html;
    app.querySelectorAll("[data-modus]").forEach(function (el) {
      el.addEventListener("click", function () { state.modus = el.getAttribute("data-modus"); zeigeGuertelauswahl(); });
    });
    app.querySelectorAll("[data-guertel]").forEach(function (el) {
      el.addEventListener("click", function () {
        var g = el.getAttribute("data-guertel");
        if (state.modus === "ueben") zeigeDashboard(g); else starteValidierung(g);
      });
    });
  }
```

- [ ] **Step 2: Dashboard-View einfügen** (vor dem `window.HPP_APP`-Export)

```javascript
  function zeigeDashboard(level) {
    leeren();
    var heute = L.heuteIso();
    var faellig = window.HPP_SRS.anzahlFaellig(srs, level, heute);
    var html = '<div class="dash">' +
      '<div class="ov-top">' + homeButtonHtml(level) + '<h2 class="ov-title">' + LABELS[level] + ' üben</h2></div>';
    if (faellig > 0) {
      html += '<div class="hero"><div><div class="hero-big">' + faellig + '</div><div class="hero-lbl">heute fällig</div></div>' +
        '<button class="hero-btn" id="dash-due">Jetzt üben ›</button></div>';
    } else {
      html += '<div class="hero hero-leer"><div><div class="hero-lbl2">Heute nichts fällig 🎉</div></div>' +
        '<button class="hero-btn" id="dash-due">Trotzdem üben ›</button></div>';
    }
    html += '<button class="row" id="dash-alle">Alle Fragen durchgehen <span class="chev">›</span></button>';
    html += '<div class="sec">Themenbereiche</div><div class="thlist">';
    THEMEN.forEach(function (t) {
      var nf = window.HPP_SRS.anzahlFaellig(srs, level, heute, t.id);
      var q = window.HPP_SRS.trefferquote(srs, level, t.id);
      var qtxt = (q === null) ? "—" : Math.round(q * 100) + "%";
      html += '<button class="th" data-thema="' + t.id + '"><span class="th-nm">' + escape(t.label) + '</span>' +
        '<span class="th-meta"><span class="th-due' + (nf > 0 ? "" : " zero") + '">' + nf + ' fällig</span>' +
        '<span class="th-q">' + qtxt + '</span></span></button>';
    });
    html += '</div></div>';
    app.innerHTML = html;
    app.querySelector("#dash-due").addEventListener("click", function () {
      var karten = window.HPP_SRS.faellige(srs, level, L.heuteIso());
      if (!karten.length) karten = alleKartenDesLevels(level);
      starteSession(karten, level, "faellig", function () { zeigeDashboard(level); });
    });
    app.querySelector("#dash-alle").addEventListener("click", function () {
      starteSession(alleKartenDesLevels(level), level, "alle", function () { zeigeDashboard(level); });
    });
    app.querySelectorAll("[data-thema]").forEach(function (el) {
      el.addEventListener("click", function () {
        var tid = el.getAttribute("data-thema");
        var karten = window.HPP_SRS.faellige(srs, level, L.heuteIso(), tid);
        if (!karten.length) karten = alleKartenDesLevels(level, tid);
        starteSession(karten, level, "thema:" + tid, function () { zeigeDashboard(level); });
      });
    });
    bindHome();
  }
```

- [ ] **Step 3: CSS für Umschalter + Dashboard anhängen** (`app/styles.css`)

```css
.dash { display: flex; flex-direction: column; flex: 1; min-height: 0; padding-top: 16px; }
.app:has(> .dash) { height: 100dvh; overflow: hidden; }
.seg { display: flex; background: #ece9e3; border-radius: 12px; padding: 4px; margin: 4px 0 4px; }
.seg button { flex: 1; border: none; background: none; font-size: 15px; font-weight: 700; padding: 10px; border-radius: 9px; color: var(--muted); }
.seg button.on { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.guertel .badge { margin-left: auto; font-size: 12px; font-weight: 700; color: var(--accent); background: var(--accent-soft); padding: 3px 10px; border-radius: 20px; }
.guertel .badge.zero { color: var(--muted); background: #efede8; }
.hero { background: var(--accent); color: #fff; border-radius: 16px; padding: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 14px; }
.hero-big { font-size: 32px; font-weight: 800; line-height: 1; }
.hero-lbl { font-size: 13px; opacity: .92; margin-top: 2px; }
.hero-lbl2 { font-size: 16px; font-weight: 700; }
.hero-leer { background: #5a7184; }
.hero-btn { margin-left: auto; background: #fff; color: var(--accent); font-weight: 700; border: none; padding: 11px 14px; border-radius: 11px; font-size: 14px; white-space: nowrap; }
.hero-leer .hero-btn { color: #5a7184; }
.row { display: flex; align-items: center; width: 100%; text-align: left; background: var(--card); border: 1.5px solid var(--line); border-radius: 12px; padding: 0 14px; height: 50px; margin-bottom: 12px; font-size: 14px; font-weight: 600; color: var(--ink); }
.row .chev { margin-left: auto; color: var(--muted); }
.thlist { overflow: auto; flex: 1; min-height: 0; padding-bottom: 14px; }
.th { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; background: var(--card); border: 1px solid var(--line); border-radius: 11px; padding: 0 12px; height: 54px; margin-bottom: 8px; }
.th-nm { font-weight: 600; font-size: 13px; line-height: 1.2; }
.th-meta { margin-left: auto; text-align: right; white-space: nowrap; }
.th-due { display: block; color: var(--accent); font-weight: 700; font-size: 12px; }
.th-due.zero { color: var(--muted); font-weight: 600; }
.th-q { display: block; color: var(--muted); font-size: 11px; }
```

Das Dashboard nutzt die eigene Klasse `.dash` (nicht `.ov`), damit die Prüfungs-Übersicht
(`.ov`) unberührt bleibt. `.app:has(> .dash)` begrenzt die Höhe, `.thlist` (flex:1, overflow:auto)
scrollt darin; Hero/„Alle durchgehen"/Abschnitts-Header bleiben oben fix.

- [ ] **Step 4: End-to-End im Browser** (Cache-Bust `?v=t5` für `app.js`, `srs.js`, `styles.css` in `index.html`; danach zurücksetzen)

Server: `python3 -m http.server` (oder vorhandener Dev-Server). Checkliste:
- Startseite: Umschalter Prüfung/Üben; im Üben-Modus „N fällig"-Badges.
- „Üben" + Level 1 → Dashboard (Hero, „Alle Fragen durchgehen", 12 Themenbereiche scrollbar).
- „Alle Fragen durchgehen" → Karten-Session: antworten → „Prüfen" → Optionen markiert, Feedback + Wissenskern unten, „Kommt … wieder · Streak", „Weiter".
- Falsch → Karte kommt später in der Session nochmal; nach Durchlauf zurück zum Dashboard.
- Reload: „N fällig" spiegelt die zuvor falsch beantworteten Karten (localStorage `hpp_srs`).

- [ ] **Step 5: Commit**

```bash
git add app/app.js app/styles.css
git commit -m "feat: Modus-Umschalter + Level-Üben-Dashboard, Sessions angebunden

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Prüfungs-Seeding der Fehlerkarten

**Files:**
- Modify: `app/app.js`

- [ ] **Step 1: In `abgeben` falsche Antworten als Karten seeden**

In `abgeben` direkt nach `var richtig = zaehleRichtige();` einfügen:
```javascript
    seedePruefungsfehler(p);
```
Und die Funktion einfügen (vor dem `window.HPP_APP`-Export):
```javascript
  function seedePruefungsfehler(p) {
    var heute = L.heuteIso();
    EXAM.fragen.forEach(function (frage) {
      var stufe = frage.stufen[p.guertel];
      var gewaehlt = p.antworten[frage.nr] || [];
      if (!L.istRichtig(gewaehlt, stufe.loesung)) {
        window.HPP_SRS.seedFalsch(srs, p.guertel, frage.nr, p.guertel, heute);
        // thema nachtragen, falls leer (seedFalsch kennt es nicht)
        var id = window.HPP_SRS.kartenId(p.guertel, frage.nr, p.guertel);
        if (srs.karten[id] && !srs.karten[id].thema) srs.karten[id].thema = frage.themenbereich;
      }
    });
    srsSpeichern();
  }
```
Hinweis: Der Prüfungsmodus nutzt `EXAM` (2026-03); `examId` der geseedeten Karten ist daher `"2026-03"` — passt zur Pool-Identität.

Wichtig — `EXAM`-`examId`: für `seedFalsch` wird als `examId` die Prüfungs-ID benötigt. Ersetze im obigen Code `p.guertel, frage.nr, p.guertel` für den `examId`-Parameter NICHT mit dem Level. Korrekt ist `seedFalsch(srs, "2026-03", frage.nr, p.guertel, heute)`. Verwende daher diese Zeile statt der obigen:
```javascript
        window.HPP_SRS.seedFalsch(srs, "2026-03", frage.nr, p.guertel, heute);
        var id = window.HPP_SRS.kartenId("2026-03", frage.nr, p.guertel);
```

- [ ] **Step 2: Syntax**

Run: `node --check app/app.js`
Expected: Exit 0.

- [ ] **Step 3: Browser-Test** (Cache-Bust `?v=t6`)
- Prüfung Level 1 mit ein paar absichtlich falschen Antworten abgeben → zurück zur Startseite → Üben-Modus: Level-1-Badge „N fällig" zeigt genau die Anzahl falscher Prüfungsantworten; im Dashboard erscheinen diese Karten unter „heute fällig" (bzw. morgen fällig → erst ab morgen; für den Test `seedFalsch` setzt due = morgen, daher heute 0 — siehe Hinweis).

Hinweis zur Erwartung: `seedFalsch` setzt `due = morgen`, d. h. Prüfungsfehler sind **ab dem Folgetag** fällig (bewusst). Für den Sicht-Test heute: in der Konsole `HPP_APP.state` … bzw. die Karten in `JSON.parse(localStorage.hpp_srs).karten` prüfen (Einträge mit `examId 2026-03`, `due = morgen`).

- [ ] **Step 4: Commit**

```bash
git add app/app.js
git commit -m "feat: Prüfungsfehler erzeugen fällige Übungskarten (Seeding)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Abschluss-Verifikation

**Files:** keine Änderung.

- [ ] **Step 1: Alle Logik-/Modul-Tests**

Run: `node --test app/logic.test.js app/srs.test.js`
Expected: alle grün (logic: bisherige + 5 neue; srs: 8).

- [ ] **Step 2: Syntax**

Run: `node --check app/app.js && node --check app/logic.js && node --check app/srs.js`
Expected: kein Fehler.

- [ ] **Step 3: index.html sauber**

Run: `git diff --stat app/index.html`
Expected: keine Ausgabe (kein verbliebener `?v=`-Cache-Bust außer dem gewollten `srs.js`-Script-Tag).
(`app/index.html` muss `data.js`, `logic.js`, `srs.js`, `app.js` ohne `?v=` laden.)

- [ ] **Step 4: End-to-End-Durchlauf im Browser**
- Üben-Modus: Dashboard, „Alle durchgehen", Themenbereich-Drill, Sofort-Feedback (Layout stabil, wächst nach unten), Meisterung nach 4× richtig (Karte verschwindet aus „fällig"), Trefferquote aktualisiert sich, Prüfungsfehler erscheinen als Karten. Prüfungsmodus unverändert funktionsfähig. Keine Konsolenfehler.

- [ ] **Step 5: Push**

```bash
git push origin main
```

---

## Hinweise

- `examId` der Karten ist die Prüfungs-ID (`"2026-03"`/`"2025-10"`), das Level steckt separat im Schlüssel `examId|nr|level`. Üben poolt über alle `guertel_komplett`-Prüfungen; der Prüfungsmodus spielt weiterhin nur 2026-03 (Auswahl mehrerer Prüfungen im Prüfungsmodus ist späteres Thema).
- Borderline-Themenzuordnungen (z. B. Miosis/Opioide → sucht, sek. Krankheitsgewinn → angst) sind bewusst gesetzt und später leicht in `daten/zuordnung_themenbereiche.py` anpassbar (Skript + build erneut ausführen).
- März 2025 bleibt bis zur Datenkorrektur außen vor (`guertel_komplett:false`) und kommt danach automatisch in den Pool.
