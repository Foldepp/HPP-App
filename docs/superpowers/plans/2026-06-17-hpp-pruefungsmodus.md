# HPP-Prüfungsmodus mit Gürtelauswahl — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine offline (per Doppelklick) lauffähige Vanilla-JS-Lern-App: Gürtelauswahl + vollständiger Prüfungsmodus (28 Fragen, 60-Min-Timer, Auswertung 21/28, Durchsicht) mit localStorage-Fortschritt und Gürtel-Freischaltung.

**Architecture:** Statisches `app/index.html` lädt `styles.css`, `logic.js` (reine, testbare Funktionen), `data.js` (JS-Wrap der JSON-Daten, kein `fetch`) und `app.js` (Views/DOM/State). Reine Logik wird mit `node --test` getestet; die UI wird im Browser manuell verifiziert. Daten werden reproduzierbar aus `daten/` per `build_data.py` nach `app/data.js` generiert.

**Tech Stack:** Vanilla HTML/CSS/JS (kein Build, keine Frameworks), Node `node:test`/`node:assert` für Logik-Tests, Python 3 für das Daten-Build-Skript, `localStorage`.

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `daten/build_data.py` | Liest `daten/index.json` + `daten/fragen_2026-03.json`, schreibt `app/data.js` (`window.HPP_DATA = {…}`). Quelle der Wahrheit bleibt `daten/`. |
| `app/data.js` | **Generiert.** `window.HPP_DATA = { index, exams: { "2026-03": {…} } }`. Nie von Hand editieren. |
| `app/logic.js` | Reine Funktionen ohne DOM: Gürtel-Reihenfolge, Auswertung, Bestehen, Freischaltung, Mehrfach-Erkennung. UMD-Muster, damit Browser (`<script>`) **und** Node (`require`) sie laden. |
| `app/logic.test.js` | `node:test`-Tests für `logic.js`. |
| `app/styles.css` | Farbsystem (CSS-Variablen, Dark-Mode-vorbereitet) + Mobile-first-Layout, scrollfreier Frage-Screen. |
| `app/app.js` | Views (Gürtelauswahl, Prüfung, Übersicht, Auswertung, Durchsicht), State, Timer, localStorage, Event-Handling. |
| `app/index.html` | Grundgerüst, lädt `styles.css` + `data.js` + `logic.js` + `app.js`. |

**Globale Konstanten (in `logic.js` definiert, überall genutzt):**
`GUERTEL = ["gelb","gruen","blau","braun","schwarz"]`, `ANZAHL_FRAGEN = 28`, `BESTEHENSGRENZE = 21`.

---

## Task 1: Projekt-Setup & Git

**Files:**
- Create: `.gitignore` (ergänzen, falls vorhanden)

- [ ] **Step 1: Git initialisieren (falls noch nicht geschehen)**

Run:
```bash
git rev-parse --is-inside-work-tree 2>/dev/null || git -C /Users/cwick/projects/HPP-App init
```
Expected: entweder `true` oder `Initialized empty Git repository …`

- [ ] **Step 2: `.gitignore` um Brainstorm-Artefakte ergänzen**

Sicherstellen, dass diese Zeilen in `.gitignore` stehen (vorhandene Zeilen unangetastet lassen):
```
.DS_Store
.superpowers/
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore für .superpowers und .DS_Store"
```

---

## Task 2: Daten-Build-Skript (`build_data.py` → `app/data.js`)

**Files:**
- Create: `daten/build_data.py`
- Create (generiert): `app/data.js`

- [ ] **Step 1: `daten/build_data.py` schreiben**

```python
#!/usr/bin/env python3
"""Erzeugt app/data.js (JS-Wrap) aus den JSON-Daten in daten/.
Reproduzierbar: bei neuen uebersetzten Pruefungen erneut ausfuehren.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATEN = ROOT / "daten"
ZIEL = ROOT / "app" / "data.js"

def main():
    index = json.loads((DATEN / "index.json").read_text(encoding="utf-8"))
    exams = {}
    for exam in index["exams"]:
        if not exam.get("guertel_komplett"):
            continue
        daten = json.loads((DATEN / exam["datei"]).read_text(encoding="utf-8"))
        exams[exam["id"]] = daten
    payload = {"index": index, "exams": exams}
    js = "window.HPP_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n"
    ZIEL.write_text(js, encoding="utf-8")
    print(f"geschrieben: {ZIEL} ({len(exams)} Pruefung(en): {', '.join(exams)})")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Skript ausführen und Ergebnis prüfen**

Run:
```bash
python3 daten/build_data.py && node -e "global.window={}; require('./app/data.js'); const d=window.HPP_DATA; console.log('exams:', Object.keys(d.exams)); console.log('fragen:', d.exams['2026-03'].fragen.length); console.log('frage1 stufen:', Object.keys(d.exams['2026-03'].fragen[0].stufen));"
```
Expected:
```
geschrieben: .../app/data.js (1 Pruefung(en): 2026-03)
exams: [ '2026-03' ]
fragen: 28
frage1 stufen: [ 'gelb', 'gruen', 'blau', 'braun', 'schwarz' ]
```

- [ ] **Step 3: Commit**

```bash
git add daten/build_data.py app/data.js
git commit -m "feat: build_data.py erzeugt app/data.js (JS-Wrap der Daten)"
```

---

## Task 3: Reine Logik + Tests (`logic.js`)

**Files:**
- Create: `app/logic.js`
- Test: `app/logic.test.js`

- [ ] **Step 1: Failing Tests schreiben**

`app/logic.test.js`:
```javascript
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
  // bestanden auf gelb -> gruen frei
  assert.strictEqual(L.naechsterHoechster("gelb", "gelb", 23), "gruen");
  // nicht bestanden -> bleibt
  assert.strictEqual(L.naechsterHoechster("gelb", "gelb", 20), "gelb");
  // bestanden auf bereits niedrigerer Stufe -> kein Rueckschritt
  assert.strictEqual(L.naechsterHoechster("braun", "gelb", 28), "braun");
  // bestanden auf schwarz -> bleibt schwarz (kein hoeherer)
  assert.strictEqual(L.naechsterHoechster("schwarz", "schwarz", 28), "schwarz");
});

