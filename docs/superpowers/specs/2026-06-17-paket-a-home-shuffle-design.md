# Design: Paket A — Home-Button + zufällige Antwort-Reihenfolge

**Datum:** 2026-06-17
**Scope:** Zwei kleine Erweiterungen des bestehenden Prüfungsmodus. Kein neues Subsystem.
(Das Anki-/Übungsplan-System ist **Paket B** und bekommt eine eigene Spec.)

## 1. Ziel

1. Ein **Home-Button**, von überall erreichbar, der bei laufender Prüfung zur Sicherheit nachfragt.
2. **Zufällige Antwort-Reihenfolge** pro Prüfungsversuch, damit man die Position der richtigen
   Antwort nicht optisch auswendig lernt.

## 2. Ausgangslage

Bestehende App (Vanilla HTML/CSS/JS): `app/index.html` lädt `styles.css`, `logic.js` (reine,
getestete Funktionen), `data.js` (JS-Wrap der Daten), `app.js` (Views/State).
Prüfungs-State: `state.pruefung = { guertel, antworten: {nr:[Buchstaben]}, index, abgegeben }`.
Auswertung über `logic.js`: `istRichtig(gewaehlt, loesung)` (exakter Mengenvergleich, Original-Buchstaben).

## 3. Feature 1 — Home-Button + Kopf-Umbau

### Kopf (Prüfungs-Screen)
- **Oben links:** 🏠-Button mit **gürtelfarbigem Ring** (ersetzt den bisherigen reinen Gürtel-Punkt).
- **Mitte:** „`<Gürtelname> · <n> / 28`" (z. B. „Gelb · 11 / 28") — Gürtelname + Fortschritt kompakt.
- **Rechts:** Timer (rot bei ≤ 5 Min, unverändert).
- **Darunter:** Fortschrittsbalken **in Gürtelfarbe** (statt grün).
- Grün (`--accent`) bleibt ausschließlich für Auswahl/Buttons.

### Home auf den anderen Screens
- **Übersicht, Auswertung, Durchsicht:** ebenfalls ein 🏠 oben links (gleiche Position).
- **Gürtelauswahl:** kein Home (ist selbst „Home").

### Verhalten
- Home **während eines laufenden Versuchs** (Prüfungs-Screen **und** Übersicht):
  `window.confirm("Prüfung abbrechen? Der aktuelle Versuch geht verloren.")`.
  Bei Bestätigung: Timer stoppen (`clearInterval`, `timerId=null`), `state.pruefung` verwerfen,
  `zeigeGuertelauswahl()`.
- Home auf **Auswertung/Durchsicht** (Versuch bereits abgegeben, Fortschritt gespeichert):
  **ohne** Rückfrage direkt `zeigeGuertelauswahl()`.
- Unterscheidung „laufender Versuch": `state.pruefung && !state.pruefung.abgegeben`.

### Gürtelfarbe im Code
- Farbe je Gürtel kommt aus den vorhandenen CSS-Variablen `--g-<guertel>`.
- Ring am Home und Balkenfüllung werden inline auf `var(--g-<guertel>)` gesetzt (wie schon beim Punkt).

## 4. Feature 2 — Zufällige Antwort-Reihenfolge

### Datenmodell
- Beim Prüfungsstart (`starteValidierung`) wird **pro Frage** eine Anzeige-Reihenfolge gewürfelt:
  `state.pruefung.reihenfolge[nr] = [<Original-Buchstaben in Mischreihenfolge>]`
  (z. B. `["C","A","E","B","D"]`). Einmal pro Versuch, danach **konstant**.
- Gemischt werden die tatsächlich vorhandenen Options-Schlüssel der **gewählten Stufe**
  (`Object.keys(stufe.optionen)`), nicht hart A–E (Robustheit bei < 5 Optionen).

### Rendering (Prüfungs-Screen und Durchsicht)
- Anzeige-Positionen erhalten feste Labels **A, B, C … in Reihenfolge**.
- Position *i* zeigt den Inhalt des Original-Buchstabens `reihenfolge[nr][i]`.
- `data-opt` am Options-Element trägt den **Original-Buchstaben** (nicht das Anzeige-Label),
  damit die Auswahl-Logik unverändert auf Original-Buchstaben arbeitet.
- Auswahl-Markierung (`.sel`) anhand der gespeicherten Original-Buchstaben in `antworten[nr]`.

### Auswertung / Durchsicht
- `antworten[nr]`, `loesung`, `istRichtig`, `zaehleRichtige`, `naechsterHoechster` bleiben
  **unverändert** und arbeiten in Original-Buchstaben — keine Änderung nötig.
- **Durchsicht** liest dieselbe `reihenfolge[nr]`, zeigt die Optionen in identischer Misch-Anordnung,
  markiert Lösung (`loesung`, grün ✓) und falsch Gewähltes (rot ✗) anhand der Original-Buchstaben.

### Geltungsbereich
- Gilt im **Prüfungsmodus** (bewusst auch hier, nicht 1:1 zum Original-PDF) — fürs Training.
- Helfer werden so gebaut, dass das spätere **Paket B** (Übungsmodus) sie wiederverwenden kann.

## 5. Reine, testbare Helfer (`logic.js`)

Neu in `logic.js`, mit `node --test`-Tests:

- `mischen(arr, rnd)` → neue gemischte Kopie (Fisher–Yates). `rnd` ist eine Funktion `() => [0,1)`
  (Default `Math.random`), damit Tests deterministisch eine Permutation prüfen können.
- `anzeigeOptionen(optionen, reihenfolge)` → Liste `[{label:"A", original:"C", text:"…"}, …]`
  für das Rendering (rein, deterministisch bei gegebener Reihenfolge).

Das eigentliche Würfeln pro Frage (`reihenfolge` befüllen) bleibt ein dünner Wrapper in `app.js`,
der `mischen` nutzt.

## 6. Betroffene Dateien

- `app/logic.js` — `mischen`, `anzeigeOptionen` (+ Tests in `app/logic.test.js`).
- `app/app.js` — `starteValidierung` (Reihenfolge würfeln), `zeigeFrage` (Kopf + gemischtes Rendering
  + Home), `waehle` (unverändert, arbeitet auf Original-Buchstaben), `zeigeUebersicht` (Home),
  `zeigeAuswertung`/`zeigeDurchsicht` (Home + gemischtes Rendering).
- `app/styles.css` — Home-Button, gürtelfarbiger Ring, Fortschrittsbalken/Label in Gürtelfarbe.

## 7. Testbarkeit

- `mischen`: Ergebnis ist eine Permutation der Eingabe (gleiche Elemente, gleiche Länge);
  mit fixem `rnd` deterministisch prüfbar.
- `anzeigeOptionen`: bei gegebener Reihenfolge exakte Label/Original/Text-Zuordnung.
- Manuell im Browser: Reihenfolge konstant über Navigation/Neuzeichnen; Auswahl bleibt korrekt
  zugeordnet; Auswertung weiterhin korrekt (alle richtig = 28/28); Durchsicht zeigt dieselbe
  Anordnung; Home mit/ohne Rückfrage je nach Screen.

## 8. Nicht-Ziele

- Kein Übungsmodus/Anki (Paket B).
- Keine Änderung an Auswertungs-/Freischalt-Logik.
- Keine Persistenz der Misch-Reihenfolge über einen Versuch hinaus (pro Versuch neu gewürfelt).
