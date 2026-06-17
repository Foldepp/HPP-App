# Paket A — Home-Button + zufällige Antwort-Reihenfolge — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen von überall erreichbaren Home-Button (mit Rückfrage bei laufender Prüfung) und eine pro Versuch konstante, zufällige Antwort-Reihenfolge in den bestehenden Prüfungsmodus einbauen.

**Architecture:** Reine, testbare Helfer (`mischen`, `anzeigeOptionen`) kommen nach `logic.js`. Die Misch-Reihenfolge wird einmal pro Versuch in `state.pruefung.reihenfolge` gewürfelt und beim Rendern in Anzeige-Labels A–E übersetzt; intern wird auf Original-Buchstaben gerechnet, sodass Auswertung/Freischaltung unverändert bleiben. Der Home-Button ist ein gemeinsamer Helfer, der je nach Prüfungsstatus mit/ohne Rückfrage zur Gürtelauswahl zurückkehrt.

**Tech Stack:** Vanilla HTML/CSS/JS (kein Build), Node `node:test` für Logik, `localStorage` (unverändert).

---

## Dateien

| Datei | Änderung |
|---|---|
| `app/logic.js` | Neu: `mischen(arr, rnd)`, `anzeigeOptionen(optionen, reihenfolge)` + Export. |
| `app/logic.test.js` | Tests für die zwei Helfer. |
| `app/app.js` | `starteValidierung` (Reihenfolge würfeln), `zeigeFrage`/`zeigeDurchsicht` (gemischtes Rendering), Home-Helfer + Kopf-Umbau, Home auf Übersicht/Auswertung/Durchsicht. |
| `app/styles.css` | Home-Button, gürtelfarbiger Ring/Balken, kleine Layout-Regeln (`.ov-top`, `.rev-top-l`, `.erg` relative). |

**Datenfakten:** Frage = `{ nr, thema, kern, stufen[guertel] }`; Stufe = `{ typ, stamm, aussagen|null, optionen{A..}, loesung[] }`. Auswertung arbeitet in Original-Buchstaben (`loesung`). CSS-Variablen `--g-<guertel>` existieren bereits (Gürtelfarben).

---

## Task 1: Reine Helfer in `logic.js` (TDD)

**Files:**
- Modify: `app/logic.js`
- Test: `app/logic.test.js`

- [ ] **Step 1: Failing Tests anhängen**

Am Ende von `app/logic.test.js` (vor keiner Klammer — Datei endet mit den bestehenden Tests) anhängen:

