# Design: Paket B — Übungsmodus (fehlergetriebenes Wiederholungssystem)

**Datum:** 2026-06-17
**Scope:** Ein eigenständiger Übungsmodus neben dem bestehenden Prüfungsmodus: fehlergetriebene
Spaced-Repetition (Leitner/Streak), tägliche Fälligkeiten, Üben je Level und je Themenbereich,
Sofort-Feedback mit Wissenskern, Statistik je Themenbereich.

## 1. Ziel

Lernen durch gezielte Wiederholung der **falsch beantworteten** Fragen. Falsche kommen regelmäßig
wieder, richtige immer seltener; nach mehrfach richtig in Folge ist eine Karte „gemeistert" und
fällt raus. Zusätzlich gezieltes Training einzelner **Themenbereiche** und eine **Trefferquote** je
Bereich.

## 2. Ausgangslage

Vanilla HTML/CSS/JS, offline, kein Build. `app/index.html` lädt `styles.css`, `logic.js`
(reine, getestete Funktionen, UMD), `data.js` (JS-Wrap der Daten), `app.js` (Views/State).
Vorhanden: Prüfungsmodus, Level-Freischaltung (`hpp_progress.hoechsterGuertel` in localStorage),
zufällige Antwort-Reihenfolge (`L.mischen`, `L.anzeigeOptionen`), Durchsicht mit `frage.kern`.
Daten je Frage: `{ nr, thema, kern, stufen.{gelb,gruen,blau,braun,schwarz} }`; jede Stufe hat
`typ, stamm, aussagen|null, optionen{A..}, loesung[]`. `kern` ist ein **statisches Datenfeld**
(kein LLM zur Laufzeit).

**Datenabhängigkeit:** Der Pool nutzt nur Prüfungen mit `guertel_komplett: true` (aktuell 2026-03,
Okt 2025). März 2025 ist wegen fehlerhafter Übersetzungen deaktiviert und kommt nach Korrektur
automatisch hinzu.

## 3. Begriffe

- **Karte (Card):** eine konkrete Frage **auf einer Stufe**. Identität:
  `kartenId = "<examId>|<nr>|<level>"` (z. B. `2026-03|7|gelb`). Der Übungsstapel eines Levels ist
  über alle verfügbaren Prüfungen **gepoolt**.
- **Level-Sperre:** Üben nur für **freigeschaltete Level** (gleiche Sperre wie die Prüfung;
  `L.istFreigeschaltet`).
- **Streak:** Zahl der **richtigen Antworten in Folge** einer Karte (0–4).
- **Themenbereich:** inhaltliche Kategorie (12 Stück, §4); jede Frage gehört zu genau einer.

## 4. Daten-Voraussetzung: Themenbereiche

Neue Datei `daten/themenbereiche.json` — die 12 Bereiche mit stabiler `id` + Label:

```json
[
  { "id": "diagnostik",    "label": "Diagnostik, Klassifikation & Psychopathologie" },
  { "id": "affektiv",      "label": "Affektive Störungen" },
  { "id": "psychosen",     "label": "Schizophrenie & psychotische Störungen" },
  { "id": "angst",         "label": "Angst-, Zwangs-, Belastungs- & somatoforme Störungen" },
  { "id": "persoenlich",   "label": "Persönlichkeitsstörungen" },
  { "id": "sucht",         "label": "Suchterkrankungen" },
  { "id": "organisch",     "label": "Organische Störungen, Neurologie & Psychopharmakologie" },
  { "id": "kjp",           "label": "Kinder- & Jugendpsychiatrie" },
  { "id": "ess_sexual",    "label": "Ess- & Sexualstörungen" },
  { "id": "notfall",       "label": "Notfälle & Suizidalität" },
  { "id": "therapie",      "label": "Psychotherapieverfahren & Lerntheorie" },
  { "id": "recht",         "label": "Recht & Berufskunde" }
]
```

Jede Frage in den `fragen_*.json` (nur `guertel_komplett`-Prüfungen) bekommt ein Feld
`"themenbereich": "<id>"`. Die Zuordnung erfolgt anhand des vorhandenen `thema` + Inhalt
(empirisch hergeleitet, siehe Brainstorm). `daten/build_data.py` nimmt `themenbereiche.json` mit
in `app/data.js` auf: `window.HPP_DATA.themenbereiche = [...]`. Reihenfolge der Liste = Anzeige-
Reihenfolge im Dashboard.

## 5. SRS-Logik (reine Funktionen in `logic.js`)

Konstanten: `MASTER_STREAK = 4`, `INTERVALE = { 1: 2, 2: 4, 3: 8 }` (Tage je erreichtem Streak),
`STRAFE_TAGE = 1` (nach falsch).

- `naechsterStreak(streak, richtig)` → `richtig ? streak + 1 : 0`.
- `istGemeistert(streak)` → `streak >= MASTER_STREAK`.
- `naechsteFaelligkeit(heuteISO, streak, richtig)` → ISO-Datum:
  - falsch → `heute + STRAFE_TAGE`.
  - richtig & nicht gemeistert → `heute + INTERVALE[neuerStreak]`.
  - richtig & gemeistert → `null` (Karte fliegt raus).
