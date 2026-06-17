# Design: HPP-Prüfungsmodus mit Gürtelauswahl (Mobile-first)

**Datum:** 2026-06-17
**Scope dieses Bauschritts:** Variante **B** — Gürtelauswahl + vollständiger Prüfungsmodus
(28 Fragen, 60-Min-Timer, Auswertung 21/28, Durchsicht) inkl. localStorage-Fortschritt und
Gürtel-Freischaltung. Übungsmodus und Statistik kommen als separater Schritt danach.

## 1. Ziel

Eine offline lauffähige Lern-App (Vanilla HTML/CSS/JS) für die schriftliche HPP-Prüfung mit
Karate-Gürtelsystem. Nutzer wählt einen freigeschalteten Gürtel und absolviert die Prüfung
März 2026 (`daten/fragen_2026-03.json`) auf dieser Stufe. Besteht er (≥ 21/28), wird der
nächste Gürtel freigeschaltet.

## 2. Technische Leitplanken (aus CLAUDE.md)

- Vanilla HTML/CSS/JS, kein Build-Schritt, keine Frameworks.
- **Per Doppelklick startbar** (`file://`): Daten werden als JS-Wrap geladen, kein `fetch`.
- Fortschritt in `localStorage`.
- Oberfläche Deutsch. Lösungen niemals raten/ändern.

## 3. Dateistruktur (`app/`)

```
app/
  index.html      Grundgerüst + Container, lädt die übrigen Dateien
  styles.css      Farbsystem (CSS-Variablen) + Layout
  app.js          gesamte App-Logik (Views, State, Auswertung, Timer, localStorage)
  data.js         JS-Wrap der Daten: window.HPP_DATA = { index, exams: { "2026-03": {…} } }
daten/
  build_data.py   erzeugt app/data.js aus index.json + fragen_2026-03.json (reproduzierbar)
```

**Begründung getrennter Dateien:** klar abgegrenzte Verantwortlichkeiten (Stil / Logik / Daten),
gut les- und testbar — funktioniert per `file://` trotzdem, da kein `fetch` nötig ist.

**Datensynchronität:** `app/data.js` ist generiert, nie von Hand editiert. `daten/build_data.py`
liest `daten/index.json` + `daten/fragen_2026-03.json` und schreibt `app/data.js`. Bei neuen
übersetzten Prüfungen einfach erneut ausführen. Quelle der Wahrheit bleibt `daten/`.

## 4. Visuelle Richtung

- **Study-Look** (hell, ruhig, klar lesbar — Lern-/Medizin-Ästhetik), **nicht** der dunkle Dojo-Look.
- **Mobile-first, iPhone-Hochformat:** einspaltig, große Schrift, große Tipp-Flächen.
- **Farbsystem über CSS-Variablen** → **Dark Mode** ist später nur ein zweiter Variablen-Satz
  (eigener Bauschritt, nicht Teil von B).
- Gürtelfarben: Gelb `#f2c200`, Grün `#3aa655`, Blau `#2b6cb0`, Braun `#8b5e3c`, Schwarz `#26303a`.

## 5. Views

### 5.1 Gürtelauswahl (Start)
- Titel + Prüfung (März 2026, 28 Fragen).
- Fünf Gürtel als Liste (farbiger Punkt, Name, kurzer Untertitel).
- Freigeschaltete Gürtel anwählbar; gesperrte mit 🔒 (bis voriger bestanden). Gelb von Beginn frei.
- Höchster bestandener Gürtel wird aus localStorage gelesen.
- Tippen auf einen freien Gürtel → startet den Prüfungsmodus auf dieser Stufe.

### 5.2 Prüfungsmodus (Frage-Screen)
- **Kopf reduziert:** Gürtel-Punkt · „n / 28" · Timer. Dünner Fortschrittsbalken.
- **Timer:** 60 Minuten, sichtbar, läuft runter; färbt sich bei wenig Restzeit (z. B. < 5 Min) rot.
  Bei `00:00` → automatische Auswertung.
- **Fragenkarte:** Fragestamm groß; bei Aussagenkombination der nummerierte Aussagen-Block;
  Optionen A–E als große Buttons. Auswahlzustand farblich (grün).
- **Auswahl je Typ:**
  - Einfachauswahl / Aussagenkombination: genau **eine** Option (Radio-Verhalten).
  - Mehrfachauswahl: **mehrere** Optionen wählbar (Toggle).
  - Hinweis „Wählen Sie zwei Antworten!" wird **an der Länge von `loesung` festgemacht**
    (`loesung.length === 2`), nicht nur am Typ-Label — siehe Edge Case §8.