```javascript
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
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `node --test app/logic.test.js`
Expected: FAIL (`L.mischen is not a function` / `L.anzeigeOptionen is not a function`).

- [ ] **Step 3: Helfer implementieren**

In `app/logic.js` die beiden Funktionen direkt vor `var api = {` einfügen:

```javascript
  function mischen(arr, rnd) {
    var r = rnd || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function anzeigeOptionen(optionen, reihenfolge) {
    var labels = "ABCDEFGHIJ";
    return reihenfolge.map(function (orig, i) {
      return { label: labels.charAt(i), original: orig, text: optionen[orig] };
    });
  }
```

Und im `api`-Objekt die zwei Einträge ergänzen (nach `erwarteMehrfach: erwarteMehrfach,`):

```javascript
    mischen: mischen,
    anzeigeOptionen: anzeigeOptionen,
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `node --test app/logic.test.js`
Expected: PASS (alle Tests, inkl. der bisherigen 6, grün).

- [ ] **Step 5: Commit**

```bash
git add app/logic.js app/logic.test.js
git commit -m "feat: mischen() + anzeigeOptionen() für zufällige Antwort-Reihenfolge

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Zufällige Antwort-Reihenfolge im Prüfungs- und Durchsicht-Render

**Files:**
- Modify: `app/app.js`

- [ ] **Step 1: Reihenfolge beim Start würfeln**

In `app/app.js` die Funktion `starteValidierung` ersetzen:

```javascript
  function starteValidierung(guertel) {
    state.pruefung = {
      guertel: guertel,
      antworten: {},      // { nr: [Original-Buchstaben] }
      index: 0,           // aktueller Frageindex 0..27
      reihenfolge: baueReihenfolge(guertel), // { nr: [Original-Buchstaben gemischt] }
    };
    state.restSekunden = 60 * 60;
    starteTimer();
    zeigeFrage();
  }

  function baueReihenfolge(guertel) {
    var r = {};
    EXAM.fragen.forEach(function (frage) {
      var stufe = frage.stufen[guertel];
      r[frage.nr] = L.mischen(Object.keys(stufe.optionen));
    });
    return r;
  }
```

- [ ] **Step 2: Optionen im Frage-Screen gemischt rendern**

In `zeigeFrage` den Optionen-Block ersetzen.

Alt:
```javascript
    html += '<div class="ex-opts">';
    Object.keys(stufe.optionen).forEach(function (b) {
      var sel = gewaehlt.indexOf(b) >= 0 ? " sel" : "";
      html += '<button class="ex-opt' + sel + '" data-opt="' + b + '">' +
        '<span class="ltr">' + b + '</span><span class="t">' + escape(stufe.optionen[b]) + '</span></button>';
    });
    html += '</div></div>';
```

Neu:
```javascript
    html += '<div class="ex-opts">';
    L.anzeigeOptionen(stufe.optionen, p.reihenfolge[frage.nr]).forEach(function (o) {
      var sel = gewaehlt.indexOf(o.original) >= 0 ? " sel" : "";
      html += '<button class="ex-opt' + sel + '" data-opt="' + o.original + '">' +
        '<span class="ltr">' + o.label + '</span><span class="t">' + escape(o.text) + '</span></button>';
    });
    html += '</div></div>';
```

(`data-opt` trägt weiterhin den **Original-Buchstaben**, daher bleibt `waehle(...)` unverändert.)

- [ ] **Step 3: Optionen in der Durchsicht gemischt rendern**

In `zeigeDurchsicht` den Optionen-Block ersetzen.

Alt:
```javascript
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
```

Neu:
```javascript
    html += '<div class="ex-opts">';
    L.anzeigeOptionen(stufe.optionen, p.reihenfolge[frage.nr]).forEach(function (o) {
      var istLoesung = stufe.loesung.indexOf(o.original) >= 0;
      var warGewaehlt = gewaehlt.indexOf(o.original) >= 0;
      var cls = istLoesung ? " loesung" : (warGewaehlt ? " falschgewaehlt" : "");
      html += '<div class="ex-opt' + cls + '"><span class="ltr">' + o.label + '</span>' +
        '<span class="t">' + escape(o.text) + '</span>' +
        (istLoesung ? '<span class="haken">✓</span>' : (warGewaehlt ? '<span class="haken">✗</span>' : "")) + '</div>';
    });
    html += '</div>';
```

- [ ] **Step 4: Syntax prüfen**

Run: `node --check app/app.js`
Expected: kein Fehler (Exit 0).

- [ ] **Step 5: Funktionale Prüfung im Browser**

Dev-Server läuft bereits (`app/` auf Port 8123). Hard-Reload nötig (Cache): in `app/index.html` vorübergehend `app.js` zu `app.js?v=t2` ändern, im Browser prüfen, danach zurückändern.
Checkliste:
- Optionen erscheinen in zufälliger inhaltlicher Reihenfolge unter A–E.
- Reihenfolge bleibt beim Vor/Zurück-Navigieren und nach Auswahl **konstant**.
- Alle richtigen Antworten (Original-Lösung) wählen → Auswertung **28 / 28** (Mapping korrekt).
- Durchsicht zeigt dieselbe gemischte Anordnung mit korrekter ✓/✗-Markierung.

- [ ] **Step 6: Commit**

```bash
git add app/app.js
git commit -m "feat: zufällige Antwort-Reihenfolge (konstant pro Versuch)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Home-Button + Kopf-Umbau (Gürtelfarbe)

**Files:**
- Modify: `app/app.js`
- Modify: `app/styles.css`

- [ ] **Step 1: Home-Helfer hinzufügen**

In `app/app.js` direkt nach der `leeren`-Funktion einfügen:

```javascript
  function homeButtonHtml(guertel) {
    return '<button class="home-btn" id="btn-home" aria-label="Zur Gürtelauswahl"' +
      ' style="box-shadow: inset 0 0 0 2px var(--g-' + guertel + ')">🏠</button>';
  }
  function bindHome() {
    var h = app.querySelector("#btn-home");
    if (h) h.addEventListener("click", homeKlick);
  }
  function homeKlick() {
    if (state.pruefung && !state.pruefung.abgegeben) {
      if (!window.confirm("Prüfung abbrechen? Der aktuelle Versuch geht verloren.")) return;
      if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
      state.pruefung = null;
    }
    zeigeGuertelauswahl();
  }
```

- [ ] **Step 2: Prüfungs-Kopf umbauen (Home, Gürtelname, gürtelfarbener Balken)**

In `zeigeFrage` den Kopf ersetzen.

Alt:
```javascript
    html += '<div class="ex-top">' +
      '<span class="ex-belt"><span class="punkt-s" style="background:var(--g-' + p.guertel + ')"></span></span>' +
      '<span class="ex-count">' + (p.index + 1) + ' / ' + L.ANZAHL_FRAGEN + '</span>' +
      '<span class="ex-timer" id="timer">60:00</span></div>';
    html += '<div class="ex-bar"><i style="width:' + ((p.index + 1) / L.ANZAHL_FRAGEN * 100) + '%"></i></div>';
```

Neu:
```javascript
    html += '<div class="ex-top">' +
      homeButtonHtml(p.guertel) +
      '<span class="ex-count">' + LABELS[p.guertel] + ' · ' + (p.index + 1) + ' / ' + L.ANZAHL_FRAGEN + '</span>' +
      '<span class="ex-timer" id="timer">60:00</span></div>';
    html += '<div class="ex-bar"><i style="width:' + ((p.index + 1) / L.ANZAHL_FRAGEN * 100) + '%; background:var(--g-' + p.guertel + ')"></i></div>';
```

- [ ] **Step 3: Home im Frage-Screen binden**

In `zeigeFrage` die Bindungs-Endzeilen ersetzen.

Alt:
```javascript
    app.querySelector("#btn-ov").addEventListener("click", zeigeUebersicht);
    aktualisiereTimerAnzeige();
  }
```

Neu:
```javascript
    app.querySelector("#btn-ov").addEventListener("click", zeigeUebersicht);
    bindHome();
    aktualisiereTimerAnzeige();
  }
```

- [ ] **Step 4: Home in der Übersicht**

In `zeigeUebersicht` den Kopf ersetzen.

Alt:
```javascript
    var html = '<div class="ov">' +
      '<h2 class="ov-title">Übersicht</h2>' +
      '<p class="sub">' + beantwortet + ' von ' + L.ANZAHL_FRAGEN + ' beantwortet · tippen zum Springen</p>' +
      '<div class="ovgrid">';
```

Neu:
```javascript
    var html = '<div class="ov">' +
      '<div class="ov-top">' + homeButtonHtml(p.guertel) + '<h2 class="ov-title">Übersicht</h2></div>' +
      '<p class="sub">' + beantwortet + ' von ' + L.ANZAHL_FRAGEN + ' beantwortet · tippen zum Springen</p>' +
      '<div class="ovgrid">';
```

Und die Bindungs-Endzeilen ersetzen.

Alt:
```javascript
    app.querySelector("#ov-back").addEventListener("click", zeigeFrage);
    app.querySelector("#ov-submit").addEventListener("click", abgeben);
  }
```

Neu:
```javascript
    app.querySelector("#ov-back").addEventListener("click", zeigeFrage);
    app.querySelector("#ov-submit").addEventListener("click", abgeben);
    bindHome();
  }
```

- [ ] **Step 5: Home in der Auswertung**

In `zeigeAuswertung` den Anfang des HTML ersetzen.

Alt:
```javascript
    var html = '<div class="erg">' +
      '<div class="erg-badge ' + (bestanden ? "ok" : "fail") + '">' +
```

Neu:
```javascript
    var html = '<div class="erg">' +
      homeButtonHtml(state.pruefung.guertel) +
      '<div class="erg-badge ' + (bestanden ? "ok" : "fail") + '">' +
```

Und die Bindungs-Endzeilen ersetzen.

Alt:
```javascript
    app.querySelector("#erg-home").addEventListener("click", zeigeGuertelauswahl);
    app.querySelector("#erg-review").addEventListener("click", function () { zeigeDurchsicht(0); });
  }
```

Neu:
```javascript
    app.querySelector("#erg-home").addEventListener("click", zeigeGuertelauswahl);
    app.querySelector("#erg-review").addEventListener("click", function () { zeigeDurchsicht(0); });
    bindHome();
  }
```

- [ ] **Step 6: Home in der Durchsicht**

In `zeigeDurchsicht` den Kopf ersetzen.

Alt:
```javascript
    var html = '<div class="rev">' +
      '<div class="rev-top"><span class="ex-count">' + (idx + 1) + ' / ' + L.ANZAHL_FRAGEN + '</span>' +
      '<span class="rev-mark ' + (richtig ? "ok" : "fail") + '">' + (richtig ? "✓ richtig" : "✗ falsch") + '</span></div>';
```

Neu:
```javascript
    var html = '<div class="rev">' +
      '<div class="rev-top"><div class="rev-top-l">' + homeButtonHtml(p.guertel) +
      '<span class="ex-count">' + (idx + 1) + ' / ' + L.ANZAHL_FRAGEN + '</span></div>' +
      '<span class="rev-mark ' + (richtig ? "ok" : "fail") + '">' + (richtig ? "✓ richtig" : "✗ falsch") + '</span></div>';
```

Und die Bindungs-Endzeile ersetzen.

Alt:
```javascript
    app.querySelector("#rev-home").addEventListener("click", zeigeGuertelauswahl);
  }
```

Neu:
```javascript
    app.querySelector("#rev-home").addEventListener("click", zeigeGuertelauswahl);
    bindHome();
  }
```

- [ ] **Step 7: CSS ergänzen**

Am Ende von `app/styles.css` anhängen:

```css
/* Home-Button (oben links auf allen Prüfungs-Screens) */
.home-btn { width: 38px; height: 38px; border-radius: 11px; flex: none; background: var(--card);
  border: none; font-size: 18px; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; }
.ov-top { display: flex; align-items: center; gap: 12px; padding-top: 8px; }
.ov-top .ov-title { margin: 0; }
.rev-top-l { display: flex; align-items: center; gap: 12px; }
.erg { position: relative; }
.erg > .home-btn { position: absolute; top: 0; left: 0; }
```

- [ ] **Step 8: Syntax prüfen**

Run: `node --check app/app.js`
Expected: kein Fehler (Exit 0).

- [ ] **Step 9: Funktionale Prüfung im Browser**

Hard-Reload (Cache): in `app/index.html` vorübergehend `styles.css` → `styles.css?v=t3` **und** `app.js` → `app.js?v=t3`, prüfen, danach zurückändern.
Checkliste:
- Kopf: 🏠 mit gürtelfarbenem Ring oben links, „Gelb · 1 / 28" mittig, Timer rechts, **Balken in Gürtelfarbe**.
- 🏠 mitten in der Prüfung → Rückfrage; „Abbrechen" bleibt, „OK" → Timer gestoppt, zurück zur Gürtelauswahl.
- 🏠 auf Übersicht → ebenfalls Rückfrage.
- 🏠 auf Auswertung und Durchsicht → **ohne** Rückfrage direkt zur Gürtelauswahl.
- Verschiedene Gürtel zeigen die jeweils richtige Farbe (Ring + Balken), z. B. Schwarz dunkel.

- [ ] **Step 10: Commit**

```bash
git add app/app.js app/styles.css
git commit -m "feat: Home-Button (mit Rückfrage bei laufender Prüfung) + Kopf in Gürtelfarbe

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Abschluss-Verifikation

**Files:** keine Änderung.

- [ ] **Step 1: Logik-Tests**

Run: `node --test app/logic.test.js`
Expected: PASS (bisherige 6 + 3 neue = 9 Tests grün).

- [ ] **Step 2: Syntax**

Run: `node --check app/app.js && node --check app/logic.js`
Expected: kein Fehler.

- [ ] **Step 3: Index.html sauber?**

Run: `git diff --stat app/index.html`
Expected: keine Ausgabe (kein verbliebener `?v=`-Cache-Bust). Falls doch, `app/index.html` auf `href="styles.css"` / `src="app.js"` zurücksetzen.

- [ ] **Step 4: End-to-End im Browser**

Eine volle Gelb-Runde: gemischte Reihenfolge konstant, Auswertung korrekt, Freischaltung wie zuvor, Home-Verhalten wie in Task 3 Schritt 9.

- [ ] **Step 5: Push**

```bash
git push origin main
```

---

## Hinweise

- `data-opt` bleibt der Original-Buchstabe → `waehle`, `istRichtig`, `zaehleRichtige`, `naechsterHoechster` unverändert.
- `mischen` nutzt `Math.random` (Browser-Laufzeit, kein Workflow) — unkritisch.
- Die Misch-Reihenfolge wird bewusst **nicht** persistiert (pro Versuch neu).
- Dead CSS `.ex-belt`/`.punkt-s` wird nicht mehr verwendet; bleibt unangetastet (kein Funktionsbezug), kann später entfernt werden.