- `istFaellig(dueISO, heuteISO)` → `dueISO <= heuteISO`.
- Datums-Helfer `addTage(iso, n)` und `heuteISO()` (Letzteres dünner Wrapper um `new Date`).

Die Funktionen sind DOM-frei und mit festen Datumsstrings deterministisch testbar.

## 6. Persistenz (localStorage)

Getrennt vom bestehenden `hpp_progress`:

```
hpp_srs = {
  karten: {
    "2026-03|7|gelb": { streak: 1, due: "2026-06-19", thema: "sucht" }
    // nur Karten, die mind. einmal falsch waren und noch nicht gemeistert sind
  },
  stats: {
    "gelb|sucht": { gesehen: 12, richtig: 9 }   // je (level|themenbereich), für Trefferquote
  }
}
```

- Karte entsteht/aktualisiert sich bei **jeder gewerteten Antwort** (Übung **und** Prüfung).
- **Gemeisterte** Karten werden aus `karten` **entfernt** (Re-Eintritt möglich, wenn später wieder falsch).
- `stats` wird nur bei **Übungs**-Antworten hochgezählt (Trefferquote = Übungsleistung).
- Robust gegen fehlende/kaputte Werte (try/catch, Defaults = leere Objekte).

## 7. Wertung & Quellen für Karten

- **Übungsantwort (gewertet):** erste Antwort auf eine Karte in einer Session ist die gewertete.
  Aktualisiert `streak`, `due` (via §5) und `stats[level|thema]`. Wird sie gemeistert → entfernen.
- **Prüfungsabgabe:** für jede **falsch** beantwortete Frage wird die Karte `examId|nr|level`
  angelegt/zurückgesetzt (`streak 0`, `due = morgen`), falls nicht vorhanden. Prüfungs-**Richtige**
  ändern die SRS-Streaks **nicht** (SRS-Fortschritt entsteht im Üben). `stats` wird durch die
  Prüfung nicht verändert.

## 8. Session-Engine

Eine Übungs-Session ist eine Warteschlange von Karten. Drei Quellen (alle nutzen denselben
Karten-Screen, §10):

1. **Heute fällig (Tagesplan):** alle Karten des Levels mit `istFaellig(due, heute)`.
2. **Alle Fragen durchgehen:** der **volle** Level-Stapel (alle Fragen aller Pool-Prüfungen auf
   dieser Stufe), gemischt. Falsche Antworten erzeugen/aktualisieren SRS-Karten.
3. **Themenbereich gezielt:** wie 1 oder 2, aber gefiltert auf einen `themenbereich`. Standard:
   die **fälligen** Karten des Bereichs; sind keine fällig, der volle Bereichs-Stapel.

**Lapse-Wiedervorlage:** Wird die gewertete Antwort **falsch**, wird die Karte innerhalb der
laufenden Session **erneut ans Ende** gehängt (zum direkten Nachüben), **bis 1× richtig**
(gedeckelt auf max. 3 Wiedervorlagen). Diese Wiederholungen ändern die **Wertung/Planung nicht**
(die Karte ist bereits auf „morgen" gesetzt).

Session endet, wenn die Warteschlange leer ist (oder der Nutzer per Home abbricht).

## 9. Karten-Identität & Pooling

- Level-Stapel = Vereinigung der Fragen aller `guertel_komplett`-Prüfungen auf der Stufe.
- Karten-State ist pro `examId|nr|level` getrennt (dieselbe Themen-/Fragen-Dublette über zwei
  Prüfungen sind zwei Karten — bewusst, da inhaltlich eigenständige Originale).

## 10. Views & Flow

### 10.1 Startseite — Modus-Umschalter
- Segmented Control oben: **Prüfung / Üben** (Default „Prüfung"; Auswahl in `sessionStorage`
  oder einfacher State, nicht persistiert nötig).
- **Prüfung + Level antippen** → bestehender Prüfungsmodus (unverändert).
- **Üben + Level antippen** → Level-Üben-Dashboard.
- Im Üben-Modus zeigt jedes **freigeschaltete** Level ein Badge „**N fällig**" (Anzahl heute
  fälliger Karten des Levels). Gesperrte Level wie bisher 🔒.

### 10.2 Level-Üben-Dashboard
- Kopf: 🏠 (gürtelfarbig) + „<Level-Label> üben".
- **Hero:** große Zahl „N heute fällig" + Button **„Jetzt üben ›"** (startet Session-Quelle 1).
  Bei 0 fällig: Hinweis „Heute nichts fällig 🎉" + Button bleibt für „trotzdem üben" (→ Quelle 2).