- **Navigation:** Zurück / Weiter; „▦ Übersicht" öffnet das Fragen-Raster.
- **Layout ohne Scrollen:** Vollhöhen-Flex-Layout, Schriftgrößen via `clamp()` an Viewport-Höhe.
  Standardfall scrollfrei; im dichtesten Aussagenkombinations-Fall skaliert die Schrift herunter,
  und nur der Aussagen-Block wird notfalls intern scrollbar — Optionen + Navigation bleiben fix sichtbar.

### 5.3 Fragen-Übersicht (Sheet)
- 5er-Raster aller 28 Fragen: beantwortet (grün) / offen / aktuell (Rahmen).
- Tippen springt zur Frage. Button **„Prüfung abgeben"** löst die Auswertung aus
  (mit Rückfrage, wenn noch Fragen offen sind).

### 5.4 Auswertung
- Anzahl richtig / 28, Bestehensgrenze 21/28 (75 %), bestanden ja/nein.
- Bei Bestehen: Hinweis, dass der nächste Gürtel freigeschaltet wurde.
- Einstieg in **Durchsicht**: alle Fragen mit eigener Antwort, korrekter `loesung` und —
  falls vorhanden — `kern` als Erklärung.

## 6. Logik & State

- **Gürtel-Reihenfolge:** `["gelb","gruen","blau","braun","schwarz"]`.
- **Auswertungsregel:** Eine Frage ist richtig, wenn die gewählte Buchstaben-**Menge exakt**
  `loesung` entspricht (sortierter Mengenvergleich). Keine Teilpunkte.
- **Bestehen:** `richtige >= 21`. Bestehen setzt den höchsten freigeschalteten Gürtel auf
  `max(bisher, index(gespielterGürtel)+1)`.
- **In-Memory-Prüfungsstate:** aktueller Gürtel, Antworten je Frage (`{nr: [Buchstaben]}`),
  aktueller Frageindex, verbleibende Sekunden.

### localStorage (Schema)
```
hpp_progress = {
  "hoechsterGuertel": "gelb",            // höchste freigeschaltete Stufe
  "ergebnisse": [                         // optionaler kurzer Verlauf
    { "guertel": "gelb", "richtig": 23, "datum": "2026-06-17" }
  ]
}
```
Robust gegen fehlende/kaputte Werte (try/catch, Default = nur Gelb frei).

## 7. Robustheit gegenüber Datenlage

- Nur Prüfungen mit `guertel_komplett: true` (aus `index.json`) werden für den
  Gürtel-Prüfungsmodus angeboten. Aktuell genau eine: März 2026.
- Fehlt eine Stufe in einer Frage, wird das defensiv behandelt (überspringen + Log),
  bricht die Prüfung aber nicht ab.

## 8. Edge Cases

- **Schwarz, Frage 1:** `typ: "Mehrfachauswahl"`, aber `loesung: ["A"]` (nur ein Buchstabe).
  → „Wählen Sie zwei"-Hinweis und Mehrfach-Toggle werden an `loesung.length` gekoppelt, nicht am
  Typ-Label. Auswertung (exakter Mengenvergleich) bleibt unberührt und korrekt.
- **Timerablauf** während offener Fragen → sofortige Auswertung mit dem aktuellen Stand.
- **Reload mitten in der Prüfung:** kein Wiederaufnehmen in diesem Schritt (YAGNI); Prüfung
  beginnt neu. Nur der Gürtelfortschritt ist persistent.

## 9. Testbarkeit

- Auswertungs- und Freischalt-Logik in **reine Funktionen** kapseln
  (`istRichtig(gewaehlt, loesung)`, `bestanden(richtigeAnzahl)`, `naechsterGuertel(...)`),
  damit sie ohne DOM testbar sind.
- Manuelle Verifikation: alle 28 Lösungen einer Stufe gegen die Daten durchklicken;
  Schwarz-Stufe gegen `fragen_original.json` gegenprüfen.

## 10. Nicht-Ziele (dieser Schritt)

- Kein Übungsmodus, keine Themen-Statistik (nächster Schritt).
- Kein Dark Mode (vorbereitet via CSS-Variablen, aber später).
- Kein Login, kein Server, keine Cloud, kein Wiederaufnehmen laufender Prüfungen.