test("erwarteMehrfach: an loesung.length, nicht am Typ-Label", () => {
  assert.strictEqual(L.erwarteMehrfach(["B", "C"]), true);
  assert.strictEqual(L.erwarteMehrfach(["A"]), false); // Schwarz-Frage 1: typ=Mehrfachauswahl, loesung=["A"]
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `node --test app/logic.test.js`
Expected: FAIL (`Cannot find module './logic.js'` bzw. undefined-Funktionen)

- [ ] **Step 3: `app/logic.js` implementieren**

```javascript
(function (root) {
  "use strict";

  var GUERTEL = ["gelb", "gruen", "blau", "braun", "schwarz"];
  var ANZAHL_FRAGEN = 28;
  var BESTEHENSGRENZE = 21;

  function istRichtig(gewaehlt, loesung) {
    if (gewaehlt.length !== loesung.length) return false;
    var a = gewaehlt.slice().sort().join(",");
    var b = loesung.slice().sort().join(",");
    return a === b;
  }

  function bestanden(richtigeAnzahl) {
    return richtigeAnzahl >= BESTEHENSGRENZE;
  }

  function istFreigeschaltet(guertel, hoechster) {
    return GUERTEL.indexOf(guertel) <= GUERTEL.indexOf(hoechster);
  }

  function naechsterHoechster(hoechster, gespielter, richtigeAnzahl) {
    if (!bestanden(richtigeAnzahl)) return hoechster;
    var neu = GUERTEL.indexOf(gespielter) + 1;
    var kandidat = neu < GUERTEL.length ? GUERTEL[neu] : gespielter;
    // nie zurueckstufen
    return GUERTEL.indexOf(kandidat) > GUERTEL.indexOf(hoechster) ? kandidat : hoechster;
  }

  function erwarteMehrfach(loesung) {
    return loesung.length >= 2;
  }

  var api = {
    GUERTEL: GUERTEL,
    ANZAHL_FRAGEN: ANZAHL_FRAGEN,
    BESTEHENSGRENZE: BESTEHENSGRENZE,
    istRichtig: istRichtig,
    bestanden: bestanden,
    istFreigeschaltet: istFreigeschaltet,
    naechsterHoechster: naechsterHoechster,
    erwarteMehrfach: erwarteMehrfach,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.HPP_LOGIC = api;
  }
})(typeof window !== "undefined" ? window : this);
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `node --test app/logic.test.js`
Expected: PASS (alle Tests grün)

- [ ] **Step 5: Commit**

```bash
git add app/logic.js app/logic.test.js
git commit -m "feat: reine Quiz-Logik mit node:test-Tests"
```

---

## Task 4: Grundgerüst `index.html` + Farbsystem `styles.css`

**Files:**
- Create: `app/index.html`
- Create: `app/styles.css`

- [ ] **Step 1: `app/index.html` schreiben**

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>HPP-Prüfungstraining</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app" class="app"></div>
  <script src="data.js"></script>
  <script src="logic.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: `app/styles.css` mit Farbsystem + Basis-Layout schreiben**

```css
:root {
  --bg: #f7f6f3; --card: #fff; --ink: #1c2730; --muted: #8794a0;
  --line: #e6e3dc; --accent: #3aa655; --accent-soft: #e7f3ec; --warn: #c2410c; --ink-soft: #f0eee9;
  --g-gelb: #f2c200; --g-gruen: #3aa655; --g-blau: #2b6cb0; --g-braun: #8b5e3c; --g-schwarz: #26303a;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; height: 100%; }
body {
  background: var(--bg); color: var(--ink);
  font-family: -apple-system, system-ui, sans-serif;
  font-size: 17px; line-height: 1.4;
}
.app {
  max-width: 480px; margin: 0 auto; min-height: 100%;
  display: flex; flex-direction: column;
  padding: env(safe-area-inset-top) 16px env(safe-area-inset-bottom);
}
button { font: inherit; cursor: pointer; }
.btn {
  border: 1.5px solid var(--line); background: var(--card); color: var(--ink);
  padding: 14px 20px; border-radius: 14px; font-weight: 600;
}
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn-dark { background: var(--ink); border-color: var(--ink); color: #fff; }
.hidden { display: none !important; }
```

- [ ] **Step 3: Im Browser öffnen und prüfen**

Run: `open app/index.html`
Expected: Leere helle Seite, keine Konsolenfehler (in der Browser-Konsole prüfen, dass `data.js`/`logic.js` geladen sind: `window.HPP_DATA` und `window.HPP_LOGIC` definiert).

- [ ] **Step 4: Commit**

```bash
git add app/index.html app/styles.css
git commit -m "feat: index.html-Grundgeruest + Farbsystem (CSS-Variablen)"
```

---

## Task 5: View-Router + Gürtelauswahl + localStorage

**Files:**
- Create: `app/app.js`
- Modify: `app/styles.css` (Gürtelauswahl-Stile ergänzen)

- [ ] **Step 1: `app/app.js` mit State, localStorage und View-Router anlegen**

```javascript
(function () {
  "use strict";
  var L = window.HPP_LOGIC;
  var DATA = window.HPP_DATA;
  var EXAM = DATA.exams["2026-03"];
  var LABELS = DATA.index.guertel_labels;
  var app = document.getElementById("app");

  var SPEICHER = "hpp_progress";
  function ladeFortschritt() {
    try {
      var roh = JSON.parse(localStorage.getItem(SPEICHER));
      if (roh && typeof roh.hoechsterGuertel === "string") return roh;
    } catch (e) {}
    return { hoechsterGuertel: "gelb", ergebnisse: [] };
  }
  function speichereFortschritt(f) {
    try { localStorage.setItem(SPEICHER, JSON.stringify(f)); } catch (e) {}
  }

  var state = { fortschritt: ladeFortschritt() };

  function leeren() { app.innerHTML = ""; }

  function zeigeGuertelauswahl() {
    leeren();
    var hoechster = state.fortschritt.hoechsterGuertel;
    var html = '<header class="kopf"><h1>HPP-Prüfungstraining</h1>' +
      '<p class="sub">' + EXAM.titel + ' · 28 Fragen</p></header>' +
      '<p class="sub2">Wähle deinen Gürtel</p><div class="guertelliste">';
    L.GUERTEL.forEach(function (g) {
      var frei = L.istFreigeschaltet(g, hoechster);
      html += '<button class="guertel' + (frei ? "" : " locked") + '" ' +
        (frei ? 'data-guertel="' + g + '"' : "disabled") + '>' +
        '<span class="punkt" style="background:var(--g-' + g + ')"></span>' +
        '<span class="gname">' + LABELS[g] + '</span>' +
        (frei ? "" : '<span class="lock">🔒</span>') + '</button>';
    });
    html += "</div>";
    app.innerHTML = html;
    app.querySelectorAll("[data-guertel]").forEach(function (el) {
      el.addEventListener("click", function () {
        starteValidierung(el.getAttribute("data-guertel"));
      });
    });
  }

  // Platzhalter bis Task 6 — zeigt vorerst nur den gewaehlten Guertel
  function starteValidierung(guertel) {
    alert("Starte Prüfung: " + LABELS[guertel]); // wird in Task 6 ersetzt
  }

  // Export fuer spaetere Tasks
  window.HPP_APP = {
    state: state,
    speichereFortschritt: speichereFortschritt,
    zeigeGuertelauswahl: zeigeGuertelauswahl,
  };

  zeigeGuertelauswahl();
})();
```

- [ ] **Step 2: Gürtelauswahl-Stile in `app/styles.css` ergänzen**

```css
.kopf h1 { font-size: 22px; margin: 18px 0 2px; }
.sub { color: var(--muted); font-size: 14px; margin: 0; }
.sub2 { font-weight: 600; margin: 22px 0 12px; font-size: 18px; }
.guertelliste { display: flex; flex-direction: column; gap: 12px; }
.guertel {
  display: flex; align-items: center; gap: 14px; width: 100%; text-align: left;
  background: var(--card); border: 1.5px solid var(--line); border-radius: 14px; padding: 18px 16px;
}
.guertel .punkt { width: 28px; height: 28px; border-radius: 50%; flex: none; box-shadow: inset 0 0 0 2px rgba(0,0,0,.08); }
.guertel .gname { font-weight: 600; font-size: 18px; }
.guertel .lock { margin-left: auto; }
.guertel.locked { opacity: .5; }
```

- [ ] **Step 3: Im Browser prüfen**

Run: `open app/index.html`
Expected: Fünf Gürtel; Gelb anwählbar, Grün–Schwarz mit 🔒 (Default-Fortschritt). Klick auf Gelb → Alert „Starte Prüfung: Gelb". Konsole: `localStorage.setItem('hpp_progress', JSON.stringify({hoechsterGuertel:'braun'}))` + Reload → Gelb–Braun frei, Schwarz gesperrt.

- [ ] **Step 4: Commit**

```bash
git add app/app.js app/styles.css
git commit -m "feat: Gürtelauswahl-View mit localStorage-Freischaltung"
```

---

## Task 6: Prüfungs-State + Frage-Screen (drei Fragetypen)

**Files:**
- Modify: `app/app.js` (Prüfungs-State + Render der Frage)
- Modify: `app/styles.css` (Frage-Screen-Stile)

- [ ] **Step 1: `starteValidierung`-Platzhalter durch echten Prüfungs-State ersetzen**

In `app/app.js` die Platzhalterfunktion `starteValidierung` ersetzen und Prüfungs-Funktionen ergänzen (vor dem `window.HPP_APP`-Export einfügen):

```javascript
  function starteValidierung(guertel) {
    state.pruefung = {
      guertel: guertel,
      antworten: {},      // { nr: [Buchstaben] }
      index: 0,           // aktueller Frageindex 0..27
    };
    zeigeFrage();
  }

  function aktuelleStufe() {
    var frage = EXAM.fragen[state.pruefung.index];
    return { frage: frage, stufe: frage.stufen[state.pruefung.guertel] };
  }

  function zeigeFrage() {
    leeren();
    var p = state.pruefung;
    var s = aktuelleStufe();
    var stufe = s.stufe, frage = s.frage;
    var gewaehlt = p.antworten[frage.nr] || [];
    var mehrfach = L.erwarteMehrfach(stufe.loesung);

    var html = '<div class="ex">';
    // Kopf
    html += '<div class="ex-top">' +
      '<span class="ex-belt"><span class="punkt-s" style="background:var(--g-' + p.guertel + ')"></span></span>' +
      '<span class="ex-count">' + (p.index + 1) + ' / ' + L.ANZAHL_FRAGEN + '</span>' +
      '<span class="ex-timer" id="timer">60:00</span></div>';
    html += '<div class="ex-bar"><i style="width:' + ((p.index + 1) / L.ANZAHL_FRAGEN * 100) + '%"></i></div>';
    // Body (scrollbarer Bereich nur fuer Stamm+Aussagen)
    html += '<div class="ex-body"><div class="ex-scroll">';
    html += '<p class="ex-stamm">' + escape(stufe.stamm) + '</p>';
    if (stufe.aussagen) {
      html += '<ol class="aussagen">';
      Object.keys(stufe.aussagen).forEach(function (k) {
        html += '<li><b>' + k + '.</b> ' + escape(stufe.aussagen[k]) + '</li>';
      });
      html += '</ol>';
    }
    if (mehrfach) html += '<p class="ex-hint">Wählen Sie zwei Antworten!</p>';
    html += '</div>'; // ex-scroll Ende
    // Optionen
    html += '<div class="ex-opts">';
    Object.keys(stufe.optionen).forEach(function (b) {
      var sel = gewaehlt.indexOf(b) >= 0 ? " sel" : "";
      html += '<button class="ex-opt' + sel + '" data-opt="' + b + '">' +
        '<span class="ltr">' + b + '</span><span class="t">' + escape(stufe.optionen[b]) + '</span></button>';
    });
    html += '</div></div>'; // ex-opts, ex-body Ende
    // Fuss
    html += '<div class="ex-foot">' +
      '<button class="ex-nav-ov" id="btn-ov">▦ Übersicht</button>' +
      (p.index > 0 ? '<button class="btn" id="btn-prev">‹</button>' : "") +
      '<button class="btn btn-primary ex-next" id="btn-next">' +
      (p.index === L.ANZAHL_FRAGEN - 1 ? "Abgeben" : "Weiter ›") + '</button></div>';
    html += "</div>";
    app.innerHTML = html;

    // Option-Klicks
    app.querySelectorAll("[data-opt]").forEach(function (el) {
      el.addEventListener("click", function () {
        waehle(frage.nr, el.getAttribute("data-opt"), mehrfach);
      });
    });
    app.querySelector("#btn-next").addEventListener("click", weiter);
    var prev = app.querySelector("#btn-prev");
    if (prev) prev.addEventListener("click", zurueck);
    app.querySelector("#btn-ov").addEventListener("click", zeigeUebersicht);
  }

  function waehle(nr, buchstabe, mehrfach) {
    var akt = state.pruefung.antworten[nr] || [];
    if (mehrfach) {
      var i = akt.indexOf(buchstabe);
      if (i >= 0) akt = akt.filter(function (x) { return x !== buchstabe; });
      else if (akt.length < 2) akt = akt.concat([buchstabe]); // max zwei
    } else {
      akt = [buchstabe];
    }
    state.pruefung.antworten[nr] = akt;
    zeigeFrage();
  }

  function weiter() {
    if (state.pruefung.index === L.ANZAHL_FRAGEN - 1) { abgeben(); return; }
    state.pruefung.index++;
    zeigeFrage();
  }
  function zurueck() {
    if (state.pruefung.index > 0) state.pruefung.index--;
    zeigeFrage();
  }

  function escape(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  // Platzhalter bis Task 8/7 (in spaeteren Tasks ersetzt)
  function abgeben() { alert("Abgeben — kommt in Task 8"); }
  function zeigeUebersicht() { alert("Übersicht — kommt in Task 7"); }
```

- [ ] **Step 2: Frage-Screen-Stile in `app/styles.css` ergänzen (scrollfreies Vollhöhen-Layout)**

```css
.ex { display: flex; flex-direction: column; flex: 1; min-height: 100vh; padding-top: 8px; }
.ex-top { display: flex; align-items: center; justify-content: space-between; }
.punkt-s { width: 18px; height: 18px; border-radius: 50%; display: inline-block; box-shadow: inset 0 0 0 2px rgba(0,0,0,.1); }
.ex-count { font-weight: 700; font-size: clamp(15px, 4.5vw, 18px); }
.ex-timer { font-variant-numeric: tabular-nums; font-weight: 700; font-size: clamp(15px, 4.5vw, 18px); }
.ex-timer.low { color: var(--warn); }
.ex-bar { height: 5px; background: var(--line); border-radius: 3px; margin: 10px 0 0; overflow: hidden; }
.ex-bar > i { display: block; height: 100%; background: var(--accent); }
.ex-body { flex: 1; display: flex; flex-direction: column; min-height: 0; padding-top: 14px; }
.ex-scroll { overflow: auto; min-height: 0; }
.ex-stamm { font-size: clamp(17px, 5.2vw, 21px); font-weight: 600; margin: 0 0 16px; line-height: 1.35; }
.aussagen { list-style: none; padding: 12px 14px; margin: 0 0 14px; background: #faf9f6; border: 1px solid var(--line); border-radius: 10px; }
.aussagen li { margin: 4px 0; font-size: clamp(14px, 4vw, 16px); }
.ex-hint { color: var(--warn); font-weight: 600; font-size: 14px; margin: 0 0 10px; }
.ex-opts { display: flex; flex-direction: column; gap: 10px; margin-top: auto; padding-top: 12px; }
.ex-opt { display: flex; align-items: center; gap: 12px; text-align: left; width: 100%;
  background: var(--card); border: 1.5px solid var(--line); border-radius: 14px; padding: 14px 14px; }
.ex-opt .ltr { width: 28px; height: 28px; border-radius: 8px; background: var(--ink-soft); flex: none;
  display: flex; align-items: center; justify-content: center; font-weight: 700; color: #5a6772; }
.ex-opt .t { font-size: clamp(15px, 4.3vw, 17px); line-height: 1.3; }
.ex-opt.sel { border-color: var(--accent); background: var(--accent-soft); }
.ex-opt.sel .ltr { background: var(--accent); color: #fff; }
.ex-foot { display: flex; align-items: center; gap: 10px; padding: 12px 0; }
.ex-nav-ov { background: none; border: none; color: var(--muted); font-weight: 600; }
.ex-next { flex: 1; }
```

- [ ] **Step 3: Im Browser prüfen (alle drei Typen)**

Run: `open app/index.html`
Expected: Gelb wählen → Frage 1 (Einfachauswahl): eine Option wählbar, Auswahl grün, Reklick wechselt. Durchklicken bis zu einer Aussagenkombination (Aussagenblock sichtbar, eine Kombi-Option). Für Mehrfach-Test: Schwarz ist gesperrt — daher in der Konsole `localStorage.setItem('hpp_progress', JSON.stringify({hoechsterGuertel:'schwarz'}))`, Reload, Schwarz wählen → eine Frage mit echtem Mehrfach-Verhalten (z. B. mit `loesung.length===2`) zeigt „Wählen Sie zwei!" und lässt genau zwei Optionen zu. Schwarz-Frage 1 (`loesung:["A"]`) zeigt **keinen** Hinweis und nur Einzelauswahl. Fenster auf iPhone-Breite (~390px) schmal ziehen: Optionen + Navigation ohne Scrollen sichtbar.

- [ ] **Step 4: Commit**

```bash
git add app/app.js app/styles.css
git commit -m "feat: Prüfungs-Frage-Screen mit allen drei Fragetypen, scrollfrei"
```

---

## Task 7: Fragen-Übersicht (Sheet)

**Files:**
- Modify: `app/app.js` (`zeigeUebersicht` echt implementieren)
- Modify: `app/styles.css` (Raster-Stile)

- [ ] **Step 1: `zeigeUebersicht`-Platzhalter ersetzen**

In `app/app.js` die Platzhalterfunktion `zeigeUebersicht` ersetzen:

```javascript
  function zeigeUebersicht() {
    leeren();
    var p = state.pruefung;
    var beantwortet = Object.keys(p.antworten).filter(function (nr) {
      return (p.antworten[nr] || []).length > 0;
    }).length;
    var html = '<div class="ov">' +
      '<h2 class="ov-title">Übersicht</h2>' +
      '<p class="sub">' + beantwortet + ' von ' + L.ANZAHL_FRAGEN + ' beantwortet · tippen zum Springen</p>' +
      '<div class="ovgrid">';
    EXAM.fragen.forEach(function (frage, i) {
      var done = (p.antworten[frage.nr] || []).length > 0 ? " done" : "";
      var cur = i === p.index ? " cur" : "";
      html += '<button class="ovc' + done + cur + '" data-jump="' + i + '">' + (i + 1) + '</button>';
    });
    html += '</div><div class="ov-foot">' +
      '<button class="btn" id="ov-back">‹ Zurück</button>' +
      '<button class="btn btn-dark" id="ov-submit">Prüfung abgeben</button></div></div>';
    app.innerHTML = html;
    app.querySelectorAll("[data-jump]").forEach(function (el) {
      el.addEventListener("click", function () {
        state.pruefung.index = parseInt(el.getAttribute("data-jump"), 10);
        zeigeFrage();
      });
    });
    app.querySelector("#ov-back").addEventListener("click", zeigeFrage);
    app.querySelector("#ov-submit").addEventListener("click", abgeben);
  }
```

- [ ] **Step 2: Raster-Stile in `app/styles.css` ergänzen**

```css
.ov { display: flex; flex-direction: column; flex: 1; min-height: 100vh; padding-top: 16px; }
.ov-title { font-size: 22px; margin: 0 0 4px; }
.ovgrid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 16px 0; }
.ovc { aspect-ratio: 1; border: 1.5px solid var(--line); background: var(--card); border-radius: 12px;
  font-size: 18px; font-weight: 600; color: var(--muted); }
.ovc.done { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.ovc.cur { box-shadow: 0 0 0 2px var(--accent); color: var(--ink); }
.ov-foot { display: flex; gap: 10px; margin-top: auto; padding: 12px 0; }
.ov-foot .btn-dark { flex: 1; }
```

- [ ] **Step 3: Im Browser prüfen**

Run: `open app/index.html`
Expected: In der Prüfung „▦ Übersicht" → 5er-Raster, beantwortete Fragen grün, aktuelle mit Rahmen. Tippen auf eine Zahl springt zur Frage. „‹ Zurück" kehrt zur Frage zurück.

- [ ] **Step 4: Commit**

```bash
git add app/app.js app/styles.css
git commit -m "feat: Fragen-Übersicht mit Sprung-Navigation"
```

---

## Task 8: Abgeben, Auswertung & Gürtel-Freischaltung

**Files:**
- Modify: `app/app.js` (`abgeben` + `zeigeAuswertung` + Datum-Helper)
- Modify: `app/styles.css` (Auswertungs-Stile)

- [ ] **Step 1: `abgeben`-Platzhalter ersetzen und Auswertung ergänzen**

In `app/app.js` die Platzhalterfunktion `abgeben` ersetzen und folgende Funktionen ergänzen:

```javascript
  function zaehleRichtige() {
    var p = state.pruefung, richtig = 0;
    EXAM.fragen.forEach(function (frage) {
      var stufe = frage.stufen[p.guertel];
      var gewaehlt = p.antworten[frage.nr] || [];
      if (L.istRichtig(gewaehlt, stufe.loesung)) richtig++;
    });
    return richtig;
  }

  function heute() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function abgeben() {
    var p = state.pruefung;
    var offen = L.ANZAHL_FRAGEN - Object.keys(p.antworten).filter(function (nr) {
      return (p.antworten[nr] || []).length > 0;
    }).length;
    if (offen > 0 && !window.confirm(offen + " Frage(n) noch offen. Wirklich abgeben?")) return;

    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    var richtig = zaehleRichtige();
    var bestanden = L.bestanden(richtig);
    var vorher = state.fortschritt.hoechsterGuertel;
    var neu = L.naechsterHoechster(vorher, p.guertel, richtig);
    var freigeschaltet = neu !== vorher;
    state.fortschritt.hoechsterGuertel = neu;
    state.fortschritt.ergebnisse = (state.fortschritt.ergebnisse || []).concat([
      { guertel: p.guertel, richtig: richtig, datum: heute() }
    ]);
    speichereFortschritt(state.fortschritt);
    zeigeAuswertung(richtig, bestanden, freigeschaltet, neu);
  }

  function zeigeAuswertung(richtig, bestanden, freigeschaltet, neu) {
    leeren();
    var html = '<div class="erg">' +
      '<div class="erg-badge ' + (bestanden ? "ok" : "fail") + '">' +
      '<div class="erg-zahl">' + richtig + ' / ' + L.ANZAHL_FRAGEN + '</div>' +
      '<div class="erg-txt">' + (bestanden ? "Bestanden" : "Nicht bestanden") +
      ' · Grenze ' + L.BESTEHENSGRENZE + '</div></div>';
    if (freigeschaltet) {
      html += '<p class="erg-unlock">🎉 Neuer Gürtel freigeschaltet: <b>' + LABELS[neu] + '</b></p>';
    }
    html += '<div class="erg-foot">' +
      '<button class="btn" id="erg-review">Durchsicht</button>' +
      '<button class="btn btn-primary" id="erg-home">Zur Gürtelauswahl</button></div></div>';
    app.innerHTML = html;
    app.querySelector("#erg-home").addEventListener("click", zeigeGuertelauswahl);
    app.querySelector("#erg-review").addEventListener("click", function () { zeigeDurchsicht(0); });
  }
```

Außerdem den `window.HPP_APP`-Export um `zaehleRichtige` ergänzen (für manuelle Verifikation):
```javascript
  window.HPP_APP = {
    state: state,
    speichereFortschritt: speichereFortschritt,
    zeigeGuertelauswahl: zeigeGuertelauswahl,
    zaehleRichtige: zaehleRichtige,
  };
```

`zeigeDurchsicht` ist Platzhalter bis Task 9 — vorerst ergänzen:
```javascript
  function zeigeDurchsicht() { alert("Durchsicht — kommt in Task 9"); }
```

- [ ] **Step 2: Auswertungs-Stile in `app/styles.css` ergänzen**

```css
.erg { display: flex; flex-direction: column; flex: 1; min-height: 100vh; justify-content: center; gap: 20px; }
.erg-badge { text-align: center; padding: 32px 20px; border-radius: 20px; border: 2px solid; }
.erg-badge.ok { border-color: var(--accent); background: var(--accent-soft); }
.erg-badge.fail { border-color: var(--warn); background: #fdf0ea; }
.erg-zahl { font-size: 44px; font-weight: 800; }
.erg-txt { color: var(--muted); font-weight: 600; margin-top: 6px; }
.erg-unlock { text-align: center; font-size: 17px; }
.erg-foot { display: flex; gap: 10px; }
.erg-foot .btn { flex: 1; }
```

- [ ] **Step 3: Im Browser prüfen (Bestehen & Freischaltung)**

Run: `open app/index.html`
Expected: Gelb durchspielen. Schnelltest des Zählers in der Konsole vor Abgabe: `HPP_APP.zaehleRichtige()` liefert eine Zahl 0–28. Bei ≥ 21 → „Bestanden", „🎉 Neuer Gürtel freigeschaltet: Grün", nach Reload ist Grün frei. Bei < 21 → „Nicht bestanden", keine Freischaltung. „Zur Gürtelauswahl" kehrt zurück. (Tipp zum schnellen Bestehen: in der Übersicht alle richtigen Antworten setzen — Lösungen aus `HPP_DATA.exams['2026-03'].fragen[i].stufen.gelb.loesung`.)

- [ ] **Step 4: Commit**

```bash
git add app/app.js app/styles.css
git commit -m "feat: Auswertung 21/28 + Gürtel-Freischaltung persistiert"
```

---

## Task 9: Durchsicht (Review aller Fragen)

**Files:**
- Modify: `app/app.js` (`zeigeDurchsicht` echt implementieren)
- Modify: `app/styles.css` (Durchsicht-Stile)

- [ ] **Step 1: `zeigeDurchsicht`-Platzhalter ersetzen**

```javascript
  function zeigeDurchsicht(idx) {
    leeren();
    var p = state.pruefung;
    var frage = EXAM.fragen[idx];
    var stufe = frage.stufen[p.guertel];
    var gewaehlt = p.antworten[frage.nr] || [];
    var richtig = L.istRichtig(gewaehlt, stufe.loesung);

    var html = '<div class="rev">' +
      '<div class="rev-top"><span class="ex-count">' + (idx + 1) + ' / ' + L.ANZAHL_FRAGEN + '</span>' +
      '<span class="rev-mark ' + (richtig ? "ok" : "fail") + '">' + (richtig ? "✓ richtig" : "✗ falsch") + '</span></div>';
    html += '<p class="ex-stamm">' + escape(stufe.stamm) + '</p>';
    if (stufe.aussagen) {
      html += '<ol class="aussagen">';
      Object.keys(stufe.aussagen).forEach(function (k) {
        html += '<li><b>' + k + '.</b> ' + escape(stufe.aussagen[k]) + '</li>';
      });
      html += '</ol>';
    }
    html += '<div class="ex-opts">';
    Object.keys(stufe.optionen).forEach(function (b) {
      var istLoesung = stufe.loesung.indexOf(b) >= 0;
      var warGewaehlt = gewaehlt.indexOf(b) >= 0;
      var cls = istLoesung ? " loesung" : (warGewaehlt ? " falschgewaehlt" : "");
      html += '<div class="ex-opt' + cls + '"><span class="ltr">' + b + '</span>' +
        '<span class="t">' + escape(stufe.optionen[b]) + '</span>' +
        (istLoesung ? '<span class="haken">✓</span>' : (warGewaehlt ? '<span class="haken">✗</span>' : "")) + '</div>';
    });
    html += '</div>';
    if (frage.kern) html += '<div class="rev-kern"><b>Wissenskern:</b> ' + escape(frage.kern) + '</div>';
    html += '<div class="rev-foot">' +
      (idx > 0 ? '<button class="btn" id="rev-prev">‹</button>' : '<span></span>') +
      '<button class="btn" id="rev-home">Fertig</button>' +
      (idx < L.ANZAHL_FRAGEN - 1 ? '<button class="btn btn-primary" id="rev-next">›</button>' : '<span></span>') +
      '</div></div>';
    app.innerHTML = html;
    var prev = app.querySelector("#rev-prev");
    if (prev) prev.addEventListener("click", function () { zeigeDurchsicht(idx - 1); });
    var next = app.querySelector("#rev-next");
    if (next) next.addEventListener("click", function () { zeigeDurchsicht(idx + 1); });
    app.querySelector("#rev-home").addEventListener("click", zeigeGuertelauswahl);
  }
```

- [ ] **Step 2: Durchsicht-Stile in `app/styles.css` ergänzen**

```css
.rev { display: flex; flex-direction: column; flex: 1; min-height: 100vh; padding-top: 14px; }
.rev-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.rev-mark.ok { color: var(--accent); font-weight: 700; }
.rev-mark.fail { color: var(--warn); font-weight: 700; }
.ex-opt.loesung { border-color: var(--accent); background: var(--accent-soft); }
.ex-opt.falschgewaehlt { border-color: var(--warn); background: #fdf0ea; }
.ex-opt .haken { margin-left: auto; font-weight: 700; }
.rev-kern { background: #faf9f6; border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin-top: 16px; font-size: 15px; line-height: 1.5; }
.rev-foot { display: flex; justify-content: space-between; gap: 10px; margin-top: auto; padding: 14px 0; }
```

- [ ] **Step 3: Im Browser prüfen**

Run: `open app/index.html`
Expected: Nach Auswertung → „Durchsicht": pro Frage ist die korrekte Lösung grün markiert (✓), eine falsch gewählte Option rot (✗), oben „✓ richtig"/„✗ falsch", darunter der Wissenskern. ‹/› blättern, „Fertig" zurück zur Gürtelauswahl.

- [ ] **Step 4: Commit**

```bash
git add app/app.js app/styles.css
git commit -m "feat: Durchsicht mit Lösungsmarkierung und Wissenskern"
```

---

## Task 10: 60-Minuten-Timer

**Files:**
- Modify: `app/app.js` (Timer starten/aktualisieren/stoppen)

- [ ] **Step 1: Timer-Funktionen ergänzen und in `starteValidierung` starten**

In `app/app.js`: in `starteValidierung` nach dem Setzen von `state.pruefung` den Timer initialisieren, und Timer-Funktionen ergänzen.

In `starteValidierung` ergänzen (vor `zeigeFrage();`):
```javascript
    state.restSekunden = 60 * 60;
    starteTimer();
```

Neue Funktionen (vor dem Export):
```javascript
  function starteTimer() {
    if (state.timerId) clearInterval(state.timerId);
    aktualisiereTimerAnzeige();
    state.timerId = setInterval(function () {
      state.restSekunden--;
      if (state.restSekunden <= 0) {
        state.restSekunden = 0;
        aktualisiereTimerAnzeige();
        clearInterval(state.timerId);
        state.timerId = null;
        abgeben();
        return;
      }
      aktualisiereTimerAnzeige();
    }, 1000);
  }

  function aktualisiereTimerAnzeige() {
    var el = document.getElementById("timer");
    if (!el) return;
    var m = Math.floor(state.restSekunden / 60);
    var s = state.restSekunden % 60;
    el.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    if (state.restSekunden <= 5 * 60) el.classList.add("low");
    else el.classList.remove("low");
  }
```

- [ ] **Step 2: Timer-Anzeige-Init im Frage-Render absichern**

Sicherstellen, dass `zeigeFrage` nach dem Setzen von `innerHTML` die Anzeige aktualisiert (Timer-Element wird bei jedem Render neu erzeugt). Am Ende von `zeigeFrage` ergänzen:
```javascript
    aktualisiereTimerAnzeige();
```
Hinweis: `abgeben` (Task 8) stoppt den Timer bereits via `clearInterval(state.timerId)`.

- [ ] **Step 3: Im Browser prüfen**

Run: `open app/index.html`
Expected: Prüfung starten → Timer zählt ab `60:00` herunter, bleibt beim Blättern/Antworten konsistent. Schnelltest des Ablaufs in der Konsole: `HPP_APP.state.restSekunden = 4` setzen, 1–2 Sek warten → Anzeige rot (`low`); bei `0` automatische Auswertung. Nach Abgabe läuft der Timer nicht weiter.

- [ ] **Step 4: Commit**

```bash
git add app/app.js
git commit -m "feat: 60-Minuten-Timer mit Auto-Abgabe und Warnfärbung"
```

---

## Task 11: Abschluss-Verifikation & Logik-Regressionslauf

**Files:** keine Änderung (reine Verifikation)

- [ ] **Step 1: Logik-Tests final laufen lassen**

Run: `node --test app/logic.test.js`
Expected: PASS, alle Tests grün.

- [ ] **Step 2: Lösungs-Konsistenz gegen die Daten prüfen (Schwarz = Original)**

Run:
```bash
node -e '
global.window={}; require("./app/data.js");
const fs=require("fs");
const orig=JSON.parse(fs.readFileSync("daten/fragen_original.json","utf8"));
const exam=window.HPP_DATA.exams["2026-03"];
const o=orig.find(e=>e.pruefung_id===exam.pruefung_id) || orig.find(e=>e.fragen);
let mism=0;
exam.fragen.forEach(f=>{
  const oF=(o.fragen||[]).find(x=>x.nr===f.nr);
  if(!oF) return;
  const a=f.stufen.schwarz.loesung.slice().sort().join();
  const b=oF.loesung.slice().sort().join();
  if(a!==b){mism++; console.log("Frage",f.nr,"Schwarz:",a,"Original:",b);}
});
console.log(mism===0?"OK: Schwarz-Lösungen == Original":("ABWEICHUNGEN: "+mism));
'
```
Expected: `OK: Schwarz-Lösungen == Original` (bei Abweichung gemäß CLAUDE.md `fragen_original.json` als Quelle nehmen und Daten korrigieren — nicht den Code).

- [ ] **Step 3: Manueller Durchlauf der ganzen App (iPhone-Breite)**

Browser-Fenster auf ~390px Breite. Run: `open app/index.html`
Checkliste:
- Gürtelauswahl: nur freigeschaltete Gürtel wählbar.
- Prüfung: alle drei Fragetypen korrekt; scrollfrei bei Einfach-/Mehrfachauswahl.
- Mehrfachauswahl: genau zwei wählbar, Hinweis sichtbar; Schwarz-Frage 1 ohne Hinweis/Einzelauswahl.
- Timer läuft, Auto-Abgabe bei 0.
- Auswertung 21/28 korrekt, Freischaltung persistiert über Reload.
- Durchsicht zeigt Lösung + Wissenskern.

- [ ] **Step 4: Abschluss-Commit (falls noch offenes)**

```bash
git add -A
git commit -m "chore: Abschluss-Verifikation HPP-Prüfungsmodus" --allow-empty
```

---

## Hinweise für später (nicht Teil dieses Plans)

- **Dark Mode:** zweiter CSS-Variablen-Satz unter `@media (prefers-color-scheme: dark)` bzw. via Umschalter — Struktur ist vorbereitet.
- **Übungsmodus + Statistik:** eigener Plan, baut auf `logic.js`/`data.js` auf.
- **Weitere Prüfungen:** `daten/build_data.py` erneut ausführen, sobald weitere Prüfungen `guertel_komplett` sind.