- Zeile **„Alle Fragen durchgehen ›"** (Session-Quelle 2).
- Abschnitt **„Themenbereiche"**: **alle 12** Bereiche untereinander, **gleiche Höhe**, Liste
  **scrollbar**; Hero + „Alle durchgehen" bleiben oben fix. Je Zeile: Label, rechts „N fällig"
  (grün, wenn > 0; sonst grau) + Trefferquote (`stats`, `—` wenn `gesehen == 0`). Antippen →
  Session-Quelle 3 für diesen Bereich.

### 10.3 Übungs-Karten-Screen
- Kopf: 🏠 + Position „k / n" (Karte in der Session) + Themen-Chip rechts. **Kein Timer.**
  Dünner Session-Fortschrittsbalken.
- Frage: Stamm, ggf. Aussagen, Optionen als **A–E gemischt** (Wiederverwendung `L.anzeigeOptionen`,
  Reihenfolge je Session pro Karte einmal gewürfelt). Mehrfach-Hinweis via `L.erwarteMehrfach`.
- Auswahl wie im Prüfungsmodus (Einfach/eine, Mehrfach/zwei). Button **„Prüfen"** (für alle Typen).
- **Nach „Prüfen" (Layout bleibt stabil, erweitert nur nach unten):**
  - Optionen werden **markiert**: korrekte Lösung grün ✓, falsch Gewähltes rot ✗ (Positionen
    unverändert).
  - **Unter** den Optionen erscheint Block „Auswertung": Banner **„✓ Richtig"** (grün) /
    **„✗ Leider falsch"** (rot) + **Wissenskern** (`frage.kern`).
  - Dezente Zeile zur Wiedervorlage: z. B. „Kommt in 2 Tagen wieder · Streak 1/4",
    „Kommt morgen wieder · Streak 0/4" oder „🎉 Gemeistert!".
  - Button „Prüfen" → **„Weiter ›"** (nächste Karte); sanftes Scrollen zum Feedback.
- Home-Verhalten: 🏠 bricht die Session ohne Rückfrage ab (kein Datenverlust — Wertung passiert
  pro Karte sofort) und kehrt zum Dashboard/Startseite zurück.

## 11. Statistik

- Trefferquote je (Level, Themenbereich) aus `stats` (`richtig / gesehen`), im Dashboard angezeigt.
- Keine separate globale Statistikseite in diesem Paket (YAGNI; Trefferquote lebt im Dashboard).

## 12. Betroffene Dateien

- `daten/themenbereiche.json` — **neu** (12 Bereiche).
- `daten/fragen_2026-03.json`, `daten/fragen_2025-10.json` — Feld `themenbereich` je Frage ergänzen.
- `daten/build_data.py` — `themenbereiche` in `data.js` aufnehmen.
- `app/logic.js` — SRS-Funktionen (§5) + Tests in `app/logic.test.js`.
- `app/srs.js` — **neu**: localStorage-Schicht (`hpp_srs` laden/speichern, Karte werten, fällige
  Karten je Level/Thema zählen/sammeln, Stats). Reine Daten-/Zustands-Logik, ohne DOM, testbar.
- `app/app.js` — Modus-Umschalter auf der Startseite, Dashboard-View, Karten-Screen-View,
  Session-Engine, Anbindung an `srs.js`; Prüfungsabgabe seedet falsche Karten.
- `app/styles.css` — Segmented Control, Dashboard (Hero, scrollbare Themenliste), Karten-Feedback.
- `app/index.html` — `<script src="srs.js">` ergänzen.

`srs.js` als eigenes UMD-Modul (wie `logic.js`), damit die Persistenz-/Auswahl-Logik getrennt,
fokussiert und per `node --test` prüfbar bleibt (localStorage in Tests über ein einfaches Stub-Objekt).

## 13. Testbarkeit

- `logic.js`-SRS-Funktionen: deterministisch mit festen Datumsstrings (Streak-Übergänge,
  Fälligkeiten 2/4/8, Meisterung bei 4, Lapse → +1 Tag).
- `srs.js`: mit injizierbarem Speicher-Stub — Karte werten ändert Streak/Due korrekt; gemeisterte
  Karte wird entfernt; fällige-Karten-Zählung je Level/Thema; Stats-Trefferquote.
- Manuell im Browser: Umschalter, Badges „N fällig", Dashboard, Session-Ablauf, Sofort-Feedback
  (Layout stabil/erweitert nach unten), Prüfungsfehler tauchen als fällige Karten auf,
  Meisterung nach 4×, Trefferquote.

## 14. Nicht-Ziele / später

- Keine Cloud/kein Backend; alles `localStorage`, offline.
- Keine konfigurierbaren Intervalle/Settings-UI (feste Werte, leicht im Code anpassbar).
- Keine globale Statistik-/Verlaufsseite über die Dashboard-Trefferquote hinaus.
- März 2025 erst nach Datenkorrektur im Pool (automatisch via `guertel_komplett`).
- Umfang ist groß → der Implementierungsplan wird **phasenweise** geschnitten
  (Daten/Themenbereiche → SRS-Logik → Persistenz → Karten-Screen → Dashboard/Umschalter → Prüfungs-Seeding/Stats).
